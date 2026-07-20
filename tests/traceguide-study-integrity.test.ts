import assert from "node:assert/strict";
import test from "node:test";

import { getCommerceContext } from "../lib/traceguide-commerce-data.ts";
import { resolveTraceguideStudyTask } from "../lib/traceguide-study-config.ts";

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
