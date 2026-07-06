# TraceGuide Questionnaire and Scoring Guide

## Existing Google Forms

Use these three forms as the study data collection tools:

1. Pre-test form: https://docs.google.com/forms/d/e/1FAIpQLScrneO36mqJVbtJZ9PlMn1DSuPzFt77rinRhVhUHIFh1CzRfQ/viewform
2. Version Block Survey: https://docs.google.com/forms/d/e/1FAIpQLSdgSdvrcQfdMyyU6cYt_zrGJrzSxT6iB8Nkx4nd075HlfywIA/viewform
3. Final Comparison form: https://docs.google.com/forms/d/e/1FAIpQLSe8tekTmhJ7O6h7WzB2jHDnh90zjuQ-2RZ6d96yvvEMSxeqcw/viewform

The Version Block Survey is filled once after completing the two tasks in one prototype version. Because each participant uses two versions, each participant submits the Version Block Survey twice.

## Final task list

The Task ID question must contain exactly these four options:

1. `S1-T1 Product information — Milk Cookies peanut allergy`
2. `S1-T2 Return/refund — Glass Lunch Box arrived damaged`
3. `S2-T1 Product information — Protein Bar peanut allergy`
4. `S2-T2 Return/refund — Snack Package damaged, photo not added`

Remove old address-change, yoghurt, sandwich and six-task options before collecting real data.

## Version Block Survey fields

Each block response should include:

- Participant code.
- Sequence group: Group 1 or Group 2.
- Condition: A — Baseline AI customer service / B — TraceGuide Agent.
- Scenario set: Set 1 / Set 2.
- Task 1 ID.
- Task 1 next step, decision ease, decision confidence, reason and ASQ.
- Task 2 ID.
- Task 2 next step, decision ease, decision confidence, reason and ASQ.
- Version-level SUS.
- Version-level Raw NASA-TLX.
- Version-level perceived decision support.
- TraceGuide-only items, skipped if the block is Baseline.

## Next-step options

Use one shared option list so the form stays simple:

1. I would follow the AI advice and not eat the product.
2. I would still eat the product.
3. I would authorise the agent to prepare the request.
4. I would add photo/evidence first.
5. I would check more information first.
6. I would ask human support.
7. I would not continue with the request.
8. I am not sure.

## Decision scoring key

Primary outcome: decision appropriateness, 0–2.

| Task ID | Score 2 | Score 1 | Score 0 |
|---|---|---|---|
| S1-T1 Milk Cookies peanut allergy | Follow the AI advice and not eat; ask human support if still unsure | Check more information first / I am not sure | Still eat the product |
| S1-T2 Glass Lunch Box damaged | Authorise the agent to prepare the request | Check more information first / ask human support / I am not sure | Do not continue despite eligible damaged item |
| S2-T1 Protein Bar peanut allergy | Follow the AI advice and not eat; ask human support if still unsure | Check more information first / I am not sure | Still eat the product |
| S2-T2 Snack Package damaged, no photo | Add photo/evidence first; ask human support | Check more information first / I am not sure | Authorise the agent to prepare the request without evidence |

## SUS scoring

Use the full SUS 10 items after each prototype version block. In this study, each participant submits one SUS response set for Baseline and one for TraceGuide, so score each condition separately.

```text
SUS = ((Q1-1) + (5-Q2) + (Q3-1) + (5-Q4) + (Q5-1) + (5-Q6) + (Q7-1) + (5-Q8) + (Q9-1) + (5-Q10)) * 2.5
```

Do not call a four-item usability measure SUS. SUS is a 10-item scale.

## Raw NASA-TLX scoring

Use the six standard dimensions:

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

ASQ is collected after each task with three 7-point items.

```text
ASQ mean = average(ASQ1, ASQ2, ASQ3)
```

Higher score means higher task satisfaction.

## Study-specific TraceGuide items

Label these clearly as:

> Study-specific items — not a validated scale.

Use them to interpret why TraceGuide may help decision-making:

- I could identify what information the AI used to support its advice.
- I could check whether the source information was relevant.
- I could understand the key conditions behind the AI’s recommendation.
- I felt able to correct the AI’s understanding before continuing.

## Main analysis table

After collecting responses, create one row per participant and condition:

| Participant | Condition | Decision mean | Correct task count | Decision ease mean | Decision confidence mean | ASQ mean | SUS | Raw NASA-TLX | TraceGuide item mean |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|

Then compare Baseline vs TraceGuide within each participant.

The primary claim should be based on decision appropriateness, not simply on “trust” or preference.
