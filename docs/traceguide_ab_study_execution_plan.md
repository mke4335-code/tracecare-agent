# TraceGuide Agent UX Study Execution Plan

## Study goal

Research question:

> How does verifiable AI advice interaction support user decision-making in e-commerce agent tasks?

This is a small-sample within-subject UX experiment, not a high-traffic product A/B test. Each participant uses both versions so that differences are less affected by individual shopping habits, AI familiarity, or confidence.

## Conditions

- Condition A — Baseline AI Support: same AI/backend/data, but no source anchors, no source overview, no AI-understanding check, and no variable correction.
- Condition B — TraceGuide Agent: same AI/backend/data, plus verifiable interaction layer: source anchors, source overview, sources used, AI understanding, variable correction, and confirmation before simulated service action.

The independent variable is the visible verifiable interaction layer. Do not change the task wording, backend scenario, AI capability, or task difficulty between conditions.

## Tasks

Each participant completes six tasks: three in Baseline and three in TraceGuide. The tasks are split into two matched sets to reduce learning effects.

| Task ID | Set | Task type | User task | Correct decision |
|---|---|---|---|---|
| S1-T1 | Set 1 | Product information decision | I’m allergic to peanuts. Can I eat these milk cookies? | Do not eat; product ingredient/allergen evidence shows peanut risk. |
| S1-T2 | Set 1 | Order modification decision | Can I change the delivery address for my coffee maker before it is shipped? | Can prepare an address-change request because the order is not dispatched; final confirmation required. |
| S1-T3 | Set 1 | Return/refund decision | The glass lunch box arrived damaged. Can I return it? | Can prepare refund request after confirmation. |
| S2-T1 | Set 2 | Product information decision | I’m allergic to peanuts. Can I eat this protein bar? | Do not eat; product allergen record includes peanut risk. |
| S2-T2 | Set 2 | Order modification decision | My fresh sandwich is already out for delivery. Can I change the delivery address? | Do not authorise normal address change; use human/courier review. |
| S2-T3 | Set 2 | Return/refund decision | The snack package arrived damaged, but I have not added a photo yet. Can I get a refund? | Do not directly authorise refund; add photo evidence or use human review first. |

## Counterbalancing

Assign participants evenly to four groups.

| Group | First condition | First set | Second condition | Second set |
|---|---|---|---|---|
| G1 | Baseline | Set 1 | TraceGuide | Set 2 |
| G2 | TraceGuide | Set 1 | Baseline | Set 2 |
| G3 | Baseline | Set 2 | TraceGuide | Set 1 |
| G4 | TraceGuide | Set 2 | Baseline | Set 1 |

This means every participant fills the Task Response form six times: once after each task. They should not compare both systems after every single task; they finish one task, record their decision and experience, then move to the next task.

## Participant flow

1. Give participant a participant code, e.g. P01.
2. Assign a group using the counterbalancing table.
3. Participant completes Pre-test form once.
4. Participant opens the first prototype link and completes three assigned tasks.
5. After each task, participant fills Task Response form once.
6. Participant opens the second prototype link and completes the other three tasks.
7. After each task, participant fills Task Response form once.
8. Participant completes Post-test form once.
9. Optional: 5-minute interview.

## Prototype links

- Baseline: https://tracecare-agent.vercel.app/traceguide-baseline
- TraceGuide: https://tracecare-agent.vercel.app/traceguide-demo

Use query parameters to make the correct task appear directly:

```text
?pid=P01&task=S1-T1
```

Example:

```text
https://tracecare-agent.vercel.app/traceguide-demo?pid=P01&task=S1-T1
```

## Primary metric

Decision appropriateness, scored 0–2.

- 2 = participant made the action decision that matches the scenario ground truth.
- 1 = participant recognised uncertainty and paused / asked for human support, but did not fully resolve the task.
- 0 = participant followed incorrect advice or authorised an inappropriate action.

This metric is the main evidence for the research question.

## Secondary measures

- Action-authorisation appropriateness.
- Objective comprehension: evidence, condition, action, and current status.
- Task satisfaction: ASQ, 3 items after each task.
- Usability: SUS, 10 items after each condition.
- Workload: Raw NASA-TLX, 6 dimensions after each condition.
- Study-specific items: evidence understanding and perceived control. These are not validated scales and should be reported as item-level or exploratory results.

## Analysis

Use paired analysis because every participant uses both versions.

- Continuous outcomes: paired t-test if differences look approximately normal; otherwise Wilcoxon signed-rank test.
- Binary correct/incorrect decisions: McNemar test.
- Report descriptive statistics even if the sample is small: mean, median, standard deviation, and 95% confidence interval.
- Do not claim broad causal proof from 16–20 participants. Report whether TraceGuide showed a better decision-support trend in this study.

## What this study can and cannot prove

This study can test whether visible source evidence, AI-understanding checks, variable correction, and execution confirmation help users make more appropriate decisions in controlled e-commerce agent tasks.

It cannot prove that the system would reduce real-world refund costs, improve all customer-service outcomes, or perform safely on every product/order case.

