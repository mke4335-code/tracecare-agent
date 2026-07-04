"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./traceguide-demo.module.css";

type Source = {
  id: string;
  number: number;
  title: string;
  category: string;
  excerpt: string;
  matchScore?: number;
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

type SheetMode = "sourceOverview" | "sourcesUsed" | "sourceDetails" | "variables" | "ordinaryDetails" | null;

const defaultQuestion = "The glass lunch box arrived damaged. Can I return it?";

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

const defaultProduct: ProductContext = {
  name: "Glass Lunch Box",
  image: "glass-box",
  detail: "1 item",
  status: "Delivered 2 days ago",
  linkLabel: "Order details",
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

const fallbackResponse: TraceResponse = {
  answer:
    "Yes, this item is likely eligible for a return and refund.\n\nYour order is still within the return window according to the return policy [1]. The order status shows it was delivered recently [2]. Please keep the item and packaging if possible.",
  confidence: 88,
  sourceTags: ["Return policy", "Order status", "Store policy"],
  variables: {
    issueIdentified: "Damaged item",
    request: "Return & Refund",
    reason: "Item arrived damaged",
    evidence: "Photos needed",
  },
  nextAction: "start a refund request",
  product: defaultProduct,
  loadingTitle: "Checking refund eligibility...",
  loadingSteps: [
    "Understanding your request",
    "Checking order status",
    "Reading return policy",
    "Preparing answer",
  ],
  sources: [
    {
      id: "return-policy",
      number: 1,
      title: "Return and refund policy",
      category: "Return policy",
      excerpt:
        "Items damaged during delivery can usually be returned within 30 days of delivery. Keep the item and packaging if possible.",
      relevance: "High relevance",
      matchedAnswer: "return window according to the return policy",
    },
    {
      id: "order-status",
      number: 2,
      title: "Order status",
      category: "Order status",
      excerpt:
        "Your order for Glass Lunch Box was delivered 2 days ago. The return window is still open.",
      relevance: "High relevance",
      matchedAnswer: "order status shows it was delivered recently",
    },
    {
      id: "store-note",
      number: 3,
      title: "Store return note",
      category: "Store policy",
      excerpt:
        "The store may ask for a photo when an item arrives damaged, so the request can be reviewed faster.",
      relevance: "Medium relevance",
      matchedAnswer: "keep the item and packaging if possible",
    },
  ],
};

const defaultLoadingSteps = [
  "Understanding your request",
  "Checking order status",
  "Reading return policy",
  "Preparing answer",
];

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function inferProduct(prompt: string): ProductContext {
  if (includesAny(prompt, ["yoghurt", "yogurt", "chilled", "酸奶", "冷藏"])) {
    return {
      name: "Chilled Yoghurt",
      image: "yoghurt",
      detail: "4 x 125g",
      status: "Delivered today",
      linkLabel: "Product details",
    };
  }

  if (includesAny(prompt, ["sandwich", "三明治"])) {
    return {
      name: "Fresh Sandwich",
      image: "sandwich",
      detail: "1 pack",
      status: "Delivered today",
      linkLabel: "Product details",
    };
  }

  if (includesAny(prompt, ["snack", "snacks", "package damaged", "零食", "包装"])) {
    return {
      name: "Snack Pack",
      image: "snack",
      detail: "6-pack",
      status: "Delivered yesterday",
      linkLabel: "Order details",
    };
  }

  if (includesAny(prompt, ["cookie", "cookies", "biscuit", "food", "allergen", "peanut", "饼干", "食品", "过敏", "花生"])) {
    return {
      name: "Milk Cookies",
      image: "cookies",
      detail: "100g / pack",
      status: includesAny(prompt, ["allergen", "peanut", "过敏", "花生"])
        ? "Product information available"
        : "Delivered 2 days ago",
      linkLabel: "Product details",
    };
  }

  if (includesAny(prompt, ["late", "delay", "delayed", "compensation", "missing", "accessory", "延迟", "补偿", "缺少", "配件"])) {
    return {
      name: "Glass Food Containers Set",
      image: "container-set",
      detail: "4-piece set",
      status: includesAny(prompt, ["late", "delay", "delayed", "compensation", "延迟", "补偿"])
        ? "Arrived 2 days late"
        : "Delivered today",
      linkLabel: includesAny(prompt, ["late", "delay", "delayed", "compensation", "延迟", "补偿"])
        ? "Delivery details"
        : "Order details",
    };
  }

  return defaultProduct;
}

function inferVariables(prompt: string): TraceVariables {
  if (includesAny(prompt, ["yoghurt", "yogurt", "chilled", "酸奶", "冷藏"])) {
    return {
      issueIdentified: "Change-of-mind chilled food return",
      request: "Return & Refund",
      reason: "Customer changed their mind",
      evidence: "No quality issue reported",
    };
  }

  if (includesAny(prompt, ["sandwich", "三明治"])) {
    return {
      issueIdentified: "Change-of-mind fresh food return",
      request: "Return & Refund",
      reason: "Customer changed their mind",
      evidence: "No quality issue reported",
    };
  }

  if (includesAny(prompt, ["snack", "package damaged", "零食", "包装破损"])) {
    return {
      issueIdentified: "Damaged package",
      request: "Return & Refund",
      reason: "Package damage reported",
      evidence: "Photo not added",
    };
  }

  if (includesAny(prompt, ["allergen", "peanut", "过敏", "花生"])) {
    return {
      issueIdentified: "Allergen concern",
      request: "Product safety advice",
      reason: "Customer is allergic to peanuts",
      evidence: "Ingredient data available",
    };
  }

  if (includesAny(prompt, ["late", "delay", "delayed", "compensation", "延迟", "补偿"])) {
    return {
      issueIdentified: "Late delivery",
      request: "Compensation",
      reason: "Delivered after promised date",
      evidence: "Order timeline available",
    };
  }

  if (includesAny(prompt, ["missing", "accessory", "缺少", "少了", "配件"])) {
    return {
      issueIdentified: "Missing accessory",
      request: "Replacement or refund",
      reason: "Accessory missing from package",
      evidence: "Photos needed",
    };
  }

  if (includesAny(prompt, ["food", "cookie", "cookies", "biscuit", "饼干", "食品", "吃的"])) {
    return {
      issueIdentified: "Damaged food item",
      request: "Return & Refund",
      reason: "Food arrived damaged",
      evidence: "Photos needed",
    };
  }

  return fallbackResponse.variables;
}

function actionStateForResponse(response: TraceResponse): ActionState {
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

function inferLoadingTitle(prompt: string) {
  if (includesAny(prompt, ["yoghurt", "yogurt", "chilled", "酸奶", "冷藏"])) return "Checking chilled food return rules...";
  if (includesAny(prompt, ["sandwich", "三明治"])) return "Checking fresh food return rules...";
  if (includesAny(prompt, ["snack", "package damaged", "零食", "包装破损"])) return "Checking evidence needed...";
  if (includesAny(prompt, ["allergen", "peanut", "过敏", "花生"])) return "Checking product safety...";
  if (includesAny(prompt, ["late", "delay", "delayed", "compensation", "延迟", "补偿"])) return "Checking delivery compensation...";
  if (includesAny(prompt, ["missing", "accessory", "缺少", "少了", "配件"])) return "Checking support options...";
  if (includesAny(prompt, ["food", "cookie", "cookies", "biscuit", "饼干", "食品", "吃的"])) return "Checking food return options...";
  return "Checking refund eligibility...";
}

function inferLoadingSteps(prompt: string) {
  if (includesAny(prompt, ["yoghurt", "yogurt", "chilled", "酸奶", "冷藏"])) {
    return ["Understanding your request", "Checking product type", "Reading food return exception", "Preparing answer"];
  }

  if (includesAny(prompt, ["sandwich", "三明治"])) {
    return ["Understanding your request", "Checking product type", "Reading fresh food exception", "Preparing answer"];
  }

  if (includesAny(prompt, ["snack", "package damaged", "零食", "包装破损"])) {
    return ["Understanding your issue", "Checking order status", "Reading evidence rule", "Preparing answer"];
  }

  if (includesAny(prompt, ["allergen", "peanut", "过敏", "花生"])) {
    return ["Understanding allergy concern", "Reading ingredients", "Checking safety rule", "Preparing answer"];
  }

  if (includesAny(prompt, ["late", "delay", "delayed", "compensation", "延迟", "补偿"])) {
    return ["Understanding your request", "Checking delivery timeline", "Reading compensation policy", "Preparing answer"];
  }

  if (includesAny(prompt, ["missing", "accessory", "缺少", "少了", "配件"])) {
    return ["Understanding your issue", "Checking order contents", "Reading support rule", "Preparing answer"];
  }

  if (includesAny(prompt, ["food", "cookie", "cookies", "biscuit", "饼干", "食品", "吃的"])) {
    return ["Understanding your issue", "Checking product type", "Reading return policy", "Preparing answer"];
  }

  return defaultLoadingSteps;
}

function productImageSrc(product: ProductContext) {
  if (product.image === "yoghurt") return "/traceguide-yoghurt.svg";
  if (product.image === "sandwich") return "/traceguide-sandwich.svg";
  if (product.image === "snack") return "/traceguide-snack.svg";
  if (product.image === "cookies") return "/traceguide-cookie.png";
  if (product.image === "container-set") return "/traceguide-container-set.png";
  return "/traceguide-glass-lunch-box.png";
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

export default function TraceGuideDemo() {
  const [participantCode, setParticipantCode] = useState("");
  const [clientSessionId, setClientSessionId] = useState("");
  const [activeTask, setActiveTask] = useState<StudyTask | null>(null);
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
  const [previewProduct, setPreviewProduct] = useState<ProductContext>(defaultProduct);

  const activeResponse = response || fallbackResponse;
  const primarySource = selectedSource || activeResponse.sources[0];
  const activeProduct = response?.product || previewProduct;
  const activeLoadingSteps = response?.loadingSteps?.length
    ? response.loadingSteps
    : inferLoadingSteps(question);

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
        condition: "traceguide",
        taskId: typeof payload.taskId === "string" ? payload.taskId : activeTask?.id || null,
        eventName,
        payload,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    }).catch((error) => console.warn("Study event was not saved", error));
  }

  async function runAssessment(
    prompt: string,
    nextVariables: TraceVariables,
    nextPhase: "loading" | "rechecking",
    taskOverride?: StudyTask | null
  ) {
    const taskForRun = taskOverride === null ? null : taskOverride ?? activeTask;
    setPhase(nextPhase);
    setLoadingStep(0);
    setSheetMode(null);
    setSelectedSource(null);
    setQuestion(prompt);
    setPreviewProduct(inferProduct(prompt));
    if (taskOverride) setActiveTask(taskOverride);
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
      logStudyEvent("variables_saved_recheck_started", {
        question: prompt,
        variables: nextVariables,
      });
    }

    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, inferLoadingSteps(prompt).length - 1));
    }, 620);

    try {
      const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 1900));
      const apiRequest = fetch("/api/traceguide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          taskId: taskForRun?.id,
          variables: nextVariables,
          product: {
            name: inferProduct(prompt).name,
            deliveryStatus: inferProduct(prompt).status,
          },
        }),
      });
      const [apiResponse] = await Promise.all([apiRequest, minimumDelay]);

      const result = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(result.error || "TraceGuide failed.");

      setResponse(normaliseResponse(result));
      setVariables(normaliseResponse(result).variables);
      logStudyEvent(nextPhase === "rechecking" ? "updated_answer_shown" : "answer_shown", {
        question: prompt,
        taskId: taskForRun?.id,
        scenario: result.scenario,
        confidence: result.confidence,
        usedLLM: result.usedLLM,
        answer: result.answer,
        sources: result.sources,
      });
    } catch (error) {
      console.error(error);
      setResponse(fallbackResponse);
      setVariables(fallbackResponse.variables);
    } finally {
      window.clearInterval(interval);
      setLoadingStep(inferLoadingSteps(prompt).length);
      setPhase("answer");
    }
  }

  function normaliseResponse(result: Partial<TraceResponse>): TraceResponse {
    return {
      answer: result.answer || fallbackResponse.answer,
      confidence: typeof result.confidence === "number" ? result.confidence : 88,
      confidenceReason: result.confidenceReason,
      sources: result.sources?.length ? result.sources : fallbackResponse.sources,
      sourceTags: result.sourceTags?.length ? result.sourceTags : fallbackResponse.sourceTags,
      variables: result.variables || fallbackResponse.variables,
      nextAction: result.nextAction || "start a refund request",
      actionState: result.actionState,
      product: result.product || inferProduct(question),
      loadingTitle: result.loadingTitle || "Checking support details...",
      loadingSteps: result.loadingSteps?.length ? result.loadingSteps : inferLoadingSteps(question),
      scenario: result.scenario,
      usedLLM: result.usedLLM,
      runId: result.runId,
    };
  }

  function startSuggestedQuestion(prompt: string, task?: StudyTask) {
    setInputValue("");
    void runAssessment(prompt, inferVariables(prompt), "loading", task || null);
  }

  function openSource(source: Source) {
    setSelectedSource(source);
    setSheetMode("sourceOverview");
    logStudyEvent("source_anchor_opened", {
      sourceNumber: source.number,
      sourceTitle: source.title,
      sourceCategory: source.category,
    });
  }

  function renderAnswer(answer: string, sources: Source[]) {
    return answer.split(/(\[\d+\])/g).map((part, index) => {
      const citation = part.match(/^\[(\d+)\]$/);
      if (!citation) {
        return <span key={`${part}-${index}`}>{part}</span>;
      }

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
    await runAssessment(question, variables, "rechecking");
  }

  async function startRefundRequest() {
    setUserApproved(true);
    setPhase("action");
    setActionStep(0);
    logStudyEvent("yes_clicked", {
      nextAction: activeResponse.nextAction,
      variables,
      product: activeProduct.name,
    });

    try {
      const apiResponse = await fetch("/api/traceguide-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_request",
          // The action is simulated, but it uses the current detected product and variables.
          product: activeProduct.name,
          nextAction: activeResponse.nextAction,
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
        steps: [
          "Preparing support request",
          "Attaching relevant details",
          "Sending request to seller",
          "Notifying you of updates",
        ],
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
    }, 900);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setInputValue("");
    setUserApproved(false);
    setAction(null);
    setActiveTask(null);
    void runAssessment(trimmed, inferVariables(trimmed), "loading", null);
  }

  const actionSteps = useMemo(
    () =>
      action?.steps || [
        "Creating refund request",
        "Adding evidence details",
        "Submitting request to seller",
        "Notifying you of updates",
      ],
    [action]
  );

  return (
    <main className={`${styles.page} notranslate`} translate="no">
      <section className={styles.phone} aria-label="TraceGuide Agent mobile demo">
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
              <WelcomeCard onPickQuestion={startSuggestedQuestion} activeTask={activeTask} />
            </AssistantRow>
          ) : (
            <>
              <UserQuestion question={question || defaultQuestion} />
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
                    <span className={styles.confidence} title={activeResponse.confidenceReason || "Calculated from matched sources and checked details"}>
                      {activeResponse.confidence}%
                    </span>
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
                      <span aria-hidden="true">▤</span>
                      View sources
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSheetMode("variables");
                        logStudyEvent("edit_key_variables_clicked", { variables });
                      }}
                    >
                      <span aria-hidden="true">☷</span>
                      View AI understanding
                    </button>
                  </div>
                </article>
              </AssistantRow>

              {!userApproved && (
                <AssistantRow compact>
                  <div>
                    {(() => {
                      const actionState = actionStateForResponse(activeResponse);

                      return (
                        <>
                          <div className={styles.actionStatusChip}>{actionState.label}</div>
                          <div className={styles.askBubble}>{actionState.prompt}</div>
                          <div className={styles.quickReplies}>
                            <button
                              type="button"
                              onClick={
                                actionState.canStartRequest
                                  ? startRefundRequest
                                  : () => {
                                      logStudyEvent("action_primary_clicked", {
                                        actionState: actionState.kind,
                                        nextAction: activeResponse.nextAction,
                                      });

                                      if (actionState.kind === "needs_evidence") {
                                        setSheetMode("variables");
                                      }
                                    }
                              }
                            >
                              {actionState.primaryAction}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                logStudyEvent("action_secondary_clicked", {
                                  actionState: actionState.kind,
                                  nextAction: activeResponse.nextAction,
                                })
                              }
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

          {userApproved && (
            <>
              <div className={styles.userReply}>Yes, please</div>
              <AssistantRow>
                <article className={styles.actionCard}>
                  <h2>Great, I’ll prepare this request for you.</h2>
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
                  {actionStep >= actionSteps.length - 1 && (
                    <p className={styles.requestId}>Request ID: {action?.requestId || "RF-DEMO"}</p>
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

      {sheetMode && (
        <div className={styles.sheetBackdrop} onClick={() => setSheetMode(null)}>
          <section className={styles.sheet} onClick={(event) => event.stopPropagation()}>
            <div className={styles.handle} />
            {sheetMode === "sourceOverview" && primarySource && (
              <SourceOverview
                source={primarySource}
                onDone={() => setSheetMode(null)}
                onDetails={() => setSheetMode("sourceDetails")}
              />
            )}
            {sheetMode === "sourcesUsed" && (
              <SourcesUsed sources={activeResponse.sources} onDone={() => setSheetMode(null)} />
            )}
            {sheetMode === "sourceDetails" && primarySource && (
              <SourceDetails source={primarySource} onDone={() => setSheetMode(null)} />
            )}
            {sheetMode === "variables" && (
              <VariablesSheet
                variables={variables}
                updateVariable={updateVariable}
                onCancel={() => setSheetMode(null)}
                onSave={saveAndRecheck}
              />
            )}
            {sheetMode === "ordinaryDetails" && (
              <OrdinaryDetailsSheet
                product={activeProduct}
                variables={variables}
                onDone={() => setSheetMode(null)}
              />
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

function WelcomeCard({
  onPickQuestion,
  activeTask,
}: {
  onPickQuestion: (question: string, task?: StudyTask) => void;
  activeTask: StudyTask | null;
}) {
  const visibleTasks = activeTask ? [activeTask] : studyTasks;
  return (
    <article className={styles.welcomeCard}>
      <h2>Hi, I’m TraceGuide Support.</h2>
      <p>
        I can check orders, product information and store policies before helping you start a
        support request.
      </p>
      <div className={styles.suggestionGrid} aria-label="Suggested questions">
        {visibleTasks.map((item) => (
          <button key={item.id} type="button" onClick={() => onPickQuestion(item.text, item)}>
            <span>{item.label}</span>
            {item.text}
          </button>
        ))}
      </div>
    </article>
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
      <Image
        src={productImageSrc(product)}
        alt={product.name}
        width={320}
        height={320}
        priority
      />
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
          <p>Standard product and order information available before the agent prepares a request.</p>
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
        <strong>TraceGuide condition</strong>
        <p>
          These ordinary details remain available, while the answer also exposes source anchors,
          checked variables and confirmation before any simulated service request.
        </p>
      </article>

      <button className={styles.fullWidthPrimary} type="button" onClick={onDone}>
        Done
      </button>
    </>
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

function StatusCard({
  title,
  subtitle,
  activeStep,
  steps,
}: {
  title: string;
  subtitle: string;
  activeStep: number;
  steps: string[];
}) {
  return (
    <article className={styles.statusCard}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <div className={styles.statusSteps}>
        {steps.map((step, index) => {
          const state = index < activeStep ? "done" : index === activeStep ? "active" : "pending";
          return (
            <div key={step} className={styles[state]}>
              <span>{state === "done" ? "✓" : index + 1}</span>
              <strong>{step}</strong>
              <em>{state === "done" ? "Done" : state === "active" ? "In progress" : "Pending"}</em>
            </div>
          );
        })}
      </div>
      <div className={styles.privacyNote}>
        <span>♢</span>
        We’ll only use your order and policy details to check eligibility.
      </div>
    </article>
  );
}

function SourceOverview({
  source,
  onDone,
  onDetails,
}: {
  source: Source;
  onDone: () => void;
  onDetails: () => void;
}) {
  return (
    <>
      <div className={styles.sheetTitleRow}>
        <span className={styles.sheetIcon}>▤</span>
        <div>
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
        <span className={styles.sourceNumber}>{source.number}</span>
        <div>
          <h3>{source.title}</h3>
          <p>{shortExcerpt(source.excerpt, 150)}</p>
          <em>{source.number <= 2 ? "Used in answer" : "Supporting source"}</em>
        </div>
      </article>
      <div className={styles.sheetActions}>
        <button className={styles.secondaryAction} type="button" onClick={onDetails}>
          View details
        </button>
        <button className={styles.primaryAction} type="button" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}

function SourcesUsed({ sources, onDone }: { sources: Source[]; onDone: () => void }) {
  return (
    <>
      <div className={styles.simpleSheetHeader}>
        <h2>Sources used</h2>
        <p>These are the policy and order records used for this answer.</p>
      </div>
      <div className={styles.sourceList}>
        {sources.slice(0, 3).map((source) => (
          <article key={source.id}>
            <small>SOURCE {source.number}</small>
            <h3>{source.title}</h3>
            <p>{shortExcerpt(source.excerpt, 125)}</p>
            <em className={source.relevance === "Medium relevance" ? styles.mediumTag : ""}>
              {source.number <= 2 ? "Used in answer" : "Supporting source"}
            </em>
          </article>
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
        <p>Source content cannot be edited.</p>
      </div>
      <article className={styles.detailCard}>
        <small>[{source.number}] {source.category}</small>
        <h3>{source.title}</h3>
        <p>{source.excerpt}</p>
        {source.matchedAnswer && (
          <blockquote>Used for: “{source.matchedAnswer}”</blockquote>
        )}
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
        <h2>View AI understanding</h2>
        <p>Check what the agent understood before it prepares a request. You can correct anything that looks wrong.</p>
      </div>
      <div className={styles.variableList}>
        <SelectField
          label="Issue identified"
          value={variables.issueIdentified}
          options={[
            "Damaged item",
            "Broken lid",
            "Damaged package",
            "Damaged food item",
            "Change-of-mind chilled food return",
            "Change-of-mind fresh food return",
            "Missing accessory",
            "Late delivery",
            "Product safety question",
          ]}
          onChange={(value) => updateVariable("issueIdentified", value)}
        />
        <SelectField
          label="Request"
          value={variables.request}
          options={["Return & Refund", "Replacement or refund", "Exchange", "Ask seller", "Human support"]}
          onChange={(value) => updateVariable("request", value)}
        />
        <SelectField
          label="Reason"
          value={variables.reason}
          options={[
            "Item arrived damaged",
            "Lid was broken on arrival",
            "Package damage reported",
            "Customer changed their mind",
            "Wrong item received",
            "Unsafe to use",
          ]}
          onChange={(value) => updateVariable("reason", value)}
        />
        <SelectField
          label="Evidence"
          value={variables.evidence}
          options={["Photos provided", "Photos helpful", "Photo not added", "Packaging kept", "No quality issue reported", "Not sure"]}
          onChange={(value) => updateVariable("evidence", value)}
        />
      </div>
      <div className={styles.sheetActions}>
        <button className={styles.secondaryAction} type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.primaryAction} type="button" onClick={onSave}>
          Recheck assessment
        </button>
      </div>
    </>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.selectField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function shortExcerpt(text: string, limit: number) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit).replace(/\s+\S*$/, "");
  return `${cut}...`;
}
