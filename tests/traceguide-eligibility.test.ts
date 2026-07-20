import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDamagedItemEligibility } from "../lib/traceguide-eligibility.ts";

const validCase = {
  orderStatus: "delivered" as const,
  deliveredDaysAgo: 2,
  itemReportedDamaged: true,
  evidenceStatus: "photos_provided" as const,
  returnWindowDays: 30,
  evidenceRequiredBeforeReview: true,
  refundAllowed: true,
  replacementAllowed: true,
};

test("allows a damaged delivered item with evidence inside the policy window", () => {
  const decision = evaluateDamagedItemEligibility(validCase);

  assert.equal(decision.outcome, "eligible");
  assert.equal(decision.canPrepareAction, true);
  assert.deepEqual(decision.availableResolutions, ["refund", "replacement"]);
  assert.equal(decision.nextStep, "prepare_resolution");
});

test("requires evidence before preparing the action when policy requires a photo", () => {
  const decision = evaluateDamagedItemEligibility({
    ...validCase,
    evidenceStatus: "not_added",
  });

  assert.equal(decision.outcome, "needs_evidence");
  assert.equal(decision.canPrepareAction, false);
  assert.deepEqual(decision.reasonCodes, ["PHOTO_EVIDENCE_REQUIRED"]);
  assert.equal(decision.nextStep, "collect_evidence");
});

test("stops the standard flow when the order is outside the return window", () => {
  const decision = evaluateDamagedItemEligibility({
    ...validCase,
    deliveredDaysAgo: 31,
  });

  assert.equal(decision.outcome, "ineligible");
  assert.equal(decision.canPrepareAction, false);
  assert.deepEqual(decision.reasonCodes, ["OUTSIDE_RETURN_WINDOW"]);
  assert.equal(decision.nextStep, "stop");
});

test("hands off when the order record does not show a delivered item", () => {
  const decision = evaluateDamagedItemEligibility({
    ...validCase,
    orderStatus: "in_transit",
  });

  assert.equal(decision.outcome, "needs_human_review");
  assert.equal(decision.requiresHumanReview, true);
  assert.deepEqual(decision.reasonCodes, ["ORDER_NOT_DELIVERED"]);
});

test("hands off rather than inventing an action when policy offers no resolution", () => {
  const decision = evaluateDamagedItemEligibility({
    ...validCase,
    refundAllowed: false,
    replacementAllowed: false,
  });

  assert.equal(decision.outcome, "needs_human_review");
  assert.equal(decision.canPrepareAction, false);
  assert.deepEqual(decision.reasonCodes, ["NO_AUTOMATED_RESOLUTION"]);
});

