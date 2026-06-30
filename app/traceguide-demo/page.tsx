"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
};

type ActionResponse = {
  requestId: string;
  steps: string[];
};

type SheetMode = "sourceOverview" | "sourcesUsed" | "sourceDetails" | "variables" | null;

const defaultQuestion = "The glass lunch box arrived damaged. Can I return it?";

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

const loadingSteps = [
  "Understanding your request",
  "Checking order status",
  "Reading return policy",
  "Preparing answer",
];

export default function TraceGuideDemo() {
  const [question, setQuestion] = useState(defaultQuestion);
  const [inputValue, setInputValue] = useState("");
  const [response, setResponse] = useState<TraceResponse | null>(null);
  const [phase, setPhase] = useState<"loading" | "answer" | "rechecking" | "action">("loading");
  const [loadingStep, setLoadingStep] = useState(0);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [variables, setVariables] = useState<TraceVariables>(fallbackResponse.variables);
  const [userApproved, setUserApproved] = useState(false);
  const [action, setAction] = useState<ActionResponse | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const booted = useRef(false);

  const activeResponse = response || fallbackResponse;
  const primarySource = selectedSource || activeResponse.sources[0];

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void runAssessment(defaultQuestion, fallbackResponse.variables, "loading");
    // The initial demo assessment intentionally runs only once on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAssessment(
    prompt: string,
    nextVariables: TraceVariables,
    nextPhase: "loading" | "rechecking"
  ) {
    setPhase(nextPhase);
    setLoadingStep(0);
    setSheetMode(null);
    setSelectedSource(null);

    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, loadingSteps.length - 1));
    }, 620);

    try {
      const startedAt = Date.now();
      const apiResponse = await fetch("/api/traceguide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          variables: nextVariables,
          product: {
            name: "Glass Lunch Box",
            deliveryStatus: "Delivered 2 days ago",
          },
        }),
      });

      const result = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(result.error || "TraceGuide failed.");

      const elapsed = Date.now() - startedAt;
      if (elapsed < 1900) {
        await new Promise((resolve) => window.setTimeout(resolve, 1900 - elapsed));
      }

      setResponse(normaliseResponse(result));
      setVariables(normaliseResponse(result).variables);
    } catch (error) {
      console.error(error);
      setResponse(fallbackResponse);
      setVariables(fallbackResponse.variables);
    } finally {
      window.clearInterval(interval);
      setLoadingStep(loadingSteps.length);
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
    };
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
          action: "refund_request",
          product: "Glass Lunch Box",
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
          "Creating refund request",
          "Attaching your uploaded photos",
          "Submitting request to seller",
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
    void runAssessment(trimmed, variables, "loading");
  }

  const actionSteps = useMemo(
    () =>
      action?.steps || [
        "Creating refund request",
        "Attaching your uploaded photos",
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
          <UserQuestion question={question} />
          <ProductCard />

          {(phase === "loading" || phase === "rechecking") && (
            <AssistantRow>
              <StatusCard
                title={phase === "rechecking" ? "Rechecking eligibility..." : "Checking refund eligibility..."}
                subtitle={
                  phase === "rechecking"
                    ? "I’m checking the updated details against the order and policy."
                    : "This usually takes less than 30 seconds."
                }
                activeStep={loadingStep}
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
                    <div className={styles.askBubble}>Would you like me to start a refund request?</div>
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
                  <h2>Great, I’ll handle the refund request for you.</h2>
                  <p>Preparing your refund request...</p>
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

function ProductCard() {
  return (
    <article className={styles.productCard}>
      <Image
        src="/traceguide-glass-lunch-box.png"
        alt="Glass lunch box"
        width={320}
        height={320}
        priority
      />
      <div>
        <h2>Glass Lunch Box</h2>
        <p>
          <span>✓</span> Delivered 2 days ago
        </p>
        <button type="button">Order details</button>
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
}: {
  title: string;
  subtitle: string;
  activeStep: number;
}) {
  return (
    <article className={styles.statusCard}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <div className={styles.statusSteps}>
        {loadingSteps.map((step, index) => {
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
