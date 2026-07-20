import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidServiceCaseTransitionError,
  serviceCaseStatusForStage,
  transitionServiceCase,
  type ServiceCaseEvent,
  type ServiceCaseStage,
} from "../lib/traceguide-service-state.ts";

function traverse(start: ServiceCaseStage, events: ServiceCaseEvent[]) {
  return events.reduce(transitionServiceCase, start);
}

test("eligible case cannot execute until buyer approval", () => {
  const stage = traverse("understanding_request", [
    "REQUEST_UNDERSTOOD",
    "CONTEXT_LOADED",
    "POLICY_LOADED",
    "ELIGIBILITY_READY",
    "ANSWER_READY",
    "OPTIONS_PRESENTED",
  ]);

  assert.equal(stage, "waiting_for_approval");
  assert.equal(transitionServiceCase(stage, "APPROVED"), "executing_action");
  assert.throws(
    () => transitionServiceCase("presenting_options", "APPROVED"),
    InvalidServiceCaseTransitionError
  );
});

test("missing evidence pauses the case and resumes after evidence is added", () => {
  const paused = traverse("understanding_request", [
    "REQUEST_UNDERSTOOD",
    "CONTEXT_LOADED",
    "EVIDENCE_REQUIRED",
  ]);
  assert.equal(paused, "collecting_evidence");
  assert.equal(transitionServiceCase(paused, "EVIDENCE_ADDED"), "checking_policy");
});

test("approved action follows an auditable submission path", () => {
  const finalStage = traverse("waiting_for_approval", [
    "APPROVED",
    "ACTION_SUCCEEDED",
    "ACTION_SUCCEEDED",
  ]);
  assert.equal(finalStage, "resolved");
  assert.equal(serviceCaseStatusForStage(finalStage), "resolved");
});

test("failed action can be handed to a human", () => {
  const finalStage = traverse("executing_action", [
    "ACTION_FAILED",
    "HANDOFF_REQUESTED",
    "HANDOFF_QUEUED",
  ]);
  assert.equal(finalStage, "resolved");
});

test("terminal cases reject further actions", () => {
  assert.throws(
    () => transitionServiceCase("resolved", "RETRY"),
    InvalidServiceCaseTransitionError
  );
  assert.throws(
    () => transitionServiceCase("cancelled", "APPROVED"),
    InvalidServiceCaseTransitionError
  );
});
