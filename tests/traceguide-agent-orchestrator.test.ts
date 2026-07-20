import assert from "node:assert/strict";
import test from "node:test";

import { orchestrateDamagedItemCase } from "../lib/traceguide-agent-orchestrator.ts";
import { getCommerceContext } from "../lib/traceguide-commerce-data.ts";

const policy = {
  returnWindowDays: 30,
  evidenceRequiredBeforeReview: true,
  refundAllowed: true,
  replacementAllowed: true,
};

test("agent trace reflects real read tools and an approval gate", () => {
  const run = orchestrateDamagedItemCase({
    goal: "The glass lunch box arrived damaged. Can I return it?",
    context: getCommerceContext("glass_damaged_refund", "S1-T1"),
    policy,
  });

  assert.equal(run.outcome, "eligible");
  assert.equal(run.requiresBuyerApproval, true);
  assert.deepEqual(
    run.toolEvents.map((event) => event.toolName),
    [
      "understand_request",
      "get_order_detail",
      "get_evidence_status",
      "get_active_policy",
      "evaluate_eligibility",
      "prepare_buyer_options",
    ]
  );
});

test("agent trace cannot offer a refund when evidence is missing", () => {
  const run = orchestrateDamagedItemCase({
    goal: "My snack package is damaged but I have no photo.",
    context: getCommerceContext("coffee_maker_damaged_no_photo", "S2-T2"),
    policy,
  });

  assert.equal(run.outcome, "needs_evidence");
  assert.equal(run.requiresBuyerApproval, false);
  assert.deepEqual(run.availableActions, ["add_evidence", "human_handoff"]);
});
