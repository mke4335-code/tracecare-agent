# TraceGuide Agent UX Study Execution Plan

## Study goal

Research question:

> How does verifiable AI advice interaction support user decision-making in e-commerce agent tasks?

This is a small-sample within-subject UX study, not a high-traffic product A/B test. Every participant uses both versions so individual differences in shopping experience, AI familiarity, and risk tolerance are controlled as much as possible.

## Conditions

- Condition A — Baseline AI Support: same backend, task data, knowledge sources and AI answer logic, but no source anchors, no source overview, no AI-understanding check and no variable correction.
- Condition B — TraceGuide Agent: same backend, task data, knowledge sources and AI answer logic, plus the verifiable interaction layer: source anchors, source overview, sources used, AI understanding, editable user-side variables, and confirmation before simulated service action.

The independent variable is the visible verifiable interaction layer. Do not change the task wording, backend scenario, AI capability or task difficulty between conditions.

## Final tasks

Each participant completes four tasks: two in Baseline and two in TraceGuide. The tasks are split into two matched scenario sets. Each set has one advice-adoption task and one service-authorisation task.

| Task ID | Set | Task type | User task | Correct next step |
|---|---|---|---|---|
| S1-T1 | Set 1 | Product safety advice | I’m allergic to peanuts. Can I eat these milk cookies? | Do not eat the product; optionally ask human support if still unsure. |
| S1-T2 | Set 1 | After-sales authorisation | The glass lunch box arrived damaged. Can I return it? | Authorise the agent to prepare a return/refund request. |
| S2-T1 | Set 2 | Product safety advice | I’m allergic to peanuts. Can I eat this protein bar? | Do not eat the product; optionally ask human support if still unsure. |
| S2-T2 | Set 2 | After-sales authorisation | The snack package arrived damaged, but I have not added a photo yet. Can I get a refund? | Add photo/evidence first or ask human support; do not directly authorise the request yet. |

## Counterbalancing

Use two groups.

| Group | First block | Second block |
|---|---|---|
| G1 | Baseline + Set 1 | TraceGuide + Set 2 |
| G2 | TraceGuide + Set 1 | Baseline + Set 2 |

This means each participant fills the Version Block Survey twice: once after completing the two tasks in Baseline, and once after completing the two tasks in TraceGuide.

## Participant flow

1. Give the participant a code, e.g. P01.
2. Assign a group: odd-numbered participants can use G1, even-numbered participants can use G2.
3. Participant completes the Pre-test form once.
4. Participant opens the first prototype version and completes two assigned tasks.
5. After completing both tasks in that prototype version, participant fills the Version Block Survey once.
6. Participant opens the second prototype version and completes two assigned tasks.
7. After completing both tasks in that prototype version, participant fills the Version Block Survey once.
8. Participant completes the Post-test form once.
9. Optional: 5-minute interview about what helped or confused them.

## Prototype links

- Task guide: https://tracecare-agent.vercel.app/traceguide-task-guide
- Baseline: https://tracecare-agent.vercel.app/traceguide-baseline
- TraceGuide: https://tracecare-agent.vercel.app/traceguide-demo

Use query parameters when you want to open a specific task directly:

```text
?pid=P01&task=S1-T1
```

Example:

```text
https://tracecare-agent.vercel.app/traceguide-demo?pid=P01&task=S1-T1
```

Participants can also return to the task selection screen inside the prototype, choose another suggested task, or type their own question. This avoids forcing a browser refresh between tasks.

## Primary metric

Decision appropriateness, scored 0–2.

- 2 = participant chose a next step aligned with the scenario ground truth.
- 1 = participant recognised uncertainty and paused / checked more / asked human support, but did not fully identify the best next step.
- 0 = participant made an inappropriate next step, such as eating a risky product or authorising a request before required evidence.

This metric is the main evidence for the research question.

## Secondary measures

- Decision ease.
- Decision confidence.
- Task satisfaction: ASQ, 3 items per task, collected inside the Version Block Survey.
- Usability: SUS, 10 items after both versions.
- Workload: Raw NASA-TLX, 6 dimensions after both versions.
- Perceived decision support.
- Study-specific TraceGuide items: source understanding and perceived control. These are not validated scales and should be reported as exploratory/item-level results.

## Analysis

Use paired analysis because every participant uses both versions.

- Continuous outcomes: paired t-test if differences look approximately normal; otherwise Wilcoxon signed-rank test.
- Correct/incorrect decision counts: McNemar test can be used if converted to binary.
- Report descriptive statistics: mean, median, standard deviation and 95% confidence interval.
- Do not claim broad causal proof from 16–20 participants. Report whether TraceGuide showed a stronger decision-support pattern in this controlled UX study.

## What this study can and cannot prove

This study can test whether visible source evidence, AI-understanding checks, variable correction and confirmation help users make more appropriate next-step decisions in controlled e-commerce agent tasks.

It cannot prove that the system would reduce real refund costs, improve all customer-service outcomes, or perform safely on every real-world product/order case.
