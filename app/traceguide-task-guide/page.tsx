import styles from "./traceguide-task-guide.module.css";

const baselineUrl = "https://tracecare-agent.vercel.app/traceguide-baseline";
const traceGuideUrl = "https://tracecare-agent.vercel.app/traceguide-demo";

const preTestFormUrl =
  "https://docs.google.com/forms/d/1ywnr2W_lYGj-lsvWgTWl69-q4W2gba8FG42zihEpQzo/viewform";
const blockSurveyFormUrl =
  "https://docs.google.com/forms/d/19mo1rG4edbMEYU0YcnZxbRkwLhK14dhnYwQM5TswRM8/viewform";
const finalComparisonFormUrl =
  "https://docs.google.com/forms/d/1V7n6-G4SQXs566JLGtQQNL7iXK8G3__x_YU57BMKJ_o/viewform";

const set1Tasks = [
  {
    id: "S1–T1",
    title: "Peanut allergy: milk cookies",
    context:
      "You are allergic to peanuts and want to know whether the milk cookies are safe for you to eat.",
    goals: [
      "Can you safely eat this product?",
      "Would you follow the AI advice or avoid the product?",
    ],
    prompt: "I’m allergic to peanuts. Can I eat these milk cookies?",
  },
  {
    id: "S1–T2",
    title: "Change address before dispatch",
    context:
      "You ordered a coffee maker, but you need to change the delivery address before it is shipped.",
    goals: [
      "Can the delivery address still be changed?",
      "Would you allow the AI agent to prepare the address-change request?",
    ],
    prompt: "Can I change the delivery address for my coffee maker before it is shipped?",
  },
  {
    id: "S1–T3",
    title: "Damaged glass lunch box",
    context: "You bought a glass lunch box. It arrived damaged two days ago.",
    goals: [
      "Can you request a return or refund?",
      "Would you allow the AI agent to start the refund request?",
    ],
    prompt: "The glass lunch box arrived damaged. Can I return it?",
  },
];

const set2Tasks = [
  {
    id: "S2–T1",
    title: "Peanut allergy: protein bar",
    context:
      "You are allergic to peanuts and want to know whether the protein bar is safe for you to eat.",
    goals: [
      "Can you safely eat this product?",
      "Would you follow the AI advice or avoid the product?",
    ],
    prompt: "I’m allergic to peanuts. Can I eat this protein bar?",
  },
  {
    id: "S2–T2",
    title: "Change address after dispatch",
    context:
      "Your fresh sandwich order is already out for delivery, but you want to change the delivery address.",
    goals: [
      "Can the delivery address still be changed normally?",
      "Would you allow the AI agent to proceed, or should this be escalated?",
    ],
    prompt: "My fresh sandwich is already out for delivery. Can I change the delivery address?",
  },
  {
    id: "S2–T3",
    title: "Damaged snack package, no photo",
    context:
      "Your snack package arrived damaged, but you have not added a photo yet.",
    goals: [
      "Can the refund request be started immediately?",
      "What should happen before the request continues?",
    ],
    prompt:
      "The snack package arrived damaged, but I have not added a photo yet. Can I get a refund?",
  },
];

function TaskSet({
  title,
  tasks,
}: {
  title: string;
  tasks: typeof set1Tasks;
}) {
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
              {task.goals.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
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
          Follow this guide during the study. You will test two e-commerce AI
          support prototypes. For each prototype, complete three tasks, then
          fill one short survey.
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
          For each task, act as a normal online shopper. Open the assigned
          prototype, ask or select the task question, read the AI response, and
          decide what you would do.
        </p>
        <p className={styles.muted}>
          Focus on the decision: would you follow the AI advice, stop, check
          more information, ask human support, or allow the agent to prepare the
          service request?
        </p>
        <div className={styles.note}>
          Please do not fill a survey after every single task. Fill the Version
          Block Survey only after finishing all three tasks in one prototype.
        </div>
      </section>

      <section className={styles.section}>
        <h2>Choose your assigned group</h2>
        <p className={styles.muted}>
          The researcher will tell you whether you are in Group A or Group B.
        </p>
        <div className={styles.groupGrid}>
          <article className={styles.groupCard}>
            <div>
              <span className={styles.pill}>Group A</span>
              <h3>Baseline Set 1 → TraceGuide Set 2</h3>
            </div>
            <ol className={styles.flowList}>
              <li>Complete the Pre-test form.</li>
              <li>Open Baseline and complete Set 1 tasks.</li>
              <li>Fill the Version Block Survey once.</li>
              <li>Open TraceGuide and complete Set 2 tasks.</li>
              <li>Fill the Version Block Survey again, then Final Comparison.</li>
            </ol>
          </article>

          <article className={styles.groupCard}>
            <div>
              <span className={styles.pill}>Group B</span>
              <h3>Baseline Set 2 → TraceGuide Set 1</h3>
            </div>
            <ol className={styles.flowList}>
              <li>Complete the Pre-test form.</li>
              <li>Open Baseline and complete Set 2 tasks.</li>
              <li>Fill the Version Block Survey once.</li>
              <li>Open TraceGuide and complete Set 1 tasks.</li>
              <li>Fill the Version Block Survey again, then Final Comparison.</li>
            </ol>
          </article>
        </div>
      </section>

      <TaskSet title="Task Set 1" tasks={set1Tasks} />
      <TaskSet title="Task Set 2" tasks={set2Tasks} />

      <section className={styles.section}>
        <h2>After each prototype block</h2>
        <p>
          After you finish all three tasks in the assigned prototype version,
          open the Version Block Survey and answer it once for that version.
        </p>
        <div className={styles.note}>
          You will fill the Version Block Survey twice in total: once after
          Baseline and once after TraceGuide.
        </div>
      </section>
    </main>
  );
}
