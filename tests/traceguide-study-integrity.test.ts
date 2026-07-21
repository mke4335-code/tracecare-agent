import assert from "node:assert/strict";
import test from "node:test";

import { getCommerceContext } from "../lib/traceguide-commerce-data.ts";
import { resolveTraceguideStudyTask, traceguideStudyTasks } from "../lib/traceguide-study-config.ts";
import { runDamagedItemProcedure } from "../lib/traceguide-damaged-item-procedure.ts";

const policy = {
  returnWindowDays: 30,
  evidenceRequiredBeforeReview: true,
  refundAllowed: true,
  replacementAllowed: true,
};

test("a new task cannot inherit evidence supplied by a previous client state", () => {
  const context = getCommerceContext("container_set_damaged_no_photo", "S1-T2", {
    issueIdentified: "Not damaged",
    request: "Refund",
    reason: "One container arrived cracked",
    evidence: "Photos provided",
  });

  assert.equal(context.variables.issueIdentified, "Damaged item");
  assert.equal(context.variables.evidence, "Photo not added");
  assert.equal(context.evidence.status, "not_added");
});

test("unsupported free text is not silently mapped to a study order", () => {
  assert.equal(resolveTraceguideStudyTask("Can I change my delivery address?"), null);
});

test("each counterbalanced set contains three matched decision states", () => {
  assert.equal(traceguideStudyTasks.filter((task) => task.set === "1").length, 3);
  assert.equal(traceguideStudyTasks.filter((task) => task.set === "2").length, 3);

  const scenarios = {
    "S1-T1": "glass_damaged_refund",
    "S1-T2": "container_set_damaged_no_photo",
    "S1-T3": "snack_damaged_outside_window",
    "S2-T1": "glass_container_broken",
    "S2-T2": "coffee_maker_damaged_no_photo",
    "S2-T3": "cookies_damaged_outside_window",
  } as const;

  for (const set of ["1", "2"] as const) {
    const outcomes = traceguideStudyTasks
      .filter((task) => task.set === set)
      .map((task) => runDamagedItemProcedure(getCommerceContext(scenarios[task.id], task.id), policy).eligibility.outcome);
    assert.deepEqual(outcomes, ["eligible", "needs_evidence", "ineligible"]);
  }
});

test("all six study task prompts resolve to their own order and product", () => {
  const ids = traceguideStudyTasks.map((task) => resolveTraceguideStudyTask(task.prompt)?.id);
  assert.deepEqual(ids, traceguideStudyTasks.map((task) => task.id));

  const set1Images = [
    getCommerceContext("glass_damaged_refund", "S1-T1").product.image,
    getCommerceContext("container_set_damaged_no_photo", "S1-T2").product.image,
    getCommerceContext("snack_damaged_outside_window", "S1-T3").product.image,
  ];
  const set2Images = [
    getCommerceContext("glass_container_broken", "S2-T1").product.image,
    getCommerceContext("coffee_maker_damaged_no_photo", "S2-T2").product.image,
    getCommerceContext("cookies_damaged_outside_window", "S2-T3").product.image,
  ];
  assert.equal(new Set(set1Images).size, 3);
  assert.equal(new Set(set2Images).size, 3);
});
