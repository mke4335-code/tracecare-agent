# TraceGuide Questionnaire and Scoring Guide

## Existing Google Forms

Use the three existing forms as the study data collection tools:

1. Pre-test form: https://docs.google.com/forms/d/e/1FAIpQLSdgSdvrcQfdMyyU6cYt_zrGJrzSxT6iB8Nkx4nd075HlfywIA/viewform
2. Task Response form: https://docs.google.com/forms/d/e/1FAIpQLScrneO36mqJVbtJZ9PlMn1DSuPzFt77rinRhVhUHIFh1CzRfQ/viewform
3. Post-test form: https://docs.google.com/forms/d/e/1FAIpQLSe8tekTmhJ7O6h7WzB2jHDnh90zjuQ-2RZ6d96yvvEMSxeqcw/viewform

Google Forms stores responses in its Responses tab. To analyse the data, open each form, go to Responses, and link it to a Google Sheet. That response sheet is where the raw data lives.

## Why the Task Response form is filled six times

Each participant completes six tasks: three in Baseline and three in TraceGuide. The Task Response form captures the decision made immediately after each task, so it must be filled once per task.

Example for participant P01 in Group 1:

| Round | Prototype | Task | Form action |
|---|---|---|---|
| 1 | Baseline | S1-T1 | Fill Task Response once |
| 2 | Baseline | S1-T2 | Fill Task Response once |
| 3 | Baseline | S1-T3 | Fill Task Response once |
| 4 | TraceGuide | S2-T1 | Fill Task Response once |
| 5 | TraceGuide | S2-T2 | Fill Task Response once |
| 6 | TraceGuide | S2-T3 | Fill Task Response once |

Six rows per participant are required for within-subject paired comparison.

## Required Task Response fields

The Task Response form must include these fields:

- Participant code
- Group
- Condition: Baseline / TraceGuide
- Scenario set: Set 1 / Set 2
- Task ID: S1-T1, S1-T2, S1-T3, S2-T1, S2-T2, S2-T3
- What did you decide to do?
- Would you authorise the agent to start the suggested action?
- How easy was it to decide what to do? 1–7
- How confident are you in your decision? 1–7
- ASQ 1: Overall, I am satisfied with the ease of completing this task. 1–7
- ASQ 2: Overall, I am satisfied with the amount of time it took to complete this task. 1–7
- ASQ 3: Overall, I am satisfied with the support information when completing this task. 1–7
- Optional note

## Recommended decision options

Use the same answer options for all tasks:

1. Follow the AI advice and authorise the action.
2. Follow the advice but do not authorise an action yet.
3. Pause and check more information first.
4. Add missing evidence or correct details first.
5. Ask human support.
6. Do not follow the AI advice.

## Decision scoring key

Primary outcome: Decision appropriateness, 0–2.

| Task ID | Best decision option | Score |
|---|---|---|
| S1-T1 | Do not follow the AI advice / Ask human support if unsure | 2 |
| S1-T2 | Follow the AI advice and authorise the action | 2 |
| S1-T3 | Follow the AI advice and authorise the action | 2 |
| S2-T1 | Do not follow the AI advice / Ask human support if unsure | 2 |
| S2-T2 | Ask human support / Pause and check more information first | 2 |
| S2-T3 | Add missing evidence or correct details first / Ask human support | 2 |

Score 1 is used when the participant recognises uncertainty and pauses, but does not choose the best next action. Score 0 is used when the participant authorises an inappropriate action or follows incorrect advice.

## SUS scoring

Use full SUS 10 items after each condition.

For each condition:

```text
SUS = ((Q1-1) + (5-Q2) + (Q3-1) + (5-Q4) + (Q5-1) + (5-Q6) + (Q7-1) + (5-Q8) + (Q9-1) + (5-Q10)) * 2.5
```

Do not call a four-item usability measure SUS. SUS is 10 items.

## Raw NASA-TLX scoring

Use six dimensions:

- Mental Demand
- Physical Demand
- Temporal Demand
- Performance
- Effort
- Frustration

Raw NASA-TLX score:

```text
Average of the six dimension ratings
```

## ASQ scoring

ASQ is collected after each task with three 7-point items. Task ASQ score:

```text
ASQ mean = average(ASQ1, ASQ2, ASQ3)
```

Higher score means higher task satisfaction.

## Study-specific items

Label these clearly as:

> Study-specific items — not a validated scale.

Suggested items after each condition:

- I could tell what evidence the AI used for its answer.
- I understood which details affected the AI’s recommendation.
- I knew what the agent was about to do before I confirmed.
- I felt able to correct the agent if it misunderstood the situation.

These can support interpretation but should not be presented as a validated new scale.

## Main analysis table

After collecting responses, create one row per participant and condition:

| Participant | Condition | Decision mean | Correct task count | ASQ mean | SUS | Raw NASA-TLX | Evidence understanding mean | Perceived control mean |
|---|---|---:|---:|---:|---:|---:|---:|---:|

Then compare Baseline vs TraceGuide within each participant.

Primary claim should be based on Decision mean / Correct task count, not just satisfaction.

