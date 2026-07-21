import styles from "./traceguide-task-guide.module.css";
import { traceguideStudyTasks, type TraceguideStudyTask } from "../../lib/traceguide-study-config";

const baselineUrl = "https://tracecare-agent.vercel.app/traceguide-baseline";
const traceGuideUrl = "https://tracecare-agent.vercel.app/traceguide-demo";

const formalSurveyUrl =
  "https://forms.office.com/Pages/ResponsePage.aspx?id=Px9DDcEgHEaVikaynU4CGyFIJAS1PnBEtJMitMjfzZxURFRLSFZIMkk0OFFSNEhPVjdCTU5CR0dQOC4u";

const set1Tasks = traceguideStudyTasks.filter((task) => task.set === "1");
const set2Tasks = traceguideStudyTasks.filter((task) => task.set === "2");

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
          You will test two e-commerce AI support prototypes. Each prototype has three tasks. Follow
          your assigned Group A or Group B order, then submit the formal survey once at the end.
        </p>

        <div className={styles.linkGrid}>
          <a href={formalSurveyUrl} target="_blank" className={styles.primaryLink}>
            Formal Survey — submit once
          </a>
          <a href={baselineUrl} target="_blank" className={styles.secondaryLink}>
            Baseline Prototype
          </a>
          <a href={traceGuideUrl} target="_blank" className={styles.secondaryLink}>
            TraceGuide Prototype
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
          Keep the formal survey open while testing. Complete its First prototype section after the
          first prototype, its Second prototype section after the second prototype, and submit the
          form only once. The group you select maps First and Second to the correct prototype.
        </div>
      </section>

      <section className={styles.section}>
        <h2>Choose your assigned group</h2>
        <p className={styles.muted}>The researcher will tell you whether you are in Group A or Group B.</p>
        <div className={styles.groupGrid}>
          <article className={styles.groupCard}>
            <div>
              <span className={styles.pill}>Group A</span>
              <h3>Baseline Set 1 → TraceGuide Set 2</h3>
            </div>
            <ol className={styles.flowList}>
              <li>Open the Formal Survey and select Group A.</li>
              <li>Open Baseline and complete S1-T1, S1-T2 and S1-T3.</li>
              <li>Answer the survey section labelled First prototype.</li>
              <li>Open TraceGuide and complete S2-T1, S2-T2 and S2-T3.</li>
              <li>Answer Second prototype and Final comparison, then submit once.</li>
            </ol>
          </article>

          <article className={styles.groupCard}>
            <div>
              <span className={styles.pill}>Group B</span>
              <h3>TraceGuide Set 1 → Baseline Set 2</h3>
            </div>
            <ol className={styles.flowList}>
              <li>Open the Formal Survey and select Group B.</li>
              <li>Open TraceGuide and complete S1-T1, S1-T2 and S1-T3.</li>
              <li>Answer the survey section labelled First prototype.</li>
              <li>Open Baseline and complete S2-T1, S2-T2 and S2-T3.</li>
              <li>Answer Second prototype and Final comparison, then submit once.</li>
            </ol>
          </article>
        </div>
      </section>

      <TaskSet title="Task Set 1" tasks={set1Tasks} />
      <TaskSet title="Task Set 2" tasks={set2Tasks} />

    </main>
  );
}
