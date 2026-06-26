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
  matchedTerms: string[];
};

function normaliseWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function matchedTerms(question: string, doc: KnowledgeDoc) {
  const docText = `${doc.title} ${doc.category} ${doc.content}`.toLowerCase();
  const uniqueTerms = Array.from(new Set(normaliseWords(question)));
  return uniqueTerms.filter((word) => docText.includes(word)).slice(0, 6);
}

function scoreDoc(question: string, doc: KnowledgeDoc): SourceDoc {
  const q = question.toLowerCase();
  const terms = matchedTerms(question, doc);
  let score = terms.length;

  if (q.includes("refund") || q.includes("broken") || q.includes("damaged")) {
    if (doc.category.toLowerCase().includes("refund")) score += 5;
  }

  if (q.includes("return") || q.includes("opened") || q.includes("food")) {
    if (doc.category.toLowerCase().includes("return")) score += 5;
  }

  if (q.includes("late") || q.includes("delivery") || q.includes("parcel")) {
    if (doc.category.toLowerCase().includes("logistics")) score += 5;
  }

  if (
    q.includes("allergen") ||
    q.includes("almond") ||
    q.includes("peanut") ||
    q.includes("soy") ||
    q.includes("ingredient")
  ) {
    if (doc.category.toLowerCase().includes("product safety")) score += 5;
  }

  if (q.includes("missing") || q.includes("accessory")) {
    if (doc.content.toLowerCase().includes("missing accessory")) score += 5;
  }

  return { ...doc, score, matchedTerms: terms };
}

function sourcePayload(docs: SourceDoc[]) {
  return docs.map((doc, index) => ({
    id: doc.id,
    number: index + 1,
    title: doc.title,
    category: doc.category,
    excerpt: doc.content,
    relevance:
      doc.matchedTerms.length > 0
        ? `Matched because the policy text overlaps with “${doc.matchedTerms
            .slice(0, 3)
            .join(", ")}”.`
        : `Matched because this ${doc.category.toLowerCase()} policy is the closest store knowledge for the question.`,
    matchedTerms: doc.matchedTerms,
  }));
}

function fallbackAnswer(question: string, docs: SourceDoc[]) {
  const topDoc = docs[0];

  if (!topDoc) {
    return "I could not find reliable store knowledge for this. Please contact human support before taking action.";
  }

  const q = question.toLowerCase();
  const prefix = q.includes("return")
    ? "Based on the store return policy"
    : q.includes("refund")
      ? "Based on the refund policy"
      : q.includes("late") || q.includes("delivery") || q.includes("parcel")
        ? "Based on the delivery policy"
        : "Based on the matching store guidance";

  return `${prefix}, here is the safest next step: ${topDoc.content} [1]`;
}

function ensureCitation(answer: string, hasSources: boolean) {
  if (!hasSources || /\[\d+\]/.test(answer)) return answer;
  return `${answer.trim()} [1]`;
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
          "I could not load reliable store knowledge right now. Please contact human support before taking action.",
        sources: [],
      });
    }

    const docs = ((data || []) as KnowledgeDoc[])
      .map((doc) => scoreDoc(question, doc))
      .sort((a, b) => b.score - a.score);

    const usefulDocs = docs.filter((doc) => doc.score > 0).slice(0, 3);
    const sources = sourcePayload(usefulDocs);

    if (usefulDocs.length === 0) {
      return Response.json({
        answer:
          "I could not find a reliable policy or product source for this question. Please contact human support before making a return, refund or product-safety decision.",
        sources: [],
      });
    }

    const context = usefulDocs
      .map(
        (doc, index) =>
          `[${index + 1}]
Title: ${doc.title}
Category: ${doc.category}
Original text: ${doc.content}`
      )
      .join("\n\n");

    if (!process.env.GROQ_API_KEY) {
      return Response.json({
        answer: fallbackAnswer(question, usefulDocs),
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
              "You are TraceGuide, a concise ecommerce customer support assistant for ordinary shoppers. Answer only using the provided store knowledge. Use simple buyer-friendly language. Add source citations in square brackets, such as [1], exactly where the advice depends on a source. If the sources are not enough, say you are not sure and suggest human support. Do not mention retrieval, variables, raw scores, experiments, or internal system details.",
          },
          {
            role: "user",
            content: `Customer question:
${question}

Store knowledge:
${context}

Give a short practical answer with source citations like [1] or [2].`,
          },
        ],
      });

      const answer =
        completion.choices[0]?.message?.content ||
        fallbackAnswer(question, usefulDocs);

      return Response.json({
        answer: ensureCitation(answer, sources.length > 0),
        sources,
      });
    } catch (openaiError) {
      console.error("TraceGuide LLM error:", openaiError);
      return Response.json({
        answer: fallbackAnswer(question, usefulDocs),
        sources,
      });
    }
  } catch (error) {
    console.error("TraceGuide API error:", error);
    return Response.json({
      answer:
        "TraceGuide could not answer safely right now. Please contact human support before taking action.",
      sources: [],
    });
  }
}
