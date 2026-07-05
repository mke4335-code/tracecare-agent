# TraceGuide Real Agent A/B Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing TraceGuide Baseline and TraceGuide Demo prototypes into a grounded, backend-backed within-subject UX experiment covering product information, order modification, and return/refund decisions.

**Architecture:** Both `/traceguide-baseline` and `/traceguide-demo` call the same `/api/traceguide-chat` backend. The backend loads scenario-specific commerce records, knowledge documents, task variables, guardrails, and action-state decisions. Baseline hides verification affordances; TraceGuide exposes source evidence, AI understanding, editable user-facing variables, and confirmation states.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase client, Google Forms/Sheets-compatible questionnaire and scoring templates.

---

## Scope and Quality Gates

- Keep existing routes: `/traceguide-baseline` and `/traceguide-demo`.
- Keep the same AI/backend for both variants; only the visible interaction layer differs.
- Use three decision categories:
  1. Product information decision
  2. Order modification decision
  3. Return/refund decision
- Do not expose chain-of-thought, raw tool names, MCP internals, or raw retrieval scores to participants.
- Do not display confidence percentage in the buyer UI.
- Do not require MCP for this prototype; model the Agent as internal tools, workflow state, guardrails, and logs.
- Verify with `npm run build` and API calls for all six task IDs.

## Files

- Modify: `/Users/make/tracecare-agent/lib/traceguide-commerce-data.ts`
- Modify: `/Users/make/tracecare-agent/app/api/traceguide-chat/route.ts`
- Modify: `/Users/make/tracecare-agent/app/api/traceguide-action/route.ts`
- Modify: `/Users/make/tracecare-agent/app/traceguide-demo/page.tsx`
- Modify: `/Users/make/tracecare-agent/app/traceguide-baseline/page.tsx`
- Modify: `/Users/make/tracecare-agent/supabase/traceguide_research_commerce_seed.sql`
- Create: `/Users/make/tracecare-agent/docs/traceguide_ab_study_execution_plan.md`
- Create: `/Users/make/tracecare-agent/docs/traceguide_questionnaire_update_guide.md`
- Create: `/Users/make/tracecare-agent/docs/traceguide_scoring_sheet_template.csv`

---

### Task 1: Backend commerce data and task structure

- [ ] Extend product/order types for `coffee-maker`, `protein-bar`, `processing`, and `out_for_delivery`.
- [ ] Add commerce records for Coffee Maker address change and Protein Bar allergen safety.
- [ ] Remap six experiment tasks:
  - `S1-T1`: Milk Cookies peanut allergy
  - `S1-T2`: Coffee Maker address change before dispatch
  - `S1-T3`: Glass Lunch Box damaged refund
  - `S2-T1`: Protein Bar peanut allergy
  - `S2-T2`: Fresh Sandwich address change after dispatch
  - `S2-T3`: Snack Pack damaged package without evidence
- [ ] Update SQL seed with the same tasks and records.

### Task 2: Agent API scenario, rules, and guardrails

- [ ] Add API scenarios for `protein_bar_allergen_safety`, `coffee_maker_address_change`, and `fresh_sandwich_address_change`.
- [ ] Update `detectScenario()` task ID mapping and free-text routing.
- [ ] Update `taskTypeFor()`, `actionStateFor()`, and `assessVariables()` so product information is advice-only, address modification can be ready or human-review, and refund needs confirmation/evidence.
- [ ] Update guardrails so allergy answers cannot imply safe eating and out-for-delivery orders cannot imply normal address change.
- [ ] Keep returned confidence as backend diagnostic only; do not require frontend display.

### Task 3: Baseline and TraceGuide prototype task updates

- [ ] Update both frontends to the new six task labels and questions.
- [ ] Add product image handling for `coffee-maker` and `protein-bar`.
- [ ] Keep Baseline simple: question, product/order card, direct answer, action prompt.
- [ ] Keep TraceGuide enhanced: citations, source tags, source sheets, AI understanding, variable edit/recheck.
- [ ] Ensure source/AI-understanding buttons do not use icons.

### Task 4: Questionnaire and scoring package

- [ ] Create experiment execution plan explaining participant flow, counterbalancing, and tasks.
- [ ] Create questionnaire update guide for the existing three Google Forms:
  - Pre-test form
  - Task Response form
  - Post-test form
- [ ] Create scoring CSV template with scoring keys for six tasks, SUS, NASA-TLX, ASQ, and condition comparison.
- [ ] Make clear where responses are collected and how the spreadsheet computes results.

### Task 5: Verification

- [ ] Run `npm run build`.
- [ ] Call `/api/traceguide-chat` locally or through Next build-compatible route for all six task IDs.
- [ ] Check that Baseline and TraceGuide still compile.
- [ ] Report exact verification evidence and remaining limitations.
