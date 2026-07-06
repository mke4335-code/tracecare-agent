"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import styles from "../traceguide-demo/traceguide-demo.module.css";
import {
  getTraceguideStudyTask,
  orderedTraceguideTasks,
  type TraceguideStudyTask,
} from "../../lib/traceguide-study-config";

type ProductContext = {
  name: string;
  image: "glass-box" | "cookies" | "container-set" | "coffee-maker" | "protein-bar" | "yoghurt" | "sandwich" | "snack";
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

type ActionState = {
  kind: "ready" | "needs_evidence" | "needs_human_review" | "informational";
  label: string;
  prompt: string;
  primaryAction: string;
  secondaryAction: string;
  canStartRequest: boolean;
};

type BaselineResponse = {
  answer: string;
  variables: TraceVariables;
  nextAction: string;
  actionState?: ActionState;
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
  evidence: "Photos provided",
};

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function productImageSrc(product: ProductContext) {
  if (product.image === "protein-bar") return "/traceguide-protein-bar.jpg";
  if (product.image === "snack") return "/traceguide-snack.jpg";
  if (product.image === "cookies") return "/traceguide-cookie.png";
  if (product.image === "container-set") return "/traceguide-container-set.png";
  return "/traceguide-glass-lunch-box.png";
}

function inferProductFromQuestion(question: string): ProductContext {
  if (includesAny(question, ["protein bar", "蛋白棒"])) {
    return {
      name: "Protein Bar",
      image: "protein-bar",
      detail: "60g / bar",
      status: "Product information available",
      linkLabel: "Product details",
    };
  }

  if (includesAny(question, ["snack", "package damaged", "零食", "包装"])) {
    return {
      name: "Snack Package",
      image: "snack",
      detail: "6-pack",
      status: "Delivered yesterday",
      linkLabel: "Order details",
    };
  }

  if (includesAny(question, ["cookie", "cookies", "peanut", "allergic", "过敏", "花生"])) {
    return {
      name: "Milk Cookies",
      image: "cookies",
      detail: "100g / pack",
      status: "Product information available",
      linkLabel: "Product details",
    };
  }

  return defaultProduct;
}

function stripEvidenceFeatures(answer: string) {
  return answer
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatBaselineAnswer(answer: string) {
  const cleaned = stripEvidenceFeatures(answer);
  if (cleaned.includes("\n\n")) return cleaned.split("\n\n").filter(Boolean);
  const splitIndex = cleaned.search(/\.\s+[A-Z]/);
  if (splitIndex === -1) return [cleaned];
  return [cleaned.slice(0, splitIndex + 1), cleaned.slice(splitIndex + 2)];
}

function actionStateForResponse(response: BaselineResponse): ActionState {
  if (response.actionState) return response.actionState;
  const lower = response.nextAction.toLowerCase();
  const context = `${response.variables.issueIdentified} ${response.variables.request} ${response.nextAction}`.toLowerCase();

  if (context.includes("allergen") || context.includes("product safety")) {
    return {
      kind: "informational",
      label: "Advice only",
      prompt: "This is advice only. You can ask another question or use human support if you are still unsure.",
      primaryAction: "Ask another question",
      secondaryAction: "",
      canStartRequest: false,
    };
  }

  if (lower.includes("photo") || lower.includes("evidence")) {
    return {
      kind: "needs_evidence",
      label: "Photo needed",
      prompt: "Would you like to add photo evidence now?",
      primaryAction: "Yes",
      secondaryAction: "No",
      canStartRequest: false,
    };
  }

  if (lower.includes("human") || lower.includes("review") || lower.includes("support")) {
    return {
      kind: "needs_human_review",
      label: "Human support",
      prompt: "Would you like me to connect you to human support?",
      primaryAction: "Yes",
      secondaryAction: "No",
      canStartRequest: false,
    };
  }

  return {
    kind: "ready",
    label: "Ready to request",
    prompt: `Would you like me to ${response.nextAction}?`,
    primaryAction: "Yes",
    secondaryAction: "No",
    canStartRequest: true,
  };
}

export default function TraceGuideBaseline() {
  const [participantCode, setParticipantCode] = useState("");
  const [clientSessionId, setClientSessionId] = useState("");
  const [assignedTask, setAssignedTask] = useState<TraceguideStudyTask | null>(null);
  const [activeTask, setActiveTask] = useState<TraceguideStudyTask | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "answer" | "action">("idle");
  const [question, setQuestion] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [response, setResponse] = useState<BaselineResponse | null>(null);
  const [product, setProduct] = useState<ProductContext>(defaultProduct);
  const [variables, setVariables] = useState<TraceVariables>(defaultVariables);
  const [action, setAction] = useState<ActionResponse | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const [actionReply, setActionReply] = useState("Yes");
  const [showOrdinaryDetails, setShowOrdinaryDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleTasks = useMemo(() => orderedTraceguideTasks(assignedTask?.id), [assignedTask]);
  const actionSteps = action?.steps || ["Creating request", "Adding details", "Sending to seller", "Notifying you of updates"];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const participant = params.get("pid") || params.get("participant") || "";
    const task = getTraceguideStudyTask(params.get("task") || params.get("taskId"));
    setParticipantCode(participant);
    setAssignedTask(task);
    setActiveTask(task);
    setClientSessionId(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }, []);

  function logStudyEvent(eventName: string, payload: Record<string, unknown> = {}) {
    void fetch("/api/study-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: clientSessionId,
        participantCode,
        condition: "baseline",
        taskId: typeof payload.taskId === "string" ? payload.taskId : activeTask?.id || null,
        eventName,
        payload,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    }).catch((error) => console.warn("Study event was not saved", error));
  }

  function resetToTasks() {
    setPhase("idle");
    setQuestion("");
    setInputValue("");
    setResponse(null);
    setAction(null);
    setActionStep(0);
    setShowOrdinaryDetails(false);
    setActiveTask(assignedTask);
    logStudyEvent("returned_to_task_selection");
  }

  async function askAgent(nextQuestion: string, taskOverride?: TraceguideStudyTask | null) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    const taskForRun = taskOverride === undefined ? activeTask : taskOverride;

    setQuestion(trimmed);
    setActiveTask(taskForRun || null);
    setProduct(inferProductFromQuestion(trimmed));
    setResponse(null);
    setAction(null);
    setActionStep(0);
    setPhase("loading");
    logStudyEvent("task_started", {
      question: trimmed,
      taskId: taskForRun?.id,
      scenarioSet: taskForRun?.set,
      taskCategory: taskForRun?.category,
    });

    try {
      const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 900));
      const apiRequest = fetch("/api/traceguide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          taskId: taskForRun?.id,
          participantCode,
          condition: "baseline",
        }),
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
        actionState: result.actionState,
        product: nextProduct,
      });
      logStudyEvent("answer_shown", {
        question: trimmed,
        taskId: taskForRun?.id,
        scenario: result.scenario,
        answer: stripEvidenceFeatures(result.answer || ""),
        usedLLM: result.usedLLM,
      });
    } catch (error) {
      console.error(error);
      setResponse({
        answer: "I can help with this, but I need a little more information before preparing a support request.",
        variables: defaultVariables,
        nextAction: "contact human support",
        actionState: {
          kind: "needs_human_review",
          label: "Human support",
          prompt: "Would you like me to connect you to human support?",
          primaryAction: "Yes",
          secondaryAction: "No",
          canStartRequest: false,
        },
        product: inferProductFromQuestion(trimmed),
      });
    } finally {
      setPhase("answer");
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue("");
    void askAgent(trimmed, null);
  }

  async function startRequest(nextActionOverride = response?.nextAction, replyLabel = "Yes") {
    setActionReply(replyLabel);
    setPhase("action");
    setActionStep(0);
    logStudyEvent("yes_clicked", {
      nextAction: nextActionOverride,
      variables,
      product: product.name,
    });

    try {
      const apiResponse = await fetch("/api/traceguide-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_request",
          product: product.name,
          nextAction: nextActionOverride,
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
    <main className={styles.page}>
      <section className={styles.phone} aria-label="Baseline AI customer support mobile demo">
        <StatusBar />
        <header className={styles.nav}>
          <button className={styles.backButton} type="button" aria-label="Back to task selection" onClick={resetToTasks}>
            ‹
          </button>
          <h1>AI Support</h1>
          <button className={styles.humanButton} type="button" onClick={() => logStudyEvent("human_clicked")}>
            Human
          </button>
        </header>

        <section className={styles.conversation}>
          {phase === "idle" ? (
            <AssistantRow>
              <article className={styles.welcomeCard}>
                <h2>Hi, I’m AI Support.</h2>
                <p>Choose a study task below, or type your own e-commerce support question.</p>
                <div className={styles.suggestionGrid} aria-label="Suggested questions">
                  {visibleTasks.map((item) => (
                    <button key={item.id} type="button" onClick={() => askAgent(item.prompt, item)}>
                      <span>
                        {item.id} · {item.label}
                      </span>
                      {item.prompt}
                    </button>
                  ))}
                </div>
              </article>
            </AssistantRow>
          ) : (
            <>
              <UserQuestion question={question} />
              <ProductCard
                product={product}
                onOpenDetails={() => {
                  setShowOrdinaryDetails(true);
                  logStudyEvent("ordinary_details_opened", {
                    product: product.name,
                    linkLabel: product.linkLabel,
                  });
                }}
              />
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
                    index === 0 ? <strong key={`${paragraph}-${index}`}>{paragraph}</strong> : <p key={`${paragraph}-${index}`}>{paragraph}</p>
                  )}
                </article>
              </AssistantRow>

              {phase === "answer" && (
                <AssistantRow compact>
                  <ActionPrompt
                    actionState={actionStateForResponse(response)}
                    onPrimary={(actionState) => {
                      logStudyEvent("action_primary_clicked", {
                        actionState: actionState.kind,
                        nextAction: response.nextAction,
                      });
                      if (actionState.kind === "informational") {
                        inputRef.current?.focus();
                        return;
                      }
                      void startRequest(actionState.canStartRequest ? response.nextAction : actionState.label.toLowerCase(), actionState.primaryAction);
                    }}
                    onSecondary={(actionState) => {
                      logStudyEvent("action_secondary_clicked", {
                        actionState: actionState.kind,
                        nextAction: response.nextAction,
                      });
                      inputRef.current?.focus();
                    }}
                  />
                </AssistantRow>
              )}
            </>
          )}

          {phase === "action" && (
            <>
              <div className={styles.userReply}>{actionReply}</div>
              <AssistantRow>
                <article className={styles.actionCard}>
                  <h2>{action?.requestId?.startsWith("HS") ? "I’ll send this to human support." : "I’ll prepare this request for you."}</h2>
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
                  {actionStep >= actionSteps.length - 1 && <p className={styles.requestId}>Request ID: {action?.requestId || "BASELINE-DEMO"}</p>}
                </article>
              </AssistantRow>
            </>
          )}
        </section>

        <form className={styles.inputBar} onSubmit={submitQuestion}>
          <span aria-hidden="true">◌</span>
          <input
            ref={inputRef}
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

      {showOrdinaryDetails && (
        <div className={styles.sheetBackdrop} onClick={() => setShowOrdinaryDetails(false)}>
          <section className={styles.sheet} onClick={(event) => event.stopPropagation()}>
            <div className={styles.handle} />
            <OrdinaryDetailsSheet product={product} variables={variables} onDone={() => setShowOrdinaryDetails(false)} />
          </section>
        </div>
      )}
    </main>
  );
}

