"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import styles from "../traceguide-demo/traceguide-demo.module.css";

type ProductContext = {
  name: string;
  image: "glass-box" | "cookies" | "container-set";
  detail: string;
  status: string;
  linkLabel: string;
};

type TraceVariables = {
  issueIdentified: string;
  request: string;
  reason: string;
  evidence: string;
};

type BaselineResponse = {
  answer: string;
  confidence?: number;
  variables: TraceVariables;
  nextAction: string;
  product: ProductContext;
};

type ActionResponse = {
  requestId: string;
  steps: string[];
};

const defaultProduct: ProductContext = {
  name: "Glass Lunch Box",
  image: "glass-box",
  detail: "1 item",
  status: "Delivered 2 days ago",
  linkLabel: "Order details",
};

const defaultVariables: TraceVariables = {
  issueIdentified: "Damaged item",
  request: "Return & Refund",
  reason: "Item arrived damaged",
  evidence: "Photos needed",
};

const suggestedQuestions = [
  "The glass lunch box arrived damaged. Can I return it?",
  "The cookies arrived damaged. Can I get a refund?",
  "My order arrived two days late. Can I get compensation?",
];

function productImageSrc(product: ProductContext) {
  if (product.image === "cookies") return "/traceguide-cookie.png";
  if (product.image === "container-set") return "/traceguide-container-set.png";
  return "/traceguide-glass-lunch-box.png";
}

