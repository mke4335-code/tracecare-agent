# TraceGuide Formal Questionnaire and Scoring Guide — Three Tasks per Version

## Data-collection structure

Use one Microsoft Forms response per participant. The form records the assigned group first; `First prototype` and `Second prototype` are mapped during analysis using that group:

| Group | First prototype | Second prototype |
|---|---|---|
| Group A | Baseline / Set 1 | TraceGuide / Set 2 |
| Group B | TraceGuide / Set 1 | Baseline / Set 2 |

The participant never needs to choose the prototype name again. This prevents condition labels from becoming mixed.

## Fields for each prototype block

Each block contains three task rows: T1, T2 and T3. For every row collect:

1. **What would you do next?**
2. **How easy was it to decide?** — 1 Very difficult to 5 Very easy.
3. **How confident are you in that decision?** — 1 Not confident to 5 Very confident.

Use the same response options for all damaged-item tasks:

- Allow the agent to prepare the service request.
- Add a clear damage photo first.
- Ask human support to review the case.
- Stop and do not continue with a standard request.
- I am not sure.

After the three task rows, collect one SUS block and the version-level UX ratings. SUS retains its standard alternating item direction; all study-specific UX ratings use 1 Strongly disagree to 5 Strongly agree, with higher scores meaning a better experience.

## Decision scoring key

| Task position | Scenario state | Score 2 | Score 1 | Score 0 |
|---|---|---|---|---|
| T1 | Inside 30 days, photo present | Allow agent to prepare request | Ask human / I am not sure | Add photo unnecessarily, or stop despite all conditions being met |
| T2 | Inside 30 days, no photo | Add photo first | Ask human / I am not sure | Allow agent to prepare request |
| T3 | Delivered 45 days ago, photo present | Stop standard request or ask human | I am not sure | Allow agent to prepare request, or add a photo that is already present |

Apply the same position-based scoring to both sets:

- S1-T1 and S2-T1 use the T1 key.
- S1-T2 and S2-T2 use the T2 key.
- S1-T3 and S2-T3 use the T3 key.

## Condition reconstruction

Do not analyse `First prototype` as if it were always Baseline.

```text
if group == "A":
  baseline = first prototype
  traceguide = second prototype

if group == "B":
  traceguide = first prototype
  baseline = second prototype
```

Create explicit derived columns for `baseline_*` and `traceguide_*` before calculating means.

## SUS scoring

Use all ten standard items for each prototype block:

```text
SUS = ((Q1-1) + (5-Q2) + (Q3-1) + (5-Q4) + (Q5-1)
     + (5-Q6) + (Q7-1) + (5-Q8) + (Q9-1) + (5-Q10)) * 2.5
```

Map the First/Second SUS scores to Baseline/TraceGuide using the assigned group before comparison.

## Recommended analysis table

Create one row per participant:

| participant_code | group | baseline_decision_mean | traceguide_decision_mean | baseline_ease_mean | traceguide_ease_mean | baseline_confidence_mean | traceguide_confidence_mean | baseline_SUS | traceguide_SUS | final_preference |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|

Keep raw First/Second responses unchanged in a separate sheet. Derived analysis columns should never overwrite raw data.

## Primary interpretation

The research claim must be based on the paired difference in decision appropriateness. SUS, ease, confidence, preference and verifiability explain usability and experience; they do not replace the primary behavioural decision measure.
