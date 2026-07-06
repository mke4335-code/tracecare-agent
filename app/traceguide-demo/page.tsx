"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import styles from "./traceguide-demo.module.css";
import {
  getTraceguideStudyTask,
  orderedTraceguideTasks,
  type TraceguideStudyTask,
} from "../../lib/traceguide-study-config";

type Source = {
  id: string;
  number: number;
  title: string;
  category: string;
  excerpt: string;
  relevance: "High relevance" | "Medium relevance" | "Relevant";
  matchedAnswer?: string;
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

type ProductContext = {
  name: string;
  image: "glass-box" | "cookies" | "container-set" | "coffee-maker" | "protein-bar" | "yoghurt" | "sandwich" | "snack";
  detail: string;
  status: string;
  linkLabel: string;
};

type TraceResponse = {
  runId?: string;
  answer: string;
  confidence: number;
  confidenceReason?: string;
  sources: Source[];
  sourceTags: string[];
  variables: TraceVariables;
  nextAction: string;
  actionState?: ActionState;
  product: ProductContext;
  loadingTitle: string;
  loadingSteps: string[];
  scenario?: string;
  usedLLM?: boolean;
};

type ActionResponse = {
  requestId: string;
  steps: string[];
};

type SheetMode = "sourceOverview" | "sourcesUsed" | "sourceDetails" | "variables" | "evidence" | "ordinaryDetails" | null;

const defaultProduct: ProductContext = {
  name: "Glass Lunch Box",
  image: "glass-box",
  detail: "1 item",
  status: "Delivered 2 days ago",
  linkLabel: "Order details",
};

const fallbackResponse: TraceResponse = {
  answer:
    "Yes, this item is likely eligible for a return and refund.\n\nYour order is still within the return window according to the return policy [1]. The order status shows it was delivered recently [2]. Please keep the item and packaging if possible.",
  confidence: 88,
  sourceTags: ["Return policy", "Order status", "Store policy"],
  variables: {
    issueIdentified: "Damaged item",
    request: "Return & Refund",
    reason: "Item arrived damaged",
    evidence: "Photos provided",
  },
  nextAction: "start a refund request",
  product: defaultProduct,
  loadingTitle: "Checking refund eligibility...",
  loadingSteps: ["Understanding your request", "Checking order status", "Reading return policy", "Preparing answer"],
  sources: [
    {
      id: "return-policy",
      number: 1,
      title: "Return and refund policy",
      category: "Return policy",
      excerpt: "Items damaged during delivery can usually be returned within 30 days of delivery. Keep the item and packaging if possible.",
      relevance: "High relevance",
      matchedAnswer: "return window according to the return policy",
    },
    {
      id: "order-status",
      number: 2,
      title: "Order status",
      category: "Order status",
      excerpt: "Your order for Glass Lunch Box was delivered 2 days ago. The return window is still open.",
      relevance: "High relevance",
      matchedAnswer: "order status shows it was delivered recently",
    },
  ],
};

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function inferProduct(prompt: string): ProductContext {
  if (includesAny(prompt, ["protein bar", "蛋白棒"])) {
    return {
      name: "Protein Bar",
      image: "protein-bar",
      detail: "60g / bar",
      status: "Product information available",
      linkLabel: "Product details",
    };
  }

  if (includesAny(prompt, ["snack", "package damaged", "零食", "包装"])) {
    return {
      name: "Snack Package",
      image: "snack",
      detail: "6-pack",
      status: "Delivered yesterday",
      linkLabel: "Order details",
    };
  }

  if (includesAny(prompt, ["cookie", "cookies", "peanut", "allergic", "过敏", "花生"])) {
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

function inferVariables(prompt: string): TraceVariables {
  if (includesAny(prompt, ["protein bar", "cookie", "cookies", "peanut", "allergic", "过敏", "花生"])) {
    return {
      issueIdentified: "Allergen concern",
      request: "Product safety advice",
      reason: "Customer is allergic to peanuts",
      evidence: "Ingredient data available",
    };
  }

  if (includesAny(prompt, ["snack", "package damaged", "零食", "包装"])) {
    return {
      issueIdentified: "Damaged package",
      request: "Return & Refund",
      reason: "Package damage reported",
      evidence: "Photo not added",
    };
  }

  return fallbackResponse.variables;
}

function inferLoadingTitle(prompt: string) {
  if (includesAny(prompt, ["peanut", "allergic", "protein", "cookie", "过敏", "花生"])) return "Checking product safety...";
  if (includesAny(prompt, ["snack", "package", "零食", "包装"])) return "Checking evidence needed...";
  return "Checking refund eligibility...";
}

function inferLoadingSteps(prompt: string) {
  if (includesAny(prompt, ["peanut", "allergic", "protein", "cookie", "过敏", "花生"])) {
    return ["Understanding allergy concern", "Reading ingredients", "Checking safety rule", "Preparing answer"];
  }

  if (includesAny(prompt, ["snack", "package", "零食", "包装"])) {
    return ["Understanding your issue", "Checking order status", "Reading evidence rule", "Preparing answer"];
  }

  return ["Understanding your request", "Checking order status", "Reading return policy", "Preparing answer"];
}

function productImageSrc(product: ProductContext) {
  if (product.image === "protein-bar") return "/traceguide-protein-bar.jpg";
  if (product.image === "snack") return "/traceguide-snack.jpg";
  if (product.image === "cookies") return "/traceguide-cookie.png";
  if (product.image === "container-set") return "/traceguide-container-set.png";
  return "/traceguide-glass-lunch-box.png";
}

function actionStateForResponse(response: TraceResponse): ActionState {
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

  if (lower.includes("human") || lower.includes("support") || lower.includes("review")) {
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

export default function TraceGuideDemo() {
  const [participantCode, setParticipantCode] = useState("");
  const [clientSessionId, setClientSessionId] = useState("");
  const [assignedTask, setAssignedTask] = useState<TraceguideStudyTask | null>(null);
  const [activeTask, setActiveTask] = useState<TraceguideStudyTask | null>(null);
  const [question, setQuestion] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [response, setResponse] = useState<TraceResponse | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "answer" | "rechecking" | "action">("idle");
  const [loadingStep, setLoadingStep] = useState(0);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [variables, setVariables] = useState<TraceVariables>(fallbackResponse.variables);
  const [userApproved, setUserApproved] = useState(false);
  const [action, setAction] = useState<ActionResponse | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const [actionReply, setActionReply] = useState("Yes");
  const [previewProduct, setPreviewProduct] = useState<ProductContext>(defaultProduct);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleTasks = useMemo(() => orderedTraceguideTasks(assignedTask?.id), [assignedTask]);
  const activeResponse = response || fallbackResponse;
  const primarySource = selectedSource || activeResponse.sources[0];
  const activeProduct = response?.product || previewProduct;
  const activeLoadingSteps = response?.loadingSteps?.length ? response.loadingSteps : inferLoadingSteps(question);
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
        condition: "traceguide",
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
    setUserApproved(false);
    setActionStep(0);
    setSheetMode(null);
    setSelectedSource(null);
    setActiveTask(assignedTask);
    logStudyEvent("returned_to_task_selection");
  }

  async function runAssessment(
    prompt: string,
    nextVariables: TraceVariables,
    nextPhase: "loading" | "rechecking",
    taskOverride?: TraceguideStudyTask | null
  ) {
    const taskForRun = taskOverride === undefined ? activeTask : taskOverride;
    setPhase(nextPhase);
    setLoadingStep(0);
    setSheetMode(null);
    setSelectedSource(null);
    setQuestion(prompt);
    setPreviewProduct(inferProduct(prompt));
    setActiveTask(taskForRun || null);

    if (nextPhase === "loading") {
      setResponse(null);
      setAction(null);
      setUserApproved(false);
      logStudyEvent("task_started", {
        question: prompt,
        taskId: taskForRun?.id,
        scenarioSet: taskForRun?.set,
        taskCategory: taskForRun?.category,
      });
    } else {
      logStudyEvent("variables_saved_recheck_started", { question: prompt, variables: nextVariables });
    }

    const steps = inferLoadingSteps(prompt);
    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, steps.length - 1));
    }, 600);

    try {
      const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 1500));
      const apiRequest = fetch("/api/traceguide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          taskId: taskForRun?.id,
          variables: nextVariables,
          participantCode,
          condition: "traceguide",
        }),
      });
      const [apiResponse] = await Promise.all([apiRequest, minimumDelay]);
      const result = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(result.error || "TraceGuide request failed.");

      const normalised = normaliseResponse(result, prompt);
      setResponse(normalised);
      setVariables(normalised.variables);
      logStudyEvent(nextPhase === "rechecking" ? "updated_answer_shown" : "answer_shown", {
        question: prompt,
        taskId: taskForRun?.id,
        scenario: normalised.scenario,
        confidence: normalised.confidence,
        usedLLM: normalised.usedLLM,
        answer: normalised.answer,
        sources: normalised.sources,
      });
    } catch (error) {
      console.error(error);
      setResponse(fallbackResponse);
      setVariables(fallbackResponse.variables);
    } finally {
      window.clearInterval(interval);
      setLoadingStep(steps.length);
      setPhase("answer");
    }
  }

  function normaliseResponse(result: Partial<TraceResponse>, prompt: string): TraceResponse {
    return {
      answer: result.answer || fallbackResponse.answer,
      confidence: typeof result.confidence === "number" ? result.confidence : 88,
      confidenceReason: result.confidenceReason,
      sources: result.sources?.length ? result.sources : fallbackResponse.sources,
      sourceTags: result.sourceTags?.length ? result.sourceTags : fallbackResponse.sourceTags,
      variables: result.variables || fallbackResponse.variables,
      nextAction: result.nextAction || "start a support request",
      actionState: result.actionState,
      product: result.product || inferProduct(prompt),
      loadingTitle: result.loadingTitle || inferLoadingTitle(prompt),
      loadingSteps: result.loadingSteps?.length ? result.loadingSteps : inferLoadingSteps(prompt),
      scenario: result.scenario,
      usedLLM: result.usedLLM,
      runId: result.runId,
    };
  }

  function startSuggestedQuestion(task: TraceguideStudyTask) {
    setInputValue("");
    void runAssessment(task.prompt, inferVariables(task.prompt), "loading", task);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue("");
    void runAssessment(trimmed, inferVariables(trimmed), "loading", null);
  }

  function openSource(source: Source) {
    setSelectedSource(source);
    setSheetMode("sourceOverview");
    logStudyEvent("source_anchor_opened", {
      sourceIndex: source.number,
      sourceTitle: source.title,
      sourceCategory: source.category,
    });
  }

  function renderAnswer(answer: string, sources: Source[]) {
    return answer.split(/(\[\d+\])/g).map((part, index) => {
      const citation = part.match(/^\[(\d+)\]$/);
      if (!citation) return <span key={`${part}-${index}`}>{part}</span>;
      const source = sources.find((item) => item.number === Number(citation[1]));
      if (!source) return <span key={`${part}-${index}`}>{part}</span>;
      return (
        <button
          key={`${part}-${index}`}
          className={styles.citation}
          type="button"
          onClick={() => openSource(source)}
          aria-label={`Open ${source.category} source ${source.number}`}
        >
          {part}
        </button>
      );
    });
  }

  function updateVariable(key: keyof TraceVariables, value: string) {
    setVariables((current) => ({ ...current, [key]: value }));
  }

  async function saveAndRecheck() {
    setSheetMode(null);
    await runAssessment(question, variables, "rechecking", activeTask);
  }

  async function startRequest(nextActionOverride = activeResponse.nextAction, replyLabel = "Yes") {
    setUserApproved(true);
    setActionReply(replyLabel);
    setPhase("action");
    setActionStep(0);
    logStudyEvent("yes_clicked", {
      nextAction: nextActionOverride,
      variables,
      product: activeProduct.name,
    });

    try {
      const apiResponse = await fetch("/api/traceguide-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_request",
          product: activeProduct.name,
          nextAction: nextActionOverride,
          variables,
          sources: activeResponse.sources.map((source) => source.title),
        }),
      });
      const result = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(result.error || "Action failed.");
      setAction(result);
    } catch (error) {
      console.error(error);
      setAction({
        requestId: "RF-DEMO",
        steps: ["Preparing support request", "Attaching relevant details", "Sending request to seller", "Notifying you of updates"],
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
      <section className={styles.phone} aria-label="TraceGuide Agent mobile demo">
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
                <h2>Hi, I’m TraceGuide Support.</h2>
                <p>Choose a study task below, or type your own e-commerce support question.</p>
                <div className={styles.suggestionGrid} aria-label="Suggested questions">
                  {visibleTasks.map((item) => (
                    <button key={item.id} type="button" onClick={() => startSuggestedQuestion(item)}>
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
                product={activeProduct}
                onOpenDetails={() => {
                  setSheetMode("ordinaryDetails");
                  logStudyEvent("ordinary_details_opened", {
                    product: activeProduct.name,
                    linkLabel: activeProduct.linkLabel,
                  });
                }}
              />
            </>
          )}

          {(phase === "loading" || phase === "rechecking") && (
            <AssistantRow>
              <StatusCard
                title={phase === "rechecking" ? "Rechecking assessment..." : inferLoadingTitle(question)}
                subtitle={
                  phase === "rechecking"
                    ? "I’m checking the updated details against the order and policy."
                    : "This usually takes less than 30 seconds."
                }
                activeStep={loadingStep}
                steps={activeLoadingSteps}
              />
            </AssistantRow>
          )}

          {(phase === "answer" || phase === "action") && (
            <>
              <AssistantRow>
                <article className={styles.answerCard}>
                  <div className={styles.answerHeader}>
                    <strong>{activeResponse.answer.split("\n\n")[0]}</strong>
                  </div>
                  <p>{renderAnswer(activeResponse.answer.split("\n\n").slice(1).join("\n\n"), activeResponse.sources)}</p>
                  <div className={styles.sourceTags} aria-label="Sources used for this answer">
                    {activeResponse.sourceTags.slice(0, 3).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <hr />
                  <div className={styles.answerActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setSheetMode("sourcesUsed");
                        logStudyEvent("view_sources_clicked", {
                          sources: activeResponse.sources.map((source) => source.title),
                        });
                      }}
                    >
                      View sources
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSheetMode("variables");
                        logStudyEvent("view_ai_understanding_clicked", { variables });
                      }}
                    >
                      View AI understanding
                    </button>
                  </div>
                </article>
              </AssistantRow>

              {!userApproved && (
                <AssistantRow compact>
                  <ActionPrompt
                    actionState={actionStateForResponse(activeResponse)}
                    onPrimary={(actionState) => {
                      logStudyEvent("action_primary_clicked", {
                        actionState: actionState.kind,
                        nextAction: activeResponse.nextAction,
                      });

                      if (actionState.kind === "needs_evidence") {
                        setSheetMode("evidence");
                        return;
                      }

                      if (actionState.kind === "informational") {
                        inputRef.current?.focus();
                        return;
                      }

                      void startRequest(actionState.canStartRequest ? activeResponse.nextAction : actionState.label.toLowerCase(), actionState.primaryAction);
                    }}
                    onSecondary={(actionState) => {
                      logStudyEvent("action_secondary_clicked", {
                        actionState: actionState.kind,
                        nextAction: activeResponse.nextAction,
                      });
                      inputRef.current?.focus();
                    }}
                  />
                </AssistantRow>
              )}
            </>
          )}

          {userApproved && (
            <>
              <div className={styles.userReply}>{actionReply}</div>
              <AssistantRow>
                <article className={styles.actionCard}>
                  <h2>{action?.requestId?.startsWith("HS") ? "I’ll send this to human support." : "Great, I’ll prepare this request for you."}</h2>
                  <p>Preparing the request with your order details and checked sources...</p>
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
                  {actionStep >= actionSteps.length - 1 && <p className={styles.requestId}>Request ID: {action?.requestId || "RF-DEMO"}</p>}
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

      {sheetMode && (
        <div className={styles.sheetBackdrop} onClick={() => setSheetMode(null)}>
          <section className={styles.sheet} onClick={(event) => event.stopPropagation()}>
            <div className={styles.handle} />
            {sheetMode === "sourceOverview" && primarySource && (
              <SourceOverview source={primarySource} onViewDetails={() => setSheetMode("sourceDetails")} onDone={() => setSheetMode(null)} />
            )}
            {sheetMode === "sourcesUsed" && (
              <SourcesUsed sources={activeResponse.sources} onDone={() => setSheetMode(null)} onOpenSource={openSource} />
            )}
            {sheetMode === "sourceDetails" && primarySource && (
              <SourceDetails source={primarySource} onDone={() => setSheetMode(null)} />
            )}
            {sheetMode === "variables" && (
              <VariablesSheet variables={variables} updateVariable={updateVariable} onCancel={() => setSheetMode(null)} onSave={saveAndRecheck} />
            )}
            {sheetMode === "evidence" && (
              <EvidenceSheet
                onCancel={() => setSheetMode(null)}
                onAddEvidence={async () => {
                  const nextVariables = { ...variables, evidence: "Photos provided" };
                  setVariables(nextVariables);
                  setSheetMode(null);
                  await runAssessment(question, nextVariables, "rechecking", activeTask);
                }}
              />
            )}
            {sheetMode === "ordinaryDetails" && (
              <OrdinaryDetailsSheet product={activeProduct} variables={variables} onDone={() => setSheetMode(null)} />
            )}
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

function StatusCard({ title, subtitle, steps, activeStep }: { title: string; subtitle: string; steps: string[]; activeStep: number }) {
  return (
    <article className={styles.statusCard}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <div className={styles.statusSteps}>
        {steps.map((step, index) => {
          const state = index < activeStep ? styles.done : index === activeStep ? styles.active : styles.pending;
          return (
            <div className={state} key={step}>
              <span>{index < activeStep ? "✓" : index + 1}</span>
              <strong>{step}</strong>
              <em>{index < activeStep ? "Done" : index === activeStep ? "In progress" : "Pending"}</em>
            </div>
          );
        })}
      </div>
      <div className={styles.privacyNote}>
        <span>♢</span>
        <p>We’ll only use relevant order, product and policy details to support this answer.</p>
      </div>
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

function SourceOverview({ source, onViewDetails, onDone }: { source: Source; onViewDetails: () => void; onDone: () => void }) {
  return (
    <>
      <div className={styles.sheetTitleRow}>
        <span className={styles.sheetIcon}>▤</span>
        <div className={styles.simpleSheetHeader}>
          <h2>Source overview</h2>
          <p>
            You tapped: {source.category.toLowerCase()} <b>[{source.number}]</b>
          </p>
        </div>
        <button className={styles.donePill} type="button" onClick={onDone}>
          Done
        </button>
      </div>
      <article className={styles.overviewSourceCard}>
        <h3>{source.title}</h3>
        <p>{source.excerpt}</p>
        <span className={styles.relevancePill}>{source.relevance}</span>
      </article>
      <div className={styles.sheetActions}>
        <button type="button" onClick={onViewDetails}>
          View details
        </button>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}

function SourcesUsed({ sources, onDone, onOpenSource }: { sources: Source[]; onDone: () => void; onOpenSource: (source: Source) => void }) {
  return (
    <>
      <div className={styles.simpleSheetHeader}>
        <h2>Sources used</h2>
        <p>These are the product, order or policy records used for this answer.</p>
      </div>
      <div className={styles.sourceList}>
        {sources.slice(0, 3).map((source) => (
          <button key={source.id} type="button" onClick={() => onOpenSource(source)}>
            <span>SOURCE {source.number}</span>
            <h3>{source.title}</h3>
            <p>{source.excerpt}</p>
          </button>
        ))}
      </div>
      <button className={styles.fullWidthPrimary} type="button" onClick={onDone}>
        Done
      </button>
    </>
  );
}

function SourceDetails({ source, onDone }: { source: Source; onDone: () => void }) {
  return (
    <>
      <div className={styles.simpleSheetHeader}>
        <h2>Source details</h2>
        <p>
          Source [{source.number}] · {source.category}
        </p>
      </div>
      <article className={styles.detailCard}>
        <h3>{source.title}</h3>
        <p>{source.excerpt}</p>
      </article>
      {source.matchedAnswer && (
        <article className={styles.detailCard}>
          <h3>Used for this answer</h3>
          <p>{source.matchedAnswer}</p>
        </article>
      )}
      <article className={styles.detailNote}>
        <strong>Source content cannot be edited.</strong>
        <p>You can check it, but only your own situation details can be corrected.</p>
      </article>
      <button className={styles.fullWidthPrimary} type="button" onClick={onDone}>
        Done
      </button>
    </>
  );
}

function VariablesSheet({
  variables,
  updateVariable,
  onCancel,
  onSave,
}: {
  variables: TraceVariables;
  updateVariable: (key: keyof TraceVariables, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className={styles.simpleSheetHeader}>
        <h2>Check AI understanding</h2>
        <p>These are the details the agent used for this answer. You can correct your situation details before it checks again.</p>
      </div>
      <div className={styles.variableList}>
        <VariableSelect
          label="Issue identified"
          value={variables.issueIdentified}
          options={["Allergen concern", "Damaged item", "Damaged package"]}
          onChange={(value) => updateVariable("issueIdentified", value)}
        />
        <VariableSelect
          label="Request"
          value={variables.request}
          options={["Product safety advice", "Return & Refund", "Human support"]}
          onChange={(value) => updateVariable("request", value)}
        />
        <VariableSelect
          label="Reason"
          value={variables.reason}
          options={["Customer is allergic to peanuts", "Item arrived damaged", "Package damage reported"]}
          onChange={(value) => updateVariable("reason", value)}
        />
        <VariableSelect
          label="Evidence"
          value={variables.evidence}
          options={["Ingredient data available", "Photos provided", "Photo not added"]}
          onChange={(value) => updateVariable("evidence", value)}
        />
      </div>
      <div className={styles.sheetActions}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onSave}>
          Save and recheck
        </button>
      </div>
    </>
  );
}

function VariableSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const resolvedOptions = options.includes(value) ? options : [value, ...options];
  return (
    <label className={styles.variableRow}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {resolvedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EvidenceSheet({ onCancel, onAddEvidence }: { onCancel: () => void; onAddEvidence: () => void }) {
  return (
    <>
      <div className={styles.simpleSheetHeader}>
        <h2>Add photo evidence</h2>
        <p>This prototype simulates adding a photo so the agent can recheck the request.</p>
      </div>
      <article className={styles.detailNote}>
        <strong>Simulation only</strong>
        <p>No real photo is uploaded. The prototype updates the evidence status to “Photos provided”.</p>
      </article>
      <div className={styles.sheetActions}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onAddEvidence}>
          Add photo evidence
        </button>
      </div>
    </>
  );
}

function OrdinaryDetailsSheet({ product, variables, onDone }: { product: ProductContext; variables: TraceVariables; onDone: () => void }) {
  const rows = [
    { label: "Product", value: product.name },
    { label: "Status", value: product.status },
    { label: "Issue", value: variables.issueIdentified },
    { label: "Evidence", value: variables.evidence },
  ];

  return (
    <>
      <div className={styles.simpleSheetHeader}>
        <h2>{product.linkLabel}</h2>
        <p>Standard product and order information available in a normal shopping app.</p>
      </div>
      <article className={styles.ordinaryDetailCard}>
        <h3>{product.name}</h3>
        <div className={styles.ordinaryDetailRows}>
          {rows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </article>
      <button className={styles.fullWidthPrimary} type="button" onClick={onDone}>
        Done
      </button>
    </>
  );
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
