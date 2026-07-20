import type { CommerceContext } from "./traceguide-commerce-data.ts";
import type { DamagedItemPolicyRules } from "./traceguide-case-runtime.ts";
import {
  evaluateDamagedItemEligibility,
  type EligibilityDecision,
} from "./traceguide-eligibility.ts";
import type { ServiceCaseStage } from "./traceguide-service-state.ts";

export type BuyerFacingProgress = {
  stage: ServiceCaseStage;
  label: string;
  status: "done" | "in_progress" | "waiting";
};

export type DamagedItemProcedureResult = {
  eligibility: EligibilityDecision;
  currentStage: ServiceCaseStage;
  progress: BuyerFacingProgress[];
  availableActions: Array<
    "prepare_refund" | "prepare_replacement" | "add_evidence" | "human_handoff"
  >;
  requiresBuyerApproval: boolean;
};

export function runDamagedItemProcedure(
  context: CommerceContext,
  policy: DamagedItemPolicyRules
): DamagedItemProcedureResult {
  const taskText = `${context.task.scenarioKey} ${context.variables.issueIdentified} ${context.variables.reason}`.toLowerCase();
  if (!/damaged|broken/.test(taskText)) {
    throw new Error("The selected case is not a damaged-item service procedure.");
  }
  const eligibility = evaluateDamagedItemEligibility({
    orderStatus: context.order.status,
    deliveredDaysAgo: context.order.deliveredDaysAgo,
    itemReportedDamaged: true,
    evidenceStatus: context.evidence.status,
    returnWindowDays: policy.returnWindowDays,
    evidenceRequiredBeforeReview: policy.evidenceRequiredBeforeReview,
    refundAllowed: policy.refundAllowed,
    replacementAllowed: policy.replacementAllowed,
  });

  const progress: BuyerFacingProgress[] = [
    { stage: "understanding_request", label: "Understanding your request", status: "done" },
    { stage: "reading_context", label: "Checking order details", status: "done" },
    { stage: "checking_policy", label: "Reading the returns policy", status: "done" },
  ];

  if (eligibility.nextStep === "collect_evidence") {
    progress.push({
      stage: "collecting_evidence",
      label: "Waiting for damage photos",
      status: "waiting",
    });
    return {
      eligibility,
      currentStage: "collecting_evidence",
      progress,
      availableActions: ["add_evidence", "human_handoff"],
      requiresBuyerApproval: false,
    };
  }

  if (eligibility.nextStep === "handoff") {
    progress.push({
      stage: "human_handoff",
      label: "Human review needed",
      status: "waiting",
    });
    return {
      eligibility,
      currentStage: "human_handoff",
      progress,
      availableActions: ["human_handoff"],
      requiresBuyerApproval: false,
    };
  }

  if (eligibility.nextStep === "stop") {
    progress.push({
      stage: "waiting_for_customer",
      label: "No eligible action available",
      status: "waiting",
    });
    return {
      eligibility,
      currentStage: "waiting_for_customer",
      progress,
      availableActions: ["human_handoff"],
      requiresBuyerApproval: false,
    };
  }

  progress.push({
    stage: "waiting_for_approval",
    label: "Waiting for your confirmation",
    status: "waiting",
  });
  const availableActions: DamagedItemProcedureResult["availableActions"] = [];
  if (policy.refundAllowed) availableActions.push("prepare_refund");
  if (policy.replacementAllowed) availableActions.push("prepare_replacement");
  availableActions.push("human_handoff");

  return {
    eligibility,
    currentStage: "waiting_for_approval",
    progress,
    availableActions,
    requiresBuyerApproval: true,
  };
}
