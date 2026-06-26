"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./traceguide-demo.module.css";

type TraceSource = {
  id: string;
  number: number;
  title: string;
  category: string;
  excerpt: string;
  relevance: string;
  matchedTerms: string[];
};

type TraceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: TraceSource[];
};

const starterQuestions = [
  "Can I return this opened snack?",
  "My parcel is two days late. What can I do?",
  "The product contains almond oil. Is it suitable for me?",
];

export default function TraceGuideDemo() {
  const [messages, setMessages] = useState<TraceMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I’m TraceGuide. Ask me about a product, delivery, return or refund. I’ll show where my advice comes from when I use store knowledge.",
      sources: [],
    },
  ]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<TraceSource | null>(null);
  const messageCounter = useRef(0);

  const lastAssistantSources = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.sources?.length)
        ?.sources || [],
    [messages]
  );

  async function askTraceGuide(customQuestion?: string) {
    const finalQuestion = customQuestion || question.trim();
    if (!finalQuestion || isLoading) return;
    messageCounter.current += 1;
    const userMessageId = `user_${messageCounter.current}`;

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: finalQuestion },
    ]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/traceguide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQuestion }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "TraceGuide failed to answer.");
      }

      messageCounter.current += 1;
      const assistantMessageId = `assistant_${messageCounter.current}`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: result.answer,
          sources: result.sources || [],
        },
      ]);
    } catch (error) {
      console.error(error);
      messageCounter.current += 1;
      const errorMessageId = `error_${messageCounter.current}`;

      setMessages((prev) => [
        ...prev,
        {
          id: errorMessageId,
          role: "assistant",
          content:
            "I can’t load reliable store knowledge right now. Please contact human support before making a return, refund or product-safety decision.",
          sources: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function renderAnswer(content: string, sources: TraceSource[] = []) {
    const parts = content.split(/(\[\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return <span key={`${part}-${index}`}>{part}</span>;

      const source = sources.find((item) => item.number === Number(match[1]));
      if (!source) return <span key={`${part}-${index}`}>{part}</span>;

      return (
        <button
          key={`${part}-${index}`}
          className={styles.citation}
          onClick={() => setActiveSource(source)}
          type="button"
          aria-label={`Open source ${source.number}: ${source.title}`}
        >
          {part}
        </button>
      );
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.phoneShell} aria-label="TraceGuide mobile demo">
        <header className={styles.topBar}>
          <div>
            <p>TraceGuide</p>
            <h1>AI Shopping Support</h1>
          </div>
          <button className={styles.humanButton} type="button">
            Human support
          </button>
        </header>

        <section className={styles.orderCard}>
          <div className={styles.productImage} aria-hidden="true" />
          <div>
            <p className={styles.label}>Current context</p>
            <h2>Order, product and policy help</h2>
            <span>Store knowledge · Source-linked advice</span>
          </div>
        </section>

        <section className={styles.chatWindow}>
          <div className={styles.messages}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`${styles.message} ${styles[message.role]}`}
              >
                <div className={styles.bubble}>
                  <p>{renderAnswer(message.content, message.sources)}</p>

                  {message.role === "assistant" && Boolean(message.sources?.length) && (
                    <div className={styles.sourceStrip}>
                      {message.sources?.slice(0, 3).map((source) => (
                        <button
                          key={source.id}
                          onClick={() => setActiveSource(source)}
                          type="button"
                        >
                          [{source.number}] {source.category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}

            {isLoading && (
              <article className={`${styles.message} ${styles.assistant}`}>
                <div className={styles.bubble}>
                  <div className={styles.loadingRow}>
                    <span className={styles.loader} />
                    <p>Checking matching store knowledge…</p>
                  </div>
                </div>
              </article>
            )}
          </div>

          <div className={styles.starterList}>
            {starterQuestions.map((item) => (
              <button key={item} onClick={() => askTraceGuide(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          <form
            className={styles.inputBar}
            onSubmit={(event) => {
              event.preventDefault();
              askTraceGuide();
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about returns, delivery, ingredients…"
            />
            <button type="submit" disabled={isLoading}>
              Send
            </button>
          </form>

          {Boolean(lastAssistantSources.length) && (
            <button
              className={styles.whyButton}
              onClick={() => setActiveSource(lastAssistantSources[0])}
              type="button"
            >
              Why this answer?
            </button>
          )}
        </section>
      </section>

      {activeSource && (
        <div className={styles.sheetBackdrop} onClick={() => setActiveSource(null)}>
          <section className={styles.sourceSheet} onClick={(event) => event.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div>
                <p className={styles.label}>Source [{activeSource.number}]</p>
                <h2>{activeSource.title}</h2>
              </div>
              <button onClick={() => setActiveSource(null)} type="button">
                Close
              </button>
            </div>

            <div className={styles.matchCard}>
              <span>{activeSource.category}</span>
              <strong>{activeSource.relevance}</strong>
              {Boolean(activeSource.matchedTerms.length) && (
                <div className={styles.termList}>
                  {activeSource.matchedTerms.map((term) => (
                    <em key={term}>{term}</em>
                  ))}
                </div>
              )}
            </div>

            <article className={styles.originalText}>
              <p className={styles.label}>Original text</p>
              <blockquote>{activeSource.excerpt}</blockquote>
            </article>
          </section>
        </div>
      )}
    </main>
  );
}
