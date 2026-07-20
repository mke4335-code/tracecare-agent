import { supabase } from "./supabase";
import type { CommerceContext, TraceVariables } from "./traceguide-commerce-data";
import {
  evaluateDamagedItemEligibility,
  type EligibilityDecision,
} from "./traceguide-eligibility";
import type { TraceGuideToolEvent } from "./traceguide-agent-orchestrator";

export type DamagedItemPolicyRules = {
  returnWindowDays: number;
  evidenceRequiredBeforeReview: boolean;
  refundAllowed: boolean;
  replacementAllowed: boolean;
};

export type ServiceCaseRuntime = {
  caseId: string;
  caseToken: string;
  status: string;
  currentStage: string;
  orderId: string;
  policyVersionId: string | null;
};

const defaultDamagedItemRules: DamagedItemPolicyRules = {
  returnWindowDays: 30,
  evidenceRequiredBeforeReview: true,
  refundAllowed: true,
  replacementAllowed: true,
};

function booleanRule(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberRule(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function getActiveDamagedItemPolicy() {
  const { data, error } = await supabase
    .from("traceguide_policy_versions")
    .select("id, rules")
    .eq("policy_key", "damaged_item_resolution")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { id: null, rules: defaultDamagedItemRules, source: "server_fallback" as const };
  }

  const rules = (data.rules || {}) as Record<string, unknown>;
  return {
    id: data.id as string,
    source: "database" as const,
    rules: {
      returnWindowDays: numberRule(
        rules.return_window_days,
        defaultDamagedItemRules.returnWindowDays
      ),
      evidenceRequiredBeforeReview: booleanRule(
        rules.evidence_required_before_review,
        defaultDamagedItemRules.evidenceRequiredBeforeReview
      ),
      refundAllowed: booleanRule(rules.refund_allowed, defaultDamagedItemRules.refundAllowed),
      replacementAllowed: booleanRule(
        rules.replacement_allowed,
        defaultDamagedItemRules.replacementAllowed
      ),
    },
  };
}

export function eligibilityForCommerceContext(
  context: CommerceContext,
  rules: DamagedItemPolicyRules
): EligibilityDecision | null {
  const taskText = `${context.task.scenarioKey} ${context.variables.issueIdentified} ${context.variables.reason}`.toLowerCase();
  const damagedItemProcedure = /damaged|broken/.test(taskText);
  if (!damagedItemProcedure) return null;

  return evaluateDamagedItemEligibility({
    orderStatus: context.order.status,
    deliveredDaysAgo: context.order.deliveredDaysAgo,
    itemReportedDamaged: damagedItemProcedure,
    evidenceStatus: context.evidence.status,
    returnWindowDays: rules.returnWindowDays,
    evidenceRequiredBeforeReview: rules.evidenceRequiredBeforeReview,
    refundAllowed: rules.refundAllowed,
    replacementAllowed: rules.replacementAllowed,
  });
}

export async function startServiceCase(input: {
  taskId: string;
  participantCode?: string;
  condition?: string;
  goal?: string;
}): Promise<ServiceCaseRuntime | null> {
  const { data, error } = await supabase.rpc("traceguide_start_service_case", {
    p_task_id: input.taskId,
    p_participant_code: input.participantCode || null,
    p_condition: input.condition || null,
    p_goal: input.goal || null,
  });

  if (error || !data || typeof data !== "object") {
    console.warn("TraceGuide case creation skipped.", error);
    return null;
  }

  const result = data as Record<string, unknown>;
  if (typeof result.caseId !== "string" || typeof result.caseToken !== "string") return null;

  return {
    caseId: result.caseId,
    caseToken: result.caseToken,
    status: typeof result.status === "string" ? result.status : "open",
    currentStage:
      typeof result.currentStage === "string" ? result.currentStage : "understanding_request",
    orderId: typeof result.orderId === "string" ? result.orderId : "",
    policyVersionId:
      typeof result.policyVersionId === "string" ? result.policyVersionId : null,
  };
}

export async function updateServiceCaseAssessment(input: {
  runtime: ServiceCaseRuntime;
  variables: TraceVariables;
  eligibility: EligibilityDecision | null;
  stage: string;
}) {
  const { data, error } = await supabase.rpc("traceguide_update_case_assessment", {
    p_case_id: input.runtime.caseId,
    p_case_token: input.runtime.caseToken,
    p_variables: input.variables,
    p_eligibility: input.eligibility || {},
    p_stage: input.stage,
  });

  if (error) {
    console.warn("TraceGuide case assessment was not persisted.", error);
    return null;
  }
  const result = (data || {}) as Record<string, unknown>;
  return {
    caseId: typeof result.caseId === "string" ? result.caseId : input.runtime.caseId,
    caseToken: input.runtime.caseToken,
    status: typeof result.status === "string" ? result.status : input.runtime.status,
    currentStage:
      typeof result.currentStage === "string" ? result.currentStage : input.stage,
    orderId: input.runtime.orderId,
    policyVersionId: input.runtime.policyVersionId,
  } satisfies ServiceCaseRuntime;
}

export function caseStageForEligibility(eligibility: EligibilityDecision | null) {
  if (!eligibility) return "waiting_for_customer";
  if (eligibility.nextStep === "prepare_resolution") return "waiting_for_approval";
  if (eligibility.nextStep === "collect_evidence") return "collecting_evidence";
  if (eligibility.nextStep === "handoff") return "handoff_required";
  return "waiting_for_customer";
}

export async function prepareAndApproveServiceAction(input: {
  caseId: string;
  caseToken: string;
  actionType: "refund" | "return_and_refund" | "replacement" | "collect_evidence" | "human_handoff";
  preview: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("traceguide_prepare_and_approve_action", {
    p_case_id: input.caseId,
    p_case_token: input.caseToken,
    p_action_type: input.actionType,
    p_preview: input.preview,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function createServiceHandoff(input: {
  caseId: string;
  caseToken: string;
  reasonCode: string;
  summary: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc("traceguide_create_handoff", {
    p_case_id: input.caseId,
    p_case_token: input.caseToken,
    p_reason_code: input.reasonCode,
    p_summary: input.summary,
  });

  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function getServiceCase(input: {
  caseId: string;
  caseToken: string;
}) {
  const { data, error } = await supabase.rpc("traceguide_get_service_case", {
    p_case_id: input.caseId,
    p_case_token: input.caseToken,
  });

  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function confirmServiceCaseEvidence(input: {
  caseId: string;
  caseToken: string;
  storagePath: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  fileSizeBytes: number;
}) {
  const { data, error } = await supabase.rpc("traceguide_confirm_evidence_upload", {
    p_case_id: input.caseId,
    p_case_token: input.caseToken,
    p_storage_path: input.storagePath,
    p_mime_type: input.mimeType,
    p_file_size_bytes: input.fileSizeBytes,
  });

  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function markServiceCaseEvidenceRemoved(input: {
  caseId: string;
  caseToken: string;
  storagePath: string;
}) {
  const { data, error } = await supabase.rpc("traceguide_mark_evidence_removed", {
    p_case_id: input.caseId,
    p_case_token: input.caseToken,
    p_storage_path: input.storagePath,
  });

  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function recordServiceCaseToolEvents(input: {
  runtime: ServiceCaseRuntime;
  events: TraceGuideToolEvent[];
}) {
  const results = [];
  for (const event of input.events) {
    const { data, error } = await supabase.rpc("traceguide_record_tool_event", {
      p_case_id: input.runtime.caseId,
      p_case_token: input.runtime.caseToken,
      p_tool_name: event.toolName,
      p_status: event.status,
      p_input: event.input,
      p_output: event.output,
      p_error_code: null,
      p_error_message: null,
    });
    if (error) throw new Error(error.message);
    results.push(data as string);
  }
  return results;
}
