export type TraceguideTaskCategory = "Damaged-item resolution";

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
    category: "Damaged-item resolution",
    label: "Damaged lunch box — photo provided",
    title: "Glass Lunch Box arrived damaged",
    context: "Your glass lunch box arrived damaged two days ago. A clear photo of the item and packaging is already attached.",
    prompt: "The glass lunch box arrived damaged. Can you help me return it?",
    decisionPrompt: "Would you authorise the agent to prepare the damaged-item service request?",
    groundTruth: "Authorise preparation because the item is delivered, in the policy window and supporting evidence is present.",
  },
  {
    id: "S1-T2",
    set: "1",
    category: "Damaged-item resolution",
    label: "Cracked container set — no photo",
    title: "Glass Container Set arrived cracked",
    context: "One container in the set arrived cracked today. You have not attached a damage photo.",
    prompt: "One container in my set arrived cracked, but I have not added a photo. What should I do?",
    decisionPrompt: "Would you authorise a service request now, or add evidence first?",
    groundTruth: "Do not authorise yet; add a clear damage photo or ask human support.",
  },
  {
    id: "S2-T1",
    set: "2",
    category: "Damaged-item resolution",
    label: "Broken container lid — photo provided",
    title: "Glass Food Container lid arrived broken",
    context: "The locking lid arrived broken yesterday. A clear photo of the broken lid and packaging is already attached.",
    prompt: "The lid on my glass food container arrived broken. Can you help me return it?",
    decisionPrompt: "Would you authorise the agent to prepare the damaged-item service request?",
    groundTruth: "Authorise preparation because the order is delivered, in the policy window and supporting evidence is present.",
  },
  {
    id: "S2-T2",
    set: "2",
    category: "Damaged-item resolution",
    label: "Cracked coffee maker — no photo",
    title: "Coffee Maker arrived cracked",
    context: "The coffee maker arrived with a cracked casing today. You have not attached a damage photo.",
    prompt: "My coffee maker arrived with a cracked casing, but I have not added a photo. What should I do?",
    decisionPrompt: "Would you authorise a service request now, or add evidence first?",
    groundTruth: "Do not authorise yet; add a clear damage photo or ask human support.",
  },
];

export function getTraceguideStudyTask(taskId?: string | null) {
  if (!taskId) return null;
  return traceguideStudyTasks.find((task) => task.id.toLowerCase() === taskId.toLowerCase()) || null;
}

export function resolveTraceguideStudyTask(question: string, taskId?: string | null) {
  const requested = getTraceguideStudyTask(taskId);
  if (requested) return requested;
  const lower = question.toLowerCase();
  if (/coffee maker|coffee machine/.test(lower)) return getTraceguideStudyTask("S2-T2")!;
  if (/lid|food container/.test(lower)) return getTraceguideStudyTask("S2-T1")!;
  if (/set|containers/.test(lower)) return getTraceguideStudyTask("S1-T2")!;
  if (/lunch box|glass box/.test(lower)) return getTraceguideStudyTask("S1-T1")!;
  return null;
}

export function orderedTraceguideTasks(activeTaskId?: string | null) {
  const activeTask = getTraceguideStudyTask(activeTaskId);
  if (!activeTask) return traceguideStudyTasks;
  return [activeTask, ...traceguideStudyTasks.filter((task) => task.id !== activeTask.id)];
}
