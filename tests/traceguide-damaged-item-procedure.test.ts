import assert from "node:assert/strict";
import test from "node:test";

import type { CommerceContext } from "../lib/traceguide-commerce-data.ts";
import { getCommerceContext } from "../lib/traceguide-commerce-data.ts";
import { runDamagedItemProcedure } from "../lib/traceguide-damaged-item-procedure.ts";

const policy = {
  returnWindowDays: 30,
  evidenceRequiredBeforeReview: true,
  refundAllowed: true,
  replacementAllowed: true,
};

test("eligible damaged-item case waits for explicit buyer approval", () => {
  const context = getCommerceContext("glass_damaged_refund", "S1-T1");
  const result = runDamagedItemProcedure(context, policy);

  assert.equal(result.currentStage, "waiting_for_approval");
  assert.equal(result.requiresBuyerApproval, true);
  assert.deepEqual(result.availableActions, [
    "prepare_refund",
    "prepare_replacement",
    "human_handoff",
  ]);
});

test("missing evidence presents collection rather than a refund action", () => {
  const context = getCommerceContext("coffee_maker_damaged_no_photo", "S2-T2");
  const result = runDamagedItemProcedure(context, policy);

  assert.equal(result.currentStage, "collecting_evidence");
  assert.equal(result.requiresBuyerApproval, false);
  assert.deepEqual(result.availableActions, ["add_evidence", "human_handoff"]);
});

test("unverified delivery state routes to a human instead of inventing eligibility", () => {
  const original = getCommerceContext("glass_damaged_refund", "S1-T1");
  const context: CommerceContext = {
    ...original,
    order: { ...original.order, status: "in_transit" },
  };
  const result = runDamagedItemProcedure(context, policy);

  assert.equal(result.currentStage, "human_handoff");
  assert.deepEqual(result.availableActions, ["human_handoff"]);
});
