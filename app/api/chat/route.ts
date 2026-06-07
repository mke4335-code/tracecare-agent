import OpenAI from "openai";
import { supabase } from "../../../lib/supabase";

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "missing-key",
    baseURL: "https://api.groq.com/openai/v1",
  });

type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  content: string;
  status: string;
};

type SourceDoc = KnowledgeDoc & {
  score: number;
};

function scoreDoc(question: string, doc: KnowledgeDoc): number {
  const q = question.toLowerCase();
  const text = `${doc.title} ${doc.category} ${doc.content}`.toLowerCase();

  let score = 0;

  const words = q
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  for (const word of words) {
    if (text.includes(word)) score += 1;
  }

  if (q.includes("refund") || q.includes("broken") || q.includes("damaged")) {
    if (doc.category.toLowerCase().includes("refund")) score += 5;
  }

  if (q.includes("return") || q.includes("opened") || q.includes("food")) {
    if (doc.category.toLowerCase().includes("return")) score += 5;
  }

  if (q.includes("late") || q.includes("delivery") || q.includes("parcel")) {
    if (doc.category.toLowerCase().includes("logistics")) score += 5;
  }

  if (q.includes("allergen") || q.includes("peanut") || q.includes("soy")) {
    if (doc.category.toLowerCase().includes("product safety")) score += 5;
  }

  if (q.includes("missing") || q.includes("accessory")) {
    if (doc.content.toLowerCase().includes("missing accessory")) score += 5;
  }

  return score;
}

function buildFallbackAnswer(question: string, docs: SourceDoc[]) {
  const topDoc = docs[0];

  if (!topDoc) {
    return {
      answer:
        "I could not find enough reliable knowledge to answer this. Please contact human support or add relevant knowledge to the knowledge base.",
      confidence: 45,
    };
  }

  return {
    answer: `Based on the knowledge base source "${topDoc.title}", here is the support answer: ${topDoc.content}`,
    confidence: topDoc.score >= 5 ? 82 : 62,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = body.question;

    if (!question || typeof question !== "string") {
      return Response.json({ error: "Question is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("knowledge_docs")
      .select("id, title, category, content, status")
      .eq("status", "active");

    if (error) {
      console.error("Supabase error:", error);
      return Response.json({
        answer:
          "The system could not load the knowledge base. Please check Supabase connection and RLS policies.",
        confidence: 0,
        sources: [],
      });
    }

    const docs = (data || []) as KnowledgeDoc[];

    const rankedDocs: SourceDoc[] = docs
      .map((doc) => ({
        ...doc,
        score: scoreDoc(question, doc),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const usefulDocs = rankedDocs.filter((doc) => doc.score > 0);

    const sources = usefulDocs.map((doc) => ({
      docTitle: doc.title,
      chunk: doc.content,
      score: doc.score,
    }));

    if (usefulDocs.length === 0) {
      return Response.json({
        answer:
          "I do not have enough reliable knowledge to answer this. Please contact human support or add relevant knowledge to the knowledge base.",
        confidence: 45,
        sources: [],
      });
    }

    const context = usefulDocs
      .map(
        (doc, index) =>
          `[Source ${index + 1}]
Title: ${doc.title}
Category: ${doc.category}
Content: ${doc.content}`
      )
      .join("\n\n");

      if (!process.env.GROQ_API_KEY) {
      const fallback = buildFallbackAnswer(question, usefulDocs);

      return Response.json({
        answer:
          fallback.answer +
          "\n\nNote: OpenAI API key is not configured yet, so this answer is generated from the retrieved knowledge base only.",
        confidence: fallback.confidence,
        sources,
      });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are an ecommerce customer service AI assistant. Answer only using the provided knowledge base sources. If the sources are not enough, say you are not sure and suggest human support. Do not invent policy details. Keep the answer concise, practical, and customer-friendly.",
          },
          {
            role: "user",
            content: `Customer question:
${question}

Knowledge base sources:
${context}

Please answer the customer and mention which source you used.`,
          },
        ],
      });

      const answer =
        completion.choices[0]?.message?.content ||
        "I could not generate an answer.";

      return Response.json({
        answer,
        confidence: usefulDocs[0]?.score >= 5 ? 88 : 68,
        sources,
      });
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);

      const fallback = buildFallbackAnswer(question, usefulDocs);

      return Response.json({
        answer:
          fallback.answer +
          "\n\nNote: OpenAI API call failed, so this fallback answer is generated from the retrieved knowledge base only.",
        confidence: fallback.confidence,
        sources,
      });
    }
  } catch (error) {
    console.error("Chat API error:", error);

    return Response.json({
      answer:
        "The chat API failed. Please check the server console for details.",
      confidence: 0,
      sources: [],
    });
  }
}