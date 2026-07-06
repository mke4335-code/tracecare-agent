const RESPONSE_WORKBOOK_ID = '1L9rBQ7VxiF51e-2wj_opUOKOy1ceoSsG8MXJlyHV0EU';

function cleanTraceGuideWorkbookForFormalTest() {
  const ss = SpreadsheetApp.openById(RESPONSE_WORKBOOK_ID);

  const keepNames = new Set([
    '00 START HERE — Formal Test',
    '01 Participant Log — Formal Test',
    '02 Data Cleaning Checklist',
    'Formal Pre-test Responses',
    'Formal Version Block Responses',
    'Formal Final Comparison Responses',
    'Task Scoring Key',
    'Participant Groups',
    'Scoring Notes'
  ]);

  // Delete old/pilot/development sheets. This intentionally removes old Form Responses tabs.
  ss.getSheets().forEach(sheet => {
    if (!keepNames.has(sheet.getName())) {
      ss.deleteSheet(sheet);
    }
  });

  upsertSheet_(ss, '00 START HERE — Formal Test', [
    ['TraceGuide Formal Test — Start Here', 'What to use', 'Link / rule', 'Notes'],
    ['1', 'Task Guide', 'https://tracecare-agent.vercel.app/traceguide-task-guide', 'Give this to participants. It contains the correct group flow.'],
    ['2', 'Pre-test Form', 'https://docs.google.com/forms/d/1ywnr2W_lYGj-lsvWgTWl69-q4W2gba8FG42zihEpQzo/viewform', 'Each participant completes once before prototypes.'],
    ['3', 'Version Block Survey', 'https://docs.google.com/forms/d/19mo1rG4edbMEYU0YcnZxbRkwLhK14dhnYwQM5TswRM8/viewform', 'Each participant completes twice: once after Baseline block and once after TraceGuide block.'],
    ['4', 'Final Comparison', 'https://docs.google.com/forms/d/1V7n6-G4SQXs566JLGtQQNL7iXK8G3__x_YU57BMKJ_o/viewform', 'Each participant completes once at the end.'],
    ['Group 1', 'Baseline Set 1 → TraceGuide Set 2', 'P01, P03, P05, ...', 'Odd participant codes by default.'],
    ['Group 2', 'TraceGuide Set 1 → Baseline Set 2', 'P02, P04, P06, ...', 'Even participant codes by default.'],
    ['Main metric', 'Decision appropriateness', '0–2 per task', 'Compare Baseline vs TraceGuide within each participant.'],
    ['Formal data rule', 'Only use new formal responses', 'Participant code must be P01–P20', 'Old/pilot response tabs are deleted by this script.'],
    ['Required submissions per participant', '1 Pre-test + 2 Version Block Surveys + 1 Final Comparison', '4 form submissions total', 'Not 6 separate task forms.']
  ]);

  const participantRows = [['Participant code', 'Group', 'First block', 'First block survey done?', 'Second block', 'Second block survey done?', 'Pre-test done?', 'Final comparison done?', 'Notes']];
  for (let i = 1; i <= 20; i++) {
    const code = 'P' + String(i).padStart(2, '0');
    const isOdd = i % 2 === 1;
    participantRows.push([
      code,
      isOdd ? 'Group 1' : 'Group 2',
      isOdd ? 'Baseline Set 1' : 'TraceGuide Set 1',
      '',
      isOdd ? 'TraceGuide Set 2' : 'Baseline Set 2',
      '',
      '',
      '',
      ''
    ]);
  }
  upsertSheet_(ss, '01 Participant Log — Formal Test', participantRows);

  upsertSheet_(ss, '02 Data Cleaning Checklist', [
    ['Data Cleaning Checklist', 'Rule', 'Why it matters', 'Done?', 'Notes'],
    ['1. Use only formal test rows', 'Start from the new response sheets after running this script.', 'Removes pilot/test/old-version records.', '', ''],
    ['2. Keep valid participant codes', 'Use P01–P20 or assigned codes only.', 'Links all forms together.', '', ''],
    ['3. One Pre-test row per participant', 'No duplicates unless corrected manually.', 'Background data should not duplicate.', '', ''],
    ['4. Two Version Block Survey rows per participant', 'One Baseline row and one TraceGuide row.', 'Required for within-subject comparison.', '', ''],
    ['5. Correct task IDs per set', 'Set 1 = S1-T1/S1-T2; Set 2 = S2-T1/S2-T2.', 'Prevents scoring mismatch.', '', ''],
    ['6. Condition matches group flow', 'Group 1: Baseline Set 1 then TraceGuide Set 2. Group 2: TraceGuide Set 1 then Baseline Set 2.', 'Keeps counterbalancing correct.', '', ''],
    ['7. Score decision appropriateness', 'Use Task Scoring Key: 0, 1, or 2 per task.', 'Primary research metric.', '', ''],
    ['8. Average per condition', 'Average two task scores for Baseline and two for TraceGuide per participant.', 'Creates paired comparison.', '', ''],
    ['9. Compare Baseline vs TraceGuide', 'Use paired comparison on participant-level means.', 'Matches within-subject A/B design.', '', ''],
    ['10. Main claim', 'Whether TraceGuide supports more appropriate next-step decisions than Baseline.', 'Do not overclaim broad causal proof.', '', '']
  ]);

  upsertSheet_(ss, 'Task Scoring Key', [
    ['Task ID', 'Score 2 next step', 'Score 1 next step', 'Score 0 next step'],
    ['S1-T1 Product information — Milk Cookies peanut allergy', 'Follow the AI advice and not eat the product / Ask human support if unsure', 'Check more information first / I am not sure', 'Still eat the product'],
    ['S1-T2 Return/refund — Glass Lunch Box arrived damaged', 'Authorise the agent to prepare the request', 'Check more information first / Ask human support / I am not sure', 'Do not continue despite eligible damaged item'],
    ['S2-T1 Product information — Protein Bar peanut allergy', 'Follow the AI advice and not eat the product / Ask human support if unsure', 'Check more information first / I am not sure', 'Still eat the product'],
    ['S2-T2 Return/refund — Snack Package damaged, photo not added', 'Add photo/evidence first / Ask human support', 'Check more information first / I am not sure', 'Authorise the agent to prepare the request without evidence']
  ]);

  upsertSheet_(ss, 'Participant Groups', [
    ['Group', 'Order', 'First condition tasks', 'Second condition tasks', 'Participant codes'],
    ['Group 1', 'Baseline Set 1 → TraceGuide Set 2', 'Baseline: S1-T1, S1-T2', 'TraceGuide: S2-T1, S2-T2', 'P01, P03, P05, P07, P09, P11, P13, P15, P17, P19'],
    ['Group 2', 'TraceGuide Set 1 → Baseline Set 2', 'TraceGuide: S1-T1, S1-T2', 'Baseline: S2-T1, S2-T2', 'P02, P04, P06, P08, P10, P12, P14, P16, P18, P20']
  ]);

  upsertSheet_(ss, 'Scoring Notes', [
    ['How to score and report results', ''],
    ['Primary outcome', 'Decision appropriateness, 0–2 per task, scored against the ground truth key.'],
    ['0', 'Participant follows incorrect advice or authorises an inappropriate action.'],
    ['1', 'Participant notices uncertainty and pauses/asks human/checks more, but does not fully identify the best next step.'],
    ['2', 'Participant makes a decision aligned with policy, order context, item condition and action status.'],
    ['SUS scoring', 'Odd SUS items: response - 1. Even SUS items: 5 - response. Sum × 2.5 = 0–100.'],
    ['Raw NASA-TLX', 'Average the six dimensions.'],
    ['ASQ', 'Average the three ASQ items per task; higher is better.'],
    ['Survey structure', 'Each participant completes one Version Block Survey after each prototype version, so two block surveys total.'],
    ['Comparison', 'Because each participant uses both A and B, compare paired participant-level means.']
  ]);

  reorderSheets_(ss, [
    '00 START HERE — Formal Test',
    '01 Participant Log — Formal Test',
    '02 Data Cleaning Checklist',
    'Task Scoring Key',
    'Participant Groups',
    'Scoring Notes'
  ]);

  ss.getSheets().forEach(sheet => {
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, Math.min(sheet.getMaxColumns(), 9));
    const header = sheet.getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), sheet.getLastColumn() || 1));
    header.setFontWeight('bold').setBackground('#3128F4').setFontColor('#FFFFFF');
  });

  Logger.log('DONE — Workbook cleaned for formal TraceGuide testing.');
  Logger.log(ss.getUrl());
}

function upsertSheet_(ss, name, values) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clear();
  if (values && values.length > 0) {
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }
  return sheet;
}

function reorderSheets_(ss, orderedNames) {
  orderedNames.forEach((name, index) => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(index + 1);
    }
  });
}
