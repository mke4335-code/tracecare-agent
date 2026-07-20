export type ServiceCaseStage =
  | "understanding_request"
  | "reading_context"
  | "collecting_evidence"
  | "checking_policy"
  | "evaluating_eligibility"
  | "preparing_answer"
  | "presenting_options"
  | "waiting_for_customer"
  | "waiting_for_approval"
  | "executing_action"
  | "request_submitted"
  | "human_handoff"
  | "resolved"
  | "failed"
  | "cancelled";

export type ServiceCaseEvent =
  | "REQUEST_UNDERSTOOD"
  | "CONTEXT_LOADED"
  | "EVIDENCE_REQUIRED"
  | "EVIDENCE_ADDED"
  | "POLICY_LOADED"
  | "ELIGIBILITY_READY"
  | "ANSWER_READY"
  | "OPTIONS_PRESENTED"
  | "APPROVED"
  | "DECLINED"
  | "ACTION_SUCCEEDED"
  | "ACTION_FAILED"
  | "HANDOFF_REQUESTED"
  | "HANDOFF_QUEUED"
  | "RETRY"
  | "CANCEL";

const transitions: Record<
  ServiceCaseStage,
  Partial<Record<ServiceCaseEvent, ServiceCaseStage>>
> = {
  understanding_request: {
    REQUEST_UNDERSTOOD: "reading_context",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  reading_context: {
    CONTEXT_LOADED: "checking_policy",
    EVIDENCE_REQUIRED: "collecting_evidence",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  collecting_evidence: {
    EVIDENCE_ADDED: "checking_policy",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  checking_policy: {
    POLICY_LOADED: "evaluating_eligibility",
    EVIDENCE_REQUIRED: "collecting_evidence",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  evaluating_eligibility: {
    ELIGIBILITY_READY: "preparing_answer",
    EVIDENCE_REQUIRED: "collecting_evidence",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  preparing_answer: {
    ANSWER_READY: "presenting_options",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  presenting_options: {
    OPTIONS_PRESENTED: "waiting_for_approval",
    EVIDENCE_REQUIRED: "collecting_evidence",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  waiting_for_customer: {
    EVIDENCE_ADDED: "checking_policy",
    APPROVED: "executing_action",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  waiting_for_approval: {
    APPROVED: "executing_action",
    DECLINED: "waiting_for_customer",
    EVIDENCE_REQUIRED: "collecting_evidence",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  executing_action: {
    ACTION_SUCCEEDED: "request_submitted",
    ACTION_FAILED: "failed",
    HANDOFF_REQUESTED: "human_handoff",
  },
  request_submitted: {
    ACTION_SUCCEEDED: "resolved",
    HANDOFF_REQUESTED: "human_handoff",
  },
  human_handoff: {
    HANDOFF_QUEUED: "resolved",
    ACTION_FAILED: "failed",
    RETRY: "human_handoff",
  },
  resolved: {},
  failed: {
    RETRY: "reading_context",
    HANDOFF_REQUESTED: "human_handoff",
    CANCEL: "cancelled",
  },
  cancelled: {},
};

export class InvalidServiceCaseTransitionError extends Error {
  constructor(stage: ServiceCaseStage, event: ServiceCaseEvent) {
    super(`Cannot apply ${event} while service case is ${stage}.`);
    this.name = "InvalidServiceCaseTransitionError";
  }
}

export function transitionServiceCase(
  stage: ServiceCaseStage,
  event: ServiceCaseEvent
): ServiceCaseStage {
  const next = transitions[stage][event];
  if (!next) throw new InvalidServiceCaseTransitionError(stage, event);
  return next;
}

export function canTransitionServiceCase(
  stage: ServiceCaseStage,
  event: ServiceCaseEvent
) {
  return Boolean(transitions[stage][event]);
}

export function serviceCaseStatusForStage(stage: ServiceCaseStage) {
  if (stage === "waiting_for_approval") return "waiting_for_approval" as const;
  if (stage === "waiting_for_customer" || stage === "collecting_evidence") {
    return "waiting_for_customer" as const;
  }
  if (stage === "executing_action") return "executing" as const;
  if (stage === "human_handoff") return "handed_off" as const;
  if (stage === "resolved" || stage === "request_submitted") return "resolved" as const;
  if (stage === "failed") return "failed" as const;
  if (stage === "cancelled") return "cancelled" as const;
  return "open" as const;
}
