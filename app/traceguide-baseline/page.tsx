"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "../traceguide-demo/traceguide-demo.module.css";

type ProductContext = {
  name: string;
  image: "glass-box" | "cookies" | "container-set" | "yoghurt" | "sandwich" | "snack";
  detail: string;
  status: string;
  linkLabel: string;
};

type StudyTask = {
  id: string;
  set: "1" | "2";
  category: "Clear eligible refund" | "Boundary exception" | "Insufficient evidence";
  label: string;
  text: string;
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
  confidence?: number;
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
  evidence: "Photos needed",
};

const studyTasks: StudyTask[] = [
  {
    id: "S1-T1",
    set: "1",
    category: "Clear eligible refund",
    label: "Damaged lunch box",
    text: "The glass lunch box arrived damaged. Can I return it?",
  },
  {
    id: "S1-T2",
    set: "1",
    category: "Boundary exception",
    label: "Changed mind on yoghurt",
    text: "The chilled yoghurt is unopened, but I changed my mind. Can I return it?",
  },
  {
    id: "S1-T3",
    set: "1",
    category: "Insufficient evidence",
    label: "Damaged food item",
    text: "The cookies arrived damaged. Can I get a refund?",
  },
  {
    id: "S2-T1",
    set: "2",
    category: "Clear eligible refund",
    label: "Broken container lid",
    text: "The glass food container lid arrived broken. Can I get a replacement or refund?",
  },
  {
    id: "S2-T2",
    set: "2",
    category: "Boundary exception",
    label: "Changed mind on sandwich",
    text: "The fresh sandwich is unopened, but I changed my mind. Can I return it?",
  },
  {
    id: "S2-T3",
    set: "2",
    category: "Insufficient evidence",
    label: "Snack package damaged",
    text: "The snack package arrived damaged, but I have not added a photo yet. Can I get a refund?",
  },
];