function stripEvidenceFeatures(answer: string) {
  return answer
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function formatBaselineAnswer(answer: string) {
  const cleaned = stripEvidenceFeatures(answer);
  if (cleaned.includes("\n\n")) return cleaned.split("\n\n");

  const splitIndex = cleaned.search(/\.\s+[A-Z]/);
  if (splitIndex === -1) return [cleaned];

  return [cleaned.slice(0, splitIndex + 1), cleaned.slice(splitIndex + 2)];
}

function inferProductFromQuestion(question: string): ProductContext {
  const q = question.toLowerCase();
  if (q.includes("cookie") || q.includes("food") || q.includes("peanut") || q.includes("allergen")) {
    return {
      name: "Milk Cookies",
      image: "cookies",
      detail: "100g / pack",
      status: q.includes("peanut") || q.includes("allergen")
        ? "Product information available"
        : "Delivered 2 days ago",
      linkLabel: "Product details",
    };
  }

  if (q.includes("late") || q.includes("compensation") || q.includes("missing") || q.includes("accessory")) {
    return {
      name: "Glass Food Containers Set",
      image: "container-set",
      detail: "4-piece set",
      status: q.includes("late") || q.includes("compensation") ? "Arrived 2 days late" : "Delivered today",
      linkLabel: q.includes("late") || q.includes("compensation") ? "Delivery details" : "Order details",
    };
  }

  return defaultProduct;
}

export default function TraceGuideBaseline() {
  const [phase, setPhase] = useState<"idle" | "loading" | "answer" | "action">("idle");
  const [question, setQuestion] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [response, setResponse] = useState<BaselineResponse | null>(null);
  const [product, setProduct] = useState<ProductContext>(defaultProduct);
  const [variables, setVariables] = useState<TraceVariables>(defaultVariables);
  const [action, setAction] = useState<ActionResponse | null>(null);
  const [actionStep, setActionStep] = useState(0);

  const actionSteps = useMemo(
    () =>
      action?.steps || [
        "Creating request",
        "Adding details",
        "Sending to seller",
        "Notifying you of updates",
      ],
    [action]
  );

  async function askAgent(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;

    setQuestion(trimmed);
    setProduct(inferProductFromQuestion(trimmed));
    setResponse(null);
    setAction(null);
    setActionStep(0);
    setPhase("loading");

    try {
      const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 1100));
      const apiRequest = fetch("/api/traceguide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const [apiResponse] = await Promise.all([apiRequest, minimumDelay]);
      const result = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(result.error || "Baseline request failed.");

      const nextProduct = result.product || inferProductFromQuestion(trimmed);
      setProduct(nextProduct);
      setVariables(result.variables || defaultVariables);
      setResponse({
        answer: stripEvidenceFeatures(result.answer || "I can help with this order. Would you like me to prepare a support request?"),
        variables: result.variables || defaultVariables,
        nextAction: result.nextAction || "start a support request",
        product: nextProduct,
      });
    } catch (error) {
      console.error(error);
      setResponse({
        answer:
          "I can help with this order, but I need a little more information before I prepare a support request.",
        variables: defaultVariables,
        nextAction: "contact human support",
        product: inferProductFromQuestion(trimmed),
      });
    } finally {
      setPhase("answer");
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askAgent(inputValue);
    setInputValue("");
  }

  async function startRequest() {
    setPhase("action");
    setActionStep(0);

    try {
      const apiResponse = await fetch("/api/traceguide-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_request",
          product: product.name,
          nextAction: response?.nextAction,
          variables,
        }),
      });
      const result = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(result.error || "Action failed.");
      setAction(result);
    } catch (error) {
      console.error(error);
      setAction({
        requestId: "BASELINE-DEMO",
        steps: ["Creating request", "Adding details", "Sending to seller", "Notifying you of updates"],
      });
    }

    const interval = window.setInterval(() => {
      setActionStep((current) => {
        if (current >= 3) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, 850);
  }

  return (
    <main className={`${styles.page} notranslate`} translate="no">
      <section className={styles.phone} aria-label="Baseline AI customer support mobile demo">
        <StatusBar />
        <header className={styles.nav}>
          <button className={styles.backButton} type="button" aria-label="Go back">
            ‹
          </button>
          <h1>AI Support</h1>
          <button className={styles.humanButton} type="button">
            Human
          </button>
        </header>

        <section className={styles.conversation}>
          {phase === "idle" ? (
            <AssistantRow>
              <article className={styles.welcomeCard}>
                <h2>Hi, I’m AI Support.</h2>
                <p>I can answer questions about your order and help start a support request.</p>
                <div className={styles.suggestionGrid} aria-label="Suggested questions">
                  {suggestedQuestions.map((item) => (
                    <button key={item} type="button" onClick={() => askAgent(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </article>
            </AssistantRow>
          ) : (
            <>
              <UserQuestion question={question} />
              <ProductCard product={product} />
            </>
          )}

          {phase === "loading" && (
            <AssistantRow>
              <div className={styles.baselineLoading}>
                <span />
                <span />
                <span />
              </div>
            </AssistantRow>
          )}

          {(phase === "answer" || phase === "action") && response && (
            <>
              <AssistantRow>
                <article className={styles.baselineAnswerCard}>
                  {formatBaselineAnswer(response.answer).map((paragraph, index) =>
                      index === 0 ? (
                        <strong key={paragraph}>{paragraph}</strong>
                      ) : (
                        <p key={paragraph}>{paragraph}</p>
                      )
                    )}
                </article>
              </AssistantRow>

              {phase === "answer" && (
                <AssistantRow compact>
                  <div>
                    <div className={styles.askBubble}>Would you like me to {response.nextAction}?</div>
                    <div className={styles.quickReplies}>
                      <button type="button" onClick={startRequest}>
                        Yes
                      </button>
                      <button type="button">No</button>
                    </div>
                  </div>
                </AssistantRow>
              )}
            </>
          )}

          {phase === "action" && (
            <>
              <div className={styles.userReply}>Yes</div>
              <AssistantRow>
                <article className={styles.actionCard}>
                  <h2>I’ll prepare this request for you.</h2>
                  <p>Sending the request details...</p>
                  <div className={styles.actionSteps}>
                    {actionSteps.map((step, index) => (
                      <div key={step} className={index <= actionStep ? styles.actionActive : ""}>
                        <span>{index < actionStep ? "✓" : index === actionStep ? "●" : ""}</span>
                        <div>
                          <strong>{step}</strong>
                          <small>{index < actionStep ? "Done" : index === actionStep ? "Processing..." : "Waiting"}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  {actionStep >= actionSteps.length - 1 && (
                    <p className={styles.requestId}>Request ID: {action?.requestId || "BASELINE-DEMO"}</p>
                  )}
                </article>
              </AssistantRow>
            </>
          )}
        </section>

        <form className={styles.inputBar} onSubmit={submitQuestion}>
          <span aria-hidden="true">◌</span>
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask another question..."
            aria-label="Ask another question"
          />
          <button type="submit" aria-label="Send question">
            ➤
          </button>
        </form>

        <div className={styles.homeIndicator} />
      </section>
    </main>
  );
}

function StatusBar() {
  return (
    <div className={styles.statusBar} aria-hidden="true">
      <span>9:41</span>
      <div>
        <span className={styles.signal}>▮▮▮</span>
        <span className={styles.wifi}>⌒</span>
        <span className={styles.battery} />
      </div>
    </div>
  );
}

function UserQuestion({ question }: { question: string }) {
  return (
    <div className={styles.userQuestion}>
      <p>{question}</p>
      <span aria-hidden="true">●</span>
    </div>
  );
}

function ProductCard({ product }: { product: ProductContext }) {
  return (
    <article className={styles.productCard}>
      <Image src={productImageSrc(product)} alt={product.name} width={320} height={320} priority />
      <div>
        <h2>{product.name}</h2>
        <p>
          <span>✓</span> {product.status}
        </p>
        <button type="button">{product.linkLabel}</button>
      </div>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </article>
  );
}

function AssistantRow({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.assistantRow} ${compact ? styles.compactRow : ""}`}>
      <span className={styles.sparkle} aria-hidden="true">
        ✦
      </span>
      {children}
    </div>
  );
}
