import type { CommerceContext } from "./traceguide-commerce-data";
import type { DamagedItemPolicyRules } from "./traceguide-case-runtime";
import { runDamagedItemProcedure } from "./traceguide-damaged-item-procedure";
import type { EligibilityDecision } from "./traceguide-eligibility";

export type TraceGuideToolName =
  | "understand_request"
  | "get_order_detail"
  | "get_evidence_status"
  | "get_active_policy"
  | "evaluate_eligibility"
  | "prepare_buyer_options";

export type TraceGuideToolEvent = {
  toolName: TraceGuideToolName;
  publicLabel: string;
  status: "succeeded" | "failed";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type TraceGuideAgentRun = {
  goal: string;
  outcome: EligibilityDecision["outcome"];
  currentStage: string;
  requiresBuyerApproval: boolean;
  availableActions: string[];
  publicProgress: Array<{
    label: string;
    status: "done" | "in_progress" | "waiting";
  }>;
  toolEvents: TraceGuideToolEvent[];
};

export function orchestrateDamagedItemCase(input: {
  goal: string;
  context: CommerceContext;
  policy: DamagedItemPolicyRules;
}): TraceGuideAgentRun {
  const { goal, context, policy } = input;
  const procedure = runDamagedItemProcedure(context, policy);
  const toolEvents: TraceGuideToolEvent[] = [
    {
      toolName: "understand_request",
      publicLabel: "Understanding your request",
      status: "succeeded",
      input: { message: goal },
      output: {
        issueType: context.variables.issueIdentified,
        requestedResolution: context.variables.request,
      },
    },
    {
      toolName: "get_order_detail",
      publicLabel: "Checking order details",
      status: "succeeded",
      input: { orderId: context.order.id },
      output: {
        orderStatus: context.order.status,
        deliveredDaysAgo: context.order.deliveredDaysAgo,
        productId: context.product.id,
      },
    },
    {
      toolName: "get_evidence_status",
      publicLabel: "Checking supporting evidence",
      status: "succeeded",
      input: { orderId: context.order.id },
      output: { evidenceStatus: context.evidence.status },
    },
    {
      toolName: "get_active_policy",
      publicLabel: "Reading the returns policy",
      status: "succeeded",
      input: { policyKey: "damaged_item_resolution" },
      output: {
        returnWindowDays: policy.returnWindowDays,
        evidenceRequiredBeforeReview: policy.evidenceRequiredBeforeReview,
        refundAllowed: policy.refundAllowed,
        replacementAllowed: policy.replacementAllowed,
      },
    },
    {
      toolName: "evaluate_eligibility",
      publicLabel: "Checking available options",
      status: "succeeded",
      input: {
        orderStatus: context.order.status,
        deliveredDaysAgo: context.order.deliveredDaysAgo,
        evidenceStatus: context.evidence.status,
      },
      output: procedure.eligibility as unknown as Record<string, unknown>,
    },
    {
      toolName: "prepare_buyer_options",
      publicLabel: procedure.requiresBuyerApproval
        ? "Waiting for your confirmation"
        : procedure.currentStage === "collecting_evidence"
          ? "Waiting for damage photos"
          : "Preparing the next step",
      status: "succeeded",
      input: { outcome: procedure.eligibility.outcome },
      output: {
        availableActions: procedure.availableActions,
        requiresBuyerApproval: procedure.requiresBuyerApproval,
      },
    },
  ];

  return {
    goal,
    outcome: procedure.eligibility.outcome,
    currentStage: procedure.currentStage,
    requiresBuyerApproval: procedure.requiresBuyerApproval,
    availableActions: procedure.availableActions,
    publicProgress: procedure.progress.map(({ label, status }) => ({ label, status })),
    toolEvents,
  };
}
