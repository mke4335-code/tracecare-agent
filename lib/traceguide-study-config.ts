export type TraceguideTaskCategory = "Product safety advice" | "After-sales authorisation";

export type TraceguideStudyTask = {
  id: "S1-T1" | "S1-T2" | "S2-T1" | "S2-T2";
  set: "1" | "2";
  category: TraceguideTaskCategory;
  label: string;
  title: string;
  context: string;
  prompt: string;
  decisionPrompt: string;
  groundTruth: string;
};

export const traceguideStudyTasks: TraceguideStudyTask[] = [
  {
    id: "S1-T1",
    set: "1",
    category: "Product safety advice",
    label: "Peanut allergy: cookies",
    title: "Milk Cookies peanut allergy",
    context: "You are allergic to peanuts and want to know whether these milk cookies are safe to eat.",
    prompt: "I’m allergic to peanuts. Can I eat these milk cookies?",
    decisionPrompt: "Would you follow the AI advice and avoid eating the product?",
    groundTruth: "Do not eat the product; follow the allergen-risk advice or ask human support if unsure.",
  },
  {
    id: "S1-T2",
    set: "1",
    category: "After-sales authorisation",
    label: "Damaged lunch box",
    title: "Glass Lunch Box arrived damaged",
    context: "Your glass lunch box arrived damaged two days ago and photo evidence is available.",
    prompt: "The glass lunch box arrived damaged. Can I return it?",
    decisionPrompt: "Would you authorise the agent to prepare the return/refund request?",
    groundTruth: "Authorise the agent to prepare the request because the item is damaged, in the return window, and evidence is available.",
  },
  {
    id: "S2-T1",
    set: "2",
    category: "Product safety advice",
    label: "Peanut allergy: protein bar",
    title: "Protein Bar peanut allergy",
    context: "You are allergic to peanuts and want to know whether this protein bar is safe to eat.",
    prompt: "I’m allergic to peanuts. Can I eat this protein bar?",
    decisionPrompt: "Would you follow the AI advice and avoid eating the product?",
    groundTruth: "Do not eat the product; follow the allergen-risk advice or ask human support if unsure.",
  },
  {
    id: "S2-T2",
    set: "2",
    category: "After-sales authorisation",
    label: "Snack package damaged",
    title: "Snack Package damaged, no photo added",
    context: "Your snack package arrived damaged, but you have not added a photo yet.",
    prompt: "The snack package arrived damaged, but I have not added a photo yet. Can I get a refund?",
    decisionPrompt: "Would you authorise the agent to start the refund request now?",
    groundTruth: "Do not directly authorise the request; add photo evidence first or ask human support.",
  },
];

export function getTraceguideStudyTask(taskId?: string | null) {
  if (!taskId) return null;
  return traceguideStudyTasks.find((task) => task.id.toLowerCase() === taskId.toLowerCase()) || null;
}

export function orderedTraceguideTasks(activeTaskId?: string | null) {
  const activeTask = getTraceguideStudyTask(activeTaskId);
  if (!activeTask) return traceguideStudyTasks;
  return [activeTask, ...traceguideStudyTasks.filter((task) => task.id !== activeTask.id)];
}