function StatusBar() {
  return (
    <div className={styles.statusBar} aria-hidden="true">
      <span>9:41</span>
      <div>
        <span className={styles.signal}>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={styles.wifi}>
          <i />
          <i />
        </span>
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

function ProductCard({ product, onOpenDetails }: { product: ProductContext; onOpenDetails: () => void }) {
  return (
    <article className={styles.productCard}>
      <Image src={productImageSrc(product)} alt={product.name} width={320} height={320} priority />
      <div>
        <h2>{product.name}</h2>
        <p>
          <span>✓</span> {product.status}
        </p>
        <button type="button" onClick={onOpenDetails}>
          {product.linkLabel}
        </button>
      </div>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </article>
  );
}

function ActionPrompt({
  actionState,
  onPrimary,
  onSecondary,
}: {
  actionState: ActionState;
  onPrimary: (actionState: ActionState) => void;
  onSecondary: (actionState: ActionState) => void;
}) {
  if (actionState.kind === "informational") {
    return <div className={styles.askBubble}>{actionState.prompt}</div>;
  }

  return (
    <div>
      <div className={styles.askBubble}>{actionState.prompt}</div>
      <div className={styles.quickReplies}>
        <button type="button" onClick={() => onPrimary(actionState)}>
          {actionState.primaryAction}
        </button>
        <button type="button" onClick={() => onSecondary(actionState)}>
          {actionState.secondaryAction}
        </button>
      </div>
    </div>
  );
}

function OrdinaryDetailsSheet({ product, variables, onDone }: { product: ProductContext; variables: TraceVariables; onDone: () => void }) {
  const rows = ordinaryDetailRows(product, variables);

  return (
    <>
      <div className={styles.ordinaryDetailHeader}>
        <div>
          <h2>{product.linkLabel}</h2>
          <p>Standard product and order information available in a normal shopping app.</p>
        </div>
      </div>

      <article className={styles.ordinaryDetailCard}>
        <h3>{product.name}</h3>
        <p>{product.detail}</p>
        <div className={styles.ordinaryDetailRows}>
          {rows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className={styles.detailNote}>
        <strong>Baseline condition</strong>
        <p>You can check these ordinary details yourself, but the AI answer does not expose source anchors or editable decision variables.</p>
      </article>

      <button className={styles.fullWidthPrimary} type="button" onClick={onDone}>
        Done
      </button>
    </>
  );
}

function ordinaryDetailRows(product: ProductContext, variables: TraceVariables) {
  if (product.name.includes("Snack")) {
    return [
      { label: "Order status", value: "Delivered yesterday" },
      { label: "Evidence", value: variables.evidence },
      { label: "Issue reported", value: variables.issueIdentified },
    ];
  }

  if (product.name.includes("Cookie") || product.name.includes("Protein")) {
    return [
      { label: "Product type", value: "Packaged food" },
      { label: "Product information", value: "Ingredients and allergen notice available" },
      { label: "Customer concern", value: variables.reason },
    ];
  }

  return [
    { label: "Order status", value: product.status },
    { label: "Evidence", value: variables.evidence },
    { label: "Issue reported", value: variables.issueIdentified },
  ];
}

function AssistantRow({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={`${styles.assistantRow} ${compact ? styles.compactRow : ""}`}>
      <span className={styles.sparkle} aria-hidden="true">
        ✦
      </span>
      {children}
    </div>
  );
}
