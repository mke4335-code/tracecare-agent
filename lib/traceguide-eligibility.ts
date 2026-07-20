export type EvidenceState = "not_added" | "photos_provided" | "not_required" | "unclear";

export type OrderState = "processing" | "out_for_delivery" | "delivered" | "in_transit";

export type EligibilityOutcome =
  | "eligible"
  | "needs_evidence"
  | "needs_human_review"
  | "ineligible";

export type DamagedItemEligibilityInput = {
  orderStatus: OrderState;
  deliveredDaysAgo: number;
  itemReportedDamaged: boolean;
  evidenceStatus: EvidenceState;
  returnWindowDays: number;
  evidenceRequiredBeforeReview: boolean;
  refundAllowed: boolean;
  replacementAllowed: boolean;
};

export type EligibilityDecision = {
  outcome: EligibilityOutcome;
  canPrepareAction: boolean;
  requiresHumanReview: boolean;
  availableResolutions: Array<"refund" | "replacement">;
  reasonCodes: string[];
  buyerMessage: string;
  nextStep: "prepare_resolution" | "collect_evidence" | "handoff" | "stop";
};

/**
 * Deterministic service rule for the damaged-item procedure.
 *
 * The language model may explain this result, but it must not override it.
 * This keeps policy enforcement separate from answer generation.
 */
export function evaluateDamagedItemEligibility(
  input: DamagedItemEligibilityInput
): EligibilityDecision {
  const availableResolutions: EligibilityDecision["availableResolutions"] = [];
  if (input.refundAllowed) availableResolutions.push("refund");
  if (input.replacementAllowed) availableResolutions.push("replacement");

  if (!input.itemReportedDamaged) {
    return {
      outcome: "needs_human_review",
      canPrepareAction: false,
      requiresHumanReview: true,
      availableResolutions: [],
      reasonCodes: ["DAMAGE_NOT_CONFIRMED"],
      buyerMessage: "I need to confirm what is wrong with the item before preparing a request.",
      nextStep: "handoff",
    };
  }

  if (input.orderStatus !== "delivered") {
    return {
      outcome: "needs_human_review",
      canPrepareAction: false,
      requiresHumanReview: true,
      availableResolutions: [],
      reasonCodes: ["ORDER_NOT_DELIVERED"],
      buyerMessage: "The order is not recorded as delivered, so this needs support review.",
      nextStep: "handoff",
    };
  }

  if (input.deliveredDaysAgo < 0 || input.returnWindowDays <= 0) {
    return {
      outcome: "needs_human_review",
      canPrepareAction: false,
      requiresHumanReview: true,
      availableResolutions: [],
      reasonCodes: ["INVALID_ORDER_OR_POLICY_DATA"],
      buyerMessage: "The order or policy information is incomplete, so this needs support review.",
      nextStep: "handoff",
    };
  }

  if (input.deliveredDaysAgo > input.returnWindowDays) {
    return {
      outcome: "ineligible",
      canPrepareAction: false,
      requiresHumanReview: false,
      availableResolutions: [],
      reasonCodes: ["OUTSIDE_RETURN_WINDOW"],
      buyerMessage: "This order is outside the standard damaged-item return window.",
      nextStep: "stop",
    };
  }

  if (!availableResolutions.length) {
    return {
      outcome: "needs_human_review",
      canPrepareAction: false,
      requiresHumanReview: true,
      availableResolutions: [],
      reasonCodes: ["NO_AUTOMATED_RESOLUTION"],
      buyerMessage: "No automatic resolution is available for this order, so a human needs to review it.",
      nextStep: "handoff",
    };
  }

  if (
    input.evidenceRequiredBeforeReview &&
    input.evidenceStatus !== "photos_provided"
  ) {
    return {
      outcome: "needs_evidence",
      canPrepareAction: false,
      requiresHumanReview: input.evidenceStatus === "unclear",
      availableResolutions,
      reasonCodes: [
        input.evidenceStatus === "unclear" ? "EVIDENCE_UNCLEAR" : "PHOTO_EVIDENCE_REQUIRED",
      ],
      buyerMessage:
        input.evidenceStatus === "unclear"
          ? "The evidence is unclear. Add a clear photo or ask human support to review it."
          : "Add a photo of the damaged item and packaging before the request is prepared.",
      nextStep: "collect_evidence",
    };
  }

  return {
    outcome: "eligible",
    canPrepareAction: true,
    requiresHumanReview: false,
    availableResolutions,
    reasonCodes: [
      "DAMAGE_CONFIRMED",
      "ORDER_DELIVERED",
      "WITHIN_RETURN_WINDOW",
      input.evidenceRequiredBeforeReview ? "EVIDENCE_PRESENT" : "EVIDENCE_NOT_REQUIRED",
    ],
    buyerMessage: "This item is eligible for a damaged-item resolution.",
    nextStep: "prepare_resolution",
  };
}

