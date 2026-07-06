import styles from "./traceguide-task-guide.module.css";
import { traceguideStudyTasks, type TraceguideStudyTask } from "../../lib/traceguide-study-config";

const baselineUrl = "https://tracecare-agent.vercel.app/traceguide-baseline";
const traceGuideUrl = "https://tracecare-agent.vercel.app/traceguide-demo";

const preTestFormUrl =
  "https://docs.google.com/forms/d/1ywnr2W_lYGj-lsvWgTWl69-q4W2gba8FG42zihEpQzo/viewform";
const blockSurveyFormUrl =
  "https://docs.google.com/forms/d/19mo1rG4edbMEYU0YcnZxbRkwLhK14dhnYwQM5TswRM8/viewform";
const finalComparisonFormUrl =
  "https://docs.google.com/forms/d/1V7n6-G4SQXs566JLGtQQNL7iXK8G3__x_YU57BMKJ_o/viewform";

const set1Tasks = traceguideStudyTasks.filter((task) => task.set === "1");
const set2Tasks = traceguideStudyTasks.filter((task) => task.set === "2");

function prototypeLink(baseUrl: string, task: TraceguideStudyTask) {
  return `${baseUrl}?task=${task.id}`;
}

function TaskSet({ title, tasks }: { title: string; tasks: TraceguideStudyTask[] }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <div className={styles.taskGrid}>
        {tasks.map((task) => (
          <article className={styles.taskCard} key={task.id}>
            <span className={styles.taskId}>{task.id}</span>
            <h3>{task.title}</h3>
            <p>{task.context}</p>
            <p className={styles.smallTitle}>Use the prototype to decide:</p>
            <ol>
              <li>{task.decisionPrompt}</li>
              <li>What would you do next as a normal online shopper?</li>
            </ol>
            <div className={styles.prompt}>
              <span>Ask or select this question</span>
              <strong>{task.prompt}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function TraceGuideTaskGuidePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>TraceGuide Agent UX Study</div>
        <h1>Participant Task Guide</h1>
        <p className={styles.subtitle}>
          You will test two e-commerce AI support prototypes. Each prototype has two tasks. After
          finishing the two tasks in one prototype, complete the Version Block Survey once.
        </p>

        <div className={styles.linkGrid}>
          <a href={preTestFormUrl} target="_blank" className={styles.primaryLink}>
            1. Pre-test Form
          </a>
          <a href={baselineUrl} target="_blank" className={styles.secondaryLink}>
            Baseline Prototype
          </a>
          <a href={traceGuideUrl} target="_blank" className={styles.secondaryLink}>
            TraceGuide Prototype
          </a>
          <a href={blockSurveyFormUrl} target="_blank" className={styles.primaryLink}>
            Version Block Survey
          </a>
          <a href={finalComparisonFormUrl} target="_blank" className={styles.primaryLink}>
            Final Comparison
          </a>
        </div>
      </section>

      <section className={styles.section}>
        <h2>What you need to do</h2>
        <p>
          For each task, act as a normal online shopper. Open the assigned prototype, ask or select
          the task question, read the AI response, and decide what you would do next.
        </p>
        <p className={styles.muted}>
          The study is about decision-making: would you follow the AI advice, stop, check more
          information, ask human support, or allow the agent to prepare the service request?
        </p>
        <p className={styles.muted}>
          Use the prototype naturally. You do not need to check every detail. If the interface gives
          you sources, AI understanding, product details, or human support, use them only when they
          help you make your next-step decision.
        </p>
        <div className={styles.note}>
          Fill the Version Block Survey after completing the two tasks in one prototype. Each
          participant fills it twice in total: once for Baseline and once for TraceGuide.
        </div>
      </section>

      <section className={styles.section}>
        <h2>Choose your assigned group</h2>
        <p className={styles.muted}>The researcher will tell you whether you are in Group 1 or Group 2.</p>
        <div className={styles.groupGrid}>
          <article className={styles.groupCard}>
            <div>
              <span className={styles.pill}>Group 1</span>
              <h3>Baseline Set 1 → TraceGuide Set 2</h3>
            </div>
            <ol className={styles.flowList}>
              <li>Complete the Pre-test form.</li>
              <li>Open Baseline and complete S1-T1 and S1-T2.</li>
              <li>Fill the Version Block Survey once for Baseline Set 1.</li>
              <li>Open TraceGuide and complete S2-T1 and S2-T2.</li>
              <li>Fill the Version Block Survey once for TraceGuide Set 2, then Final Comparison.</li>
            </ol>
          </article>

          <article className={styles.groupCard}>
            <div>
              <span className={styles.pill}>Group 2</span>
              <h3>TraceGuide Set 1 → Baseline Set 2</h3>
            </div>
            <ol className={styles.flowList}>
              <li>Complete the Pre-test form.</li>
              <li>Open TraceGuide and complete S1-T1 and S1-T2.</li>
              <li>Fill the Version Block Survey once for TraceGuide Set 1.</li>
              <li>Open Baseline and complete S2-T1 and S2-T2.</li>
              <li>Fill the Version Block Survey once for Baseline Set 2, then Final Comparison.</li>
            </ol>
          </article>
        </div>
      </section>

      <TaskSet title="Task Set 1" tasks={set1Tasks} />
      <TaskSet title="Task Set 2" tasks={set2Tasks} />

      <section className={styles.section}>
        <h2>Direct task links</h2>
        <div className={styles.taskGrid}>
          {traceguideStudyTasks.map((task) => (
            <article className={styles.taskCard} key={task.id}>
              <span className={styles.taskId}>{task.id}</span>
              <h3>{task.label}</h3>
              <p>{task.prompt}</p>
              <div className={styles.linkGrid}>
                <a href={prototypeLink(baselineUrl, task)} target="_blank" className={styles.secondaryLink}>
                  Open in Baseline
                </a>
                <a href={prototypeLink(traceGuideUrl, task)} target="_blank" className={styles.secondaryLink}>
                  Open in TraceGuide
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
