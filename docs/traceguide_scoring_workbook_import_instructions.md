# TraceGuide Scoring Workbook Import Instructions

The scoring workbook template has been generated locally:

```text
/Users/make/tracecare-agent/docs/TraceGuide_UX_Study_Scoring_Workbook.xlsx
```

It contains:

- Instructions
- Task Scoring Key
- Raw Task Responses
- Post-test Raw
- Participant Summary
- Condition Comparison

## Why it is not already an online Google Sheet

The current Google Drive connector returned:

```text
ACCESS_TOKEN_SCOPE_INSUFFICIENT
```

This means the connection can no longer create or upload Drive files with the current OAuth scope. The workbook itself is ready; only the Google Drive upload permission is blocked.

## Manual import, fastest route

1. Open Google Drive.
2. Upload `TraceGuide_UX_Study_Scoring_Workbook.xlsx`.
3. Right click the uploaded file.
4. Choose Open with → Google Sheets.
5. In Google Sheets, choose File → Save as Google Sheets if needed.

## How to use it with Google Forms

1. Open each Google Form.
2. Go to Responses.
3. Click the Google Sheets icon to create a response spreadsheet.
4. Copy the response rows into the matching raw tab:
   - Task Response form → `Raw Task Responses`
   - Post-test form → `Post-test Raw`
5. Keep participant code and condition spelling consistent:
   - `Baseline`
   - `TraceGuide`
6. The summary tabs will calculate:
   - Decision appropriateness
   - Correct task count
   - ASQ mean
   - SUS score
   - Raw NASA-TLX
   - Evidence understanding mean
   - Perceived control mean

## Required spelling for decision options

Use these exact options in the Task Response form so the scoring formulas work:

- Follow the AI advice and authorise the action
- Follow the advice but do not authorise an action yet
- Pause and check more information first
- Add missing evidence or correct details first
- Ask human support
- Do not follow the AI advice

If the wording in Google Forms differs, either update the form options or update the `Task Scoring Key` tab to match the collected wording.

