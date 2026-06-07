"use client";

import { useMemo, useState } from "react";

type Source = {
  docTitle: string;
  chunk: string;
  score: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  sources?: Source[];
};

type Variables = {
  issueType: string;
  itemStatus: string;
  productType: string;
  orderContext: string;
};

const quickQuestions = [
  "My product arrived with a missing accessory. Can I get a refund?",
  "My glass food container arrived broken. What should I do?",
  "Can I return an opened snack?",
  "My parcel is two days late. Can I get compensation?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I’m TraceCare Support. I can help with refunds, returns, delivery, damaged items, missing accessories, and product safety questions.",
      confidence: 100,
      sources: [],
    },
  ]);

  const [question, setQuestion] = useState("");
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [selectedSources, setSelectedSources] = useState<Source[] | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const [variables, setVariables] = useState<Variables>({
    issueType: "Refund",
    itemStatus: "Missing accessory",
    productType: "Home product",
    orderContext: "Order delivered today",
  });

  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user"),
    [messages]
  );

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages]
  );

  async function askAI(customQuestion?: string) {
    const finalQuestion = customQuestion || question.trim();
    if (!finalQuestion || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: finalQuestion,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsLoading(true);
    setFeedbackSaved(false);

    await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        role: "user",
        content: finalQuestion,
      }),
    });

    try {
      setLoadingStep("Understanding your question");

      await wait(450);
      setLoadingStep("Retrieving matching knowledge base sources");

      const enhancedQuestion = `
Customer question: ${finalQuestion}

Current retrieval variables:
- Issue type: ${variables.issueType}
- Item status: ${variables.itemStatus}
- Product type: ${variables.productType}
- Order context: ${variables.orderContext}
`;

      await wait(450);
      setLoadingStep("Generating grounded answer");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: enhancedQuestion,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate answer.");
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: result.answer,
        confidence: result.confidence,
        sources: result.sources || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          role: "assistant",
          content: assistantMessage.content,
          sources: assistantMessage.sources || [],
          confidence: assistantMessage.confidence,
        }),
      });
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, the AI service is not available right now. Please try again or contact human support.",
          confidence: 0,
          sources: [],
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  }

  async function resubmitWithVariables() {
    const lastQuestion = lastUserMessage?.content;
    if (!lastQuestion) return;
    setShowVariables(false);
    await askAI(lastQuestion);
  }

  async function markNotHelpful() {
    if (!lastUserMessage || !lastAssistantMessage) return;

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: lastUserMessage.content,
          ai_answer: lastAssistantMessage.content,
          sources: lastAssistantMessage.sources || [],
          user_feedback: "not_helpful",
          edited_variables: variables,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save bad case.");
      }

      setFeedbackSaved(true);
    } catch (error) {
      console.error(error);
      alert("Failed to save bad case. Please check Supabase policies.");
    }
  }

  return (
    <main className="shopperPage">
      <section className="phoneShell">
        <header className="topBar">
          <div>
            <p>TraceCare</p>
            <h1>AI Customer Support</h1>
          </div>
          <button className="humanBtn">Human support</button>
        </header>

        <section className="orderCard">
          <div className="productThumb">▣</div>
          <div>
            <p className="smallLabel">Current order</p>
            <h2>Glass food container set</h2>
            <span>Delivered today · Order #TC-2048</span>
          </div>
        </section>

        <section className="chatWindow">
          <div className="messages">
            {messages.map((message) => (
              <article key={message.id} className={`msg ${message.role}`}>
                <div className="bubble">
                  <p>{message.content}</p>

                  {message.role === "assistant" && message.confidence !== undefined && (
                    <div className="answerFooter">
                      <span>Confidence {message.confidence}%</span>

                      {message.sources && message.sources.length > 0 && (
                        <button onClick={() => setSelectedSources(message.sources || [])}>
                          View sources
                        </button>
                      )}

                      <button onClick={() => setShowVariables(true)}>
                        Edit key variables
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {isLoading && (
              <article className="msg assistant">
                <div className="bubble loadingBubble">
                  <div className="loader" />
                  <p>{loadingStep}</p>
                  <div className="retrievalSteps">
                    <span>1. Query understanding</span>
                    <span>2. Knowledge retrieval</span>
                    <span>3. Grounded answer</span>
                  </div>
                </div>
              </article>
            )}
          </div>

          <div className="quickList">
            {quickQuestions.map((item) => (
              <button key={item} onClick={() => askAI(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="inputBar">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about refund, return, delivery..."
              onKeyDown={(e) => {
                if (e.key === "Enter") askAI();
              }}
            />
            <button onClick={() => askAI()}>Send</button>
          </div>

          <div className="feedbackRow">
            <button>Helpful</button>
            <button onClick={markNotHelpful}>Not helpful</button>
            <button>Transfer to human</button>
          </div>

          {feedbackSaved && (
            <div className="savedNotice">
              Saved as a bad case. The product team can review it in Supabase.
            </div>
          )}
        </section>
      </section>

      {selectedSources && (
        <div className="modalBackdrop" onClick={() => setSelectedSources(null)}>
          <section className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <p className="smallLabel">Retrieved knowledge</p>
                <h2>Matched source text</h2>
              </div>
              <button onClick={() => setSelectedSources(null)}>Close</button>
            </div>

            <div className="sourceList">
              {selectedSources.map((source, index) => (
                <article key={`${source.docTitle}-${index}`} className="sourceCard">
                  <div>
                    <span>Source {index + 1}</span>
                    <strong>{source.docTitle}</strong>
                  </div>
                  <p>{source.chunk}</p>
                  <small>match score: {source.score}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {showVariables && (
        <div className="modalBackdrop" onClick={() => setShowVariables(false)}>
          <section className="modalCard variableCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <p className="smallLabel">Retrieval control</p>
                <h2>Edit key variables</h2>
              </div>
              <button onClick={() => setShowVariables(false)}>Close</button>
            </div>

            <p className="helpText">
              These variables guide retrieval. This does not edit the model’s hidden reasoning.
              It changes the search context used to find better knowledge sources.
            </p>

            <div className="formGrid">
              <label>
                Issue type
                <select
                  value={variables.issueType}
                  onChange={(e) =>
                    setVariables((prev) => ({ ...prev, issueType: e.target.value }))
                  }
                >
                  <option>Refund</option>
                  <option>Return</option>
                  <option>Logistics</option>
                  <option>Product Safety</option>
                  <option>Order</option>
                </select>
              </label>

              <label>
                Item status
                <select
                  value={variables.itemStatus}
                  onChange={(e) =>
                    setVariables((prev) => ({ ...prev, itemStatus: e.target.value }))
                  }
                >
                  <option>Missing accessory</option>
                  <option>Damaged</option>
                  <option>Opened</option>
                  <option>Delayed</option>
                  <option>Allergen concern</option>
                </select>
              </label>

              <label>
                Product type
                <select
                  value={variables.productType}
                  onChange={(e) =>
                    setVariables((prev) => ({ ...prev, productType: e.target.value }))
                  }
                >
                  <option>Home product</option>
                  <option>Food product</option>
                  <option>Cosmetics</option>
                  <option>Electronics</option>
                </select>
              </label>

              <label>
                Order context
                <select
                  value={variables.orderContext}
                  onChange={(e) =>
                    setVariables((prev) => ({ ...prev, orderContext: e.target.value }))
                  }
                >
                  <option>Order delivered today</option>
                  <option>Delivered within 7 days</option>
                  <option>Delivery delayed over 48 hours</option>
                  <option>Order information missing</option>
                </select>
              </label>
            </div>

            <button className="primaryWide" onClick={resubmitWithVariables}>
              Re-run answer with updated variables
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}