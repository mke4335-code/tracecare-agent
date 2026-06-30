"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./traceguide-demo.module.css";

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

type TraceResponse = {
  answer: string;
  confidence: number;
  sources: Source[];
  sourceTags: string[];
  variables: TraceVariables;
  nextAction: string;
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

type SheetMode = "sourceOverview" | "sourcesUsed" | "sourceDetails" | "variables" | null;

const defaultQuestion = "The glass lunch box arrived damaged. Can I return it?";

type ProductContext = {
  name: string;
  image: "glass-box" | "cookies" | "container-set";
  detail: string;
  status: string;
  linkLabel: string;
};

const defaultProduct: ProductContext = {
  name: "Glass Lunch Box",
  image: "glass-box",
  detail: "1 item",
  status: "Delivered 2 days ago",
  linkLabel: "Order details",
};

const suggestedQuestions = [
  {
    label: "Damaged lunch box",
    text: "The glass lunch box arrived damaged. Can I return it?",
  },
  {
    label: "Damaged food item",
    text: "The cookies arrived damaged. Can I get a refund?",
  },
  {
    label: "Delivery compensation",
    text: "My order arrived two days late. Can I get compensation?",
  },
  {
    label: "Allergen check",
    text: "I’m allergic to peanuts. Can I eat these milk cookies?",
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

function inferLoadingTitle(prompt: string) {
  if (includesAny(prompt, ["allergen", "peanut", "过敏", "花生"])) return "Checking product safety...";
  if (includesAny(prompt, ["late", "delay", "delayed", "compensation", "延迟", "补偿"])) return "Checking delivery compensation...";
  if (includesAny(prompt, ["missing", "accessory", "缺少", "少了", "配件"])) return "Checking support options...";
  if (includesAny(prompt, ["food", "cookie", "cookies", "biscuit", "饼干", "食品", "吃的"])) return "Checking food return options...";
  return "Checking refund eligibility...";
}

function inferLoadingSteps(prompt: string) {
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
  if (product.image === "cookies") return "/traceguide-cookie.png";
  if (product.image === "container-set") return "/traceguide-container-set.png";
  return "/traceguide-glass-lunch-box.png";
}

export default function TraceGuideDemo() {
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

  async function runAssessment(
    prompt: string,
    nextVariables: TraceVariables,
    nextPhase: "loading" | "rechecking"
  ) {
    setPhase(nextPhase);
    setLoadingStep(0);
    setSheetMode(null);
    setSelectedSource(null);
    setQuestion(prompt);
    setPreviewProduct(inferProduct(prompt));
    if (nextPhase === "loading") {
      setResponse(null);
      setAction(null);
      setUserApproved(false);
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
      sources: result.sources?.length ? result.sources : fallbackResponse.sources,
      sourceTags: result.sourceTags?.length ? result.sourceTags : fallbackResponse.sourceTags,
      variables: result.variables || fallbackResponse.variables,
      nextAction: result.nextAction || "start a refund request",
      product: result.product || inferProduct(question),
      loadingTitle: result.loadingTitle || "Checking support details...",
      loadingSteps: result.loadingSteps?.length ? result.loadingSteps : inferLoadingSteps(question),
      scenario: result.scenario,
      usedLLM: result.usedLLM,
    };
  }

  function startSuggestedQuestion(prompt: string) {
    setInputValue("");
    void runAssessment(prompt, inferVariables(prompt), "loading");
  }

  function openSource(source: Source) {
    setSelectedSource(source);
    setSheetMode("sourceOverview");
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
    void runAssessment(trimmed, inferVariables(trimmed), "loading");
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
              <WelcomeCard onPickQuestion={startSuggestedQuestion} />
            </AssistantRow>
          ) : (
            <>
              <UserQuestion question={question || defaultQuestion} />
              <ProductCard product={activeProduct} />
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
                    <span className={styles.confidence}>{activeResponse.confidence}%</span>
                  </div>
                  <p>{renderAnswer(activeResponse.answer.split("\n\n").slice(1).join("\n\n"), activeResponse.sources)}</p>
                  <div className={styles.sourceTags} aria-label="Sources used for this answer">
                    {activeResponse.sourceTags.slice(0, 3).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <hr />
                  <div className={styles.answerActions}>
                    <button type="button" onClick={() => setSheetMode("sourcesUsed")}>
                      <span aria-hidden="true">▤</span>
                      View sources
                    </button>
                    <button type="button" onClick={() => setSheetMode("variables")}>
                      <span aria-hidden="true">☷</span>
                      Edit key variables
                    </button>
                  </div>
                </article>
              </AssistantRow>

              {!userApproved && (
                <AssistantRow compact>
                  <div>
                    <div className={styles.askBubble}>Would you like me to {activeResponse.nextAction}?</div>
                    <div className={styles.quickReplies}>
                      <button type="button" onClick={startRefundRequest}>
                        Yes
                      </button>
                      <button type="button">No</button>
                    </div>
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

function WelcomeCard({ onPickQuestion }: { onPickQuestion: (question: string) => void }) {
  return (
    <article className={styles.welcomeCard}>
      <h2>Hi, I’m TraceGuide Support.</h2>
      <p>
        I can check orders, product information and store policies before helping you start a
        support request.
      </p>
      <div className={styles.suggestionGrid} aria-label="Suggested questions">
        {suggestedQuestions.map((item) => (
          <button key={item.text} type="button" onClick={() => onPickQuestion(item.text)}>
            <span>{item.label}</span>
            {item.text}
          </button>
        ))}
      </div>
    </article>
  );
}

function ProductCard({ product }: { product: ProductContext }) {
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
          <em>{source.relevance}</em>
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
              {source.relevance}
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
        <h2>Check AI understanding</h2>
        <p>AI understood your request as follows.</p>
      </div>
      <div className={styles.variableList}>
        <SelectField
          label="Issue identified"
          value={variables.issueIdentified}
          options={["Damaged item", "Missing accessory", "Late delivery", "Product safety question"]}
          onChange={(value) => updateVariable("issueIdentified", value)}
        />
        <SelectField
          label="Request"
          value={variables.request}
          options={["Return & Refund", "Exchange", "Ask seller", "Human support"]}
          onChange={(value) => updateVariable("request", value)}
        />
        <SelectField
          label="Reason"
          value={variables.reason}
          options={["Item arrived damaged", "Changed my mind", "Wrong item received", "Unsafe to use"]}
          onChange={(value) => updateVariable("reason", value)}
        />
        <SelectField
          label="Evidence"
          value={variables.evidence}
          options={["Photos provided", "Photo not added", "Packaging kept", "Not sure"]}
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
