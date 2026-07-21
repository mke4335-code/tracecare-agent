# TraceGuide Agent UX Study Execution Plan — Three Tasks per Version

## Study goal

Research question:

> How does verifiable AI advice interaction support user decision-making in e-commerce agent tasks?

This is a within-subject, counterbalanced UX study. Every participant uses both versions. Both versions run the same damaged-item procedure, order records, policy retrieval, eligibility rules and action boundary. The only experimental difference is that TraceGuide makes the evidence and task conditions directly inspectable and correctable.

## Conditions

- **Baseline:** answer, next-step action, evidence upload, action preview, confirmation and human support. It does not expose source anchors, source-to-claim mapping or a structured request-details review.
- **TraceGuide:** the same underlying response and service functions, plus source anchors, source overview, sources used and `Review request details`.

Baseline must still allow normal conversational correction. Otherwise the study would compare unequal service capability rather than verifiable interaction.

## Final matched task sets

Each set contains the same three decision states in the same order.

| Position | Decision state | Set 1 | Set 2 | Appropriate next step |
|---|---|---|---|---|
| T1 | Evidence complete, inside 30 days | S1-T1 Glass Lunch Box | S2-T1 Glass Food Container | Allow the agent to prepare the request, then review it before confirmation. |
| T2 | Required evidence missing | S1-T2 Glass Food Containers Set | S2-T2 Coffee Maker | Add a clear photo first or ask human support; do not authorise yet. |
| T3 | Evidence complete, delivered 45 days ago | S1-T3 Snack Pack | S2-T3 Milk Cookies | Do not authorise a standard request; stop or ask human support because it is outside the standard window. |

The products and wording differ between sets to reduce repetition. The policy rule, missing-field count, correct decision and difficulty position are matched.

## Counterbalancing

| Group | First prototype block | Second prototype block |
|---|---|---|
| Group A | Baseline + Set 1 (S1-T1–S1-T3) | TraceGuide + Set 2 (S2-T1–S2-T3) |
| Group B | TraceGuide + Set 1 (S1-T1–S1-T3) | Baseline + Set 2 (S2-T1–S2-T3) |

Assign odd participant codes to Group A and even participant codes to Group B. Keep group sizes as even as possible.

## Participant flow

1. Give the participant an anonymous code such as `P01`.
2. Tell them their assigned group. Do not let them choose the easier order.
3. Open the formal Microsoft Form and record participant code and group.
4. Complete the three tasks in the first assigned prototype.
5. Complete the form section labelled **First prototype**.
6. Complete the three tasks in the second assigned prototype.
7. Complete **Second prototype** and **Final comparison**, then submit the form once.
8. Optionally conduct a short interview without changing questionnaire answers.

Participants should act naturally. Do not require them to open sources or review details. Whether they choose to inspect optional information is part of the interaction behaviour.

## Links

- Task guide: https://tracecare-agent.vercel.app/traceguide-task-guide
- Baseline: https://tracecare-agent.vercel.app/traceguide-baseline
- TraceGuide: https://tracecare-agent.vercel.app/traceguide-demo
- Formal Microsoft Form: https://forms.office.com/Pages/ResponsePage.aspx?id=Px9DDcEgHEaVikaynU4CGyFIJAS1PnBEtJMitMjfzZxURFRLSFZIMkk0OFFSNEhPVjdCTU5CR0dQOC4u

Use `?pid=P01&task=S1-T1` to open a particular task directly. Participants can use the back control to return to all six task choices without refreshing the page.

## Primary outcome

`Decision appropriateness`, scored separately for each task:

- **2:** best next step for the recorded order, evidence and policy.
- **1:** safe but incomplete step, such as stopping or requesting human review without resolving the missing condition.
- **0:** inappropriate authorisation or continuation.

Compute each participant’s Baseline mean across three tasks and TraceGuide mean across three tasks. Compare these paired condition scores.

## Secondary outcomes

- Decision ease and decision confidence for each task.
- SUS for each version block.
- Perceived decision support, control, manageable workload and satisfaction.
- TraceGuide-only verifiability items, reported as study-specific exploratory items.
- Interaction logs: source opening, request-details review, evidence addition, approval, refusal and human handoff.

## Analysis boundary

Use paired analysis because every participant uses both versions. Report descriptive statistics, paired differences, 95% confidence intervals and an appropriate paired test. With 16–20 participants, present results as evidence from a controlled UX study, not universal causal proof.