function productImageSrc(product: ProductContext) {
  if (product.image === "yoghurt") return "/traceguide-yoghurt.svg";
  if (product.image === "sandwich") return "/traceguide-sandwich.svg";
  if (product.image === "snack") return "/traceguide-snack.svg";
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
  if (q.includes("yoghurt") || q.includes("yogurt") || q.includes("chilled")) {
    return {
      name: "Chilled Yoghurt",
      image: "yoghurt",
      detail: "4 x 125g",
      status: "Delivered today",
      linkLabel: "Product details",
    };
  }

  if (q.includes("sandwich")) {
    return {
      name: "Fresh Sandwich",
      image: "sandwich",
      detail: "1 pack",
      status: "Delivered today",
      linkLabel: "Product details",
    };
  }

  if (q.includes("snack") || q.includes("package damaged")) {
    return {
      name: "Snack Pack",
      image: "snack",
      detail: "6-pack",
      status: "Delivered yesterday",
      linkLabel: "Order details",
    };
  }

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

function actionStateForResponse(response: BaselineResponse): ActionState {
  if (response.actionState) return response.actionState;

  const lower = response.nextAction.toLowerCase();

  if (lower.includes("photo") || lower.includes("evidence")) {
    return {
      kind: "needs_evidence",
      label: "Photo needed",
      prompt: "Please add a photo before I prepare the request.",
      primaryAction: "I have a photo",
      secondaryAction: "Talk to human",
      canStartRequest: false,
    };
  }

  if (lower.includes("human") || lower.includes("review")) {
    return {
      kind: "needs_human_review",
      label: "Review needed",
      prompt: "This case needs human review before a request can be started.",
      primaryAction: "Talk to human",
      secondaryAction: "Ask another question",
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
  const [activeTask, setActiveTask] = useState<StudyTask | null>(null);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const participant = params.get("pid") || params.get("participant") || "";
    const taskId = params.get("task") || params.get("taskId") || "";
    const nextTask = studyTasks.find((task) => task.id.toLowerCase() === taskId.toLowerCase()) || null;
    setParticipantCode(participant);
    setClientSessionId(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    if (nextTask) setActiveTask(nextTask);
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

  async function askAgent(nextQuestion: string, taskOverride?: StudyTask | null) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    const taskForRun = taskOverride === null ? null : taskOverride ?? activeTask;

    setQuestion(trimmed);
    if (taskOverride) setActiveTask(taskOverride);
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
      const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 1100));
      const apiRequest = fetch("/api/traceguide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, taskId: taskForRun?.id }),
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
        answer: result.answer,
        usedLLM: result.usedLLM,
      });
    } catch (error) {
      console.error(error);
      setResponse({
        answer:
          "I can help with this order, but I need a little more information before I prepare a support request.",
        variables: defaultVariables,
        nextAction: "contact human support",
        actionState: {
          kind: "needs_human_review",
          label: "Review needed",
          prompt: "This case needs human review before a request can be started.",
          primaryAction: "Talk to human",
          secondaryAction: "Ask another question",
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
    setActiveTask(null);
    void askAgent(inputValue, null);
    setInputValue("");
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
                  {(activeTask ? [activeTask] : studyTasks).map((item) => (
                    <button key={item.id} type="button" onClick={() => askAgent(item.text, item)}>
                      <span>{item.label}</span>
                      {item.text}
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
                    {(() => {
                      const actionState = actionStateForResponse(response);

                      return (
                        <>
                          <div className={styles.actionStatusChip}>{actionState.label}</div>
                          <div className={styles.askBubble}>{actionState.prompt}</div>
                          <div className={styles.quickReplies}>
                            <button
                              type="button"
                              onClick={
                                actionState.canStartRequest
                                  ? () => startRequest()
                                  : () => {
                                      logStudyEvent("action_primary_clicked", {
                                        actionState: actionState.kind,
                                        nextAction: response.nextAction,
                                      });

                                      if (actionState.primaryAction.toLowerCase().includes("human")) {
                                        void startRequest("contact human support", actionState.primaryAction);
                                        return;
                                      }

                                      inputRef.current?.focus();
                                    }
                              }
                            >
                              {actionState.primaryAction}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                logStudyEvent("action_secondary_clicked", {
                                  actionState: actionState.kind,
                                  nextAction: response.nextAction,
                                });

                                if (actionState.secondaryAction.toLowerCase().includes("human")) {
                                  void startRequest("contact human support", actionState.secondaryAction);
                                  return;
                                }

                                inputRef.current?.focus();
                              }}
                            >
                              {actionState.secondaryAction}
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
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
            <OrdinaryDetailsSheet
              product={product}
              variables={variables}
              onDone={() => setShowOrdinaryDetails(false)}
            />
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

function ProductCard({
  product,
  onOpenDetails,
}: {
  product: ProductContext;
  onOpenDetails: () => void;
}) {
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

function OrdinaryDetailsSheet({
  product,
  variables,
  onDone,
}: {
  product: ProductContext;
  variables: TraceVariables;
  onDone: () => void;
}) {
  const rows = ordinaryDetailRows(product, variables);

  return (
    <>
      <div className={styles.ordinaryDetailHeader}>
        <div>
          <h2>{product.linkLabel}</h2>
          <p>Standard product and order information available in a normal shopping app.</p>
        </div>
        <button className={styles.donePill} type="button" onClick={onDone}>
          Done
        </button>
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
        <p>
          You can check these ordinary details yourself, but the AI answer does not expose source
          anchors or editable decision variables.
        </p>
      </article>

      <button className={styles.fullWidthPrimary} type="button" onClick={onDone}>
        Done
      </button>
    </>
  );
}

function ordinaryDetailRows(product: ProductContext, variables: TraceVariables) {
  const name = product.name.toLowerCase();
  if (name.includes("yoghurt")) {
    return [
      { label: "Order status", value: "Delivered today" },
      { label: "Product type", value: "Chilled food" },
      { label: "Return rule", value: "Change-of-mind returns are usually excluded" },
      { label: "Issue reported", value: variables.reason },
    ];
  }

  if (name.includes("sandwich")) {
    return [
      { label: "Order status", value: "Delivered today" },
      { label: "Product type", value: "Fresh food" },
      { label: "Return rule", value: "Perishable food has return exceptions" },
      { label: "Issue reported", value: variables.reason },
    ];
  }

  if (name.includes("snack")) {
    return [
      { label: "Order status", value: "Delivered yesterday" },
      { label: "Evidence", value: variables.evidence },
      { label: "Store note", value: "Photo may be needed before review" },
      { label: "Issue reported", value: variables.issueIdentified },
    ];
  }

  if (name.includes("cookie")) {
    return [
      { label: "Order status", value: product.status },
      { label: "Product type", value: "Packaged food" },
      { label: "Evidence", value: variables.evidence },
      { label: "Store note", value: "Photos help the seller review damage" },
    ];
  }

  if (name.includes("container")) {
    return [
      { label: "Order status", value: product.status },
      { label: "Product type", value: "Reusable home product" },
      { label: "Support option", value: "Replacement or refund may be reviewed" },
      { label: "Issue reported", value: variables.issueIdentified },
    ];
  }

  return [
    { label: "Order status", value: product.status },
    { label: "Product type", value: product.detail },
    { label: "Support option", value: variables.request },
    { label: "Issue reported", value: variables.issueIdentified },
  ];
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
