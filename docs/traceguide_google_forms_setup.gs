const PRE_TEST_FORM_ID = '1ywnr2W_lYGj-lsvWgTWl69-q4W2gba8FG42zihEpQzo';
const TASK_RESPONSE_FORM_ID = '19mo1rG4edbMEYU0YcnZxbRkwLhK14dhnYwQM5TswRM8';
const POST_TEST_FORM_ID = '1V7n6-G4SQXs566JLGtQQNL7iXK8G3__x_YU57BMKJ_o';
const RESPONSE_WORKBOOK_ID = '1L9rBQ7VxiF51e-2wj_opUOKOy1ceoSsG8MXJlyHV0EU';

const TASK_OPTIONS = [
  'S1-T1 Product information — Milk Cookies peanut allergy',
  'S1-T2 Return/refund — Glass Lunch Box arrived damaged',
  'S2-T1 Product information — Protein Bar peanut allergy',
  'S2-T2 Return/refund — Snack Package damaged, photo not added'
];

const NEXT_STEP_OPTIONS = [
  'I would follow the AI advice and not eat the product.',
  'I would still eat the product.',
  'I would authorise the agent to prepare the request.',
  'I would add photo/evidence first.',
  'I would check more information first.',
  'I would ask human support.',
  'I would not continue with the request.',
  'I am not sure.'
];

const SUS_ITEMS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.'
];

const NASA_ITEMS = [
  'Mental Demand: How mentally demanding was this version?',
  'Physical Demand: How physically demanding was this version?',
  'Temporal Demand: How hurried or rushed did this version feel?',
  'Performance: How successful did you feel using this version?',
  'Effort: How hard did you have to work to use this version?',
  'Frustration: How insecure, discouraged, irritated, stressed, or annoyed did you feel?'
];

const TRACEGUIDE_ITEMS = [
  'I could identify the evidence that supported the agent’s advice.',
  'I could judge whether the evidence was relevant to my situation.',
  'I understood which task conditions shaped the agent’s recommendation.',
  'The information shown helped me decide whether to follow the advice.',
  'I could correct information that the agent had misunderstood.',
  'I knew what action the agent was preparing to take.',
  'I knew when my confirmation was required.',
  'I felt able to stop the process or ask for human support.'
];

function setupTraceGuideForms() {
  setupPreTestForm();
  setupVersionBlockSurveyForm();
  setupPostTestForm();
  setupScoringWorkbook();

  Logger.log('DONE — TraceGuide forms updated.');
  Logger.log('Pre-test: ' + FormApp.openById(PRE_TEST_FORM_ID).getPublishedUrl());
  Logger.log('Version Block Survey: ' + FormApp.openById(TASK_RESPONSE_FORM_ID).getPublishedUrl());
  Logger.log('Final Comparison: ' + FormApp.openById(POST_TEST_FORM_ID).getPublishedUrl());
  Logger.log('Response workbook: https://docs.google.com/spreadsheets/d/' + RESPONSE_WORKBOOK_ID + '/edit');
}

function setupPreTestForm() {
  const form = FormApp.openById(PRE_TEST_FORM_ID);
  resetForm(form);
  form.setTitle('TraceGuide Agent UX Study — Pre-test');
  form.setDescription(
    'Please complete this before starting the prototype tasks. This study is about how e-commerce service agents support user decision-making. The prototype uses simulated orders and service requests; no real refund, payment, or order action will be submitted.'
  );

  addText(form, 'Participant code', 'Use the code given by the researcher, for example P01. Do not enter your real name.', true);
  addMultipleChoice(form, 'I confirm that I am 18 or over and agree to take part in this study.', ['Yes', 'No'], true);
  addMultipleChoice(form, 'I understand that the prototype uses simulated e-commerce orders and does not submit real refunds, payments or order changes.', ['Yes', 'No'], true);
  addMultipleChoice(form, 'How often do you shop online?', ['Rarely', 'A few times a year', 'Monthly', 'Weekly or more'], true);
  addMultipleChoice(form, 'How often have you used AI customer service or chatbot support?', ['Never', 'Once or twice', 'Sometimes', 'Often'], true);
  addMultipleChoice(form, 'Have you requested a return, exchange, refund, or order change online before?', ['Yes', 'No', 'Not sure'], true);
  addScale(form, 'How confident are you when judging whether an online service answer is correct?', 1, 5, 'Not confident', 'Very confident', true);
  addScale(form, 'How comfortable are you reading short English e-commerce service messages?', 1, 5, 'Not comfortable', 'Very comfortable', true);
  addParagraph(form, 'Anything else we should know before the test?', 'Optional.', false);

  finaliseForm(form);
}

function setupVersionBlockSurveyForm() {
  const form = FormApp.openById(TASK_RESPONSE_FORM_ID);
  resetForm(form);
  form.setTitle('TraceGuide Agent UX Study — Version Block Survey');
  form.setDescription(
    'Complete this form after finishing the two tasks in one prototype version. You will complete it twice in total: once for Baseline and once for TraceGuide.'
  );

  addText(form, 'Participant code', 'Use the same code throughout the study.', true);
  addMultipleChoice(form, 'Sequence group', [
    'Group 1 — Baseline Set 1 → TraceGuide Set 2',
    'Group 2 — TraceGuide Set 1 → Baseline Set 2',
    'Not sure'
  ], true);
  addMultipleChoice(form, 'Condition', ['A — Baseline AI customer service', 'B — TraceGuide Agent'], true);
  addMultipleChoice(form, 'Scenario set', ['Set 1', 'Set 2'], true);

  form.addPageBreakItem().setTitle('Task 1 decision');
  addMultipleChoice(form, 'Task 1 ID', TASK_OPTIONS, true);
  addMultipleChoice(form, 'Task 1 — Based on what you saw, what would you do next?', NEXT_STEP_OPTIONS, true);
  addScale(form, 'Task 1 — How easy was it to decide what to do next?', 1, 7, 'Very difficult', 'Very easy', true);
  addScale(form, 'Task 1 — How confident are you in your decision?', 1, 7, 'Not confident', 'Very confident', true);
  addParagraph(form, 'Task 1 — Why did you choose that next step?', 'Briefly explain what information influenced your decision.', false);
  addScale(form, 'Task 1 ASQ 1 — Overall, I am satisfied with the ease of completing this task.', 1, 7, 'Strongly disagree', 'Strongly agree', true);
  addScale(form, 'Task 1 ASQ 2 — Overall, I am satisfied with the amount of time it took to complete this task.', 1, 7, 'Strongly disagree', 'Strongly agree', true);
  addScale(form, 'Task 1 ASQ 3 — Overall, I am satisfied with the support information provided while completing this task.', 1, 7, 'Strongly disagree', 'Strongly agree', true);

  form.addPageBreakItem().setTitle('Task 2 decision');
  addMultipleChoice(form, 'Task 2 ID', TASK_OPTIONS, true);
  addMultipleChoice(form, 'Task 2 — Based on what you saw, what would you do next?', NEXT_STEP_OPTIONS, true);
  addScale(form, 'Task 2 — How easy was it to decide what to do next?', 1, 7, 'Very difficult', 'Very easy', true);
  addScale(form, 'Task 2 — How confident are you in your decision?', 1, 7, 'Not confident', 'Very confident', true);
  addParagraph(form, 'Task 2 — Why did you choose that next step?', 'Briefly explain what information influenced your decision.', false);
  addScale(form, 'Task 2 ASQ 1 — Overall, I am satisfied with the ease of completing this task.', 1, 7, 'Strongly disagree', 'Strongly agree', true);
  addScale(form, 'Task 2 ASQ 2 — Overall, I am satisfied with the amount of time it took to complete this task.', 1, 7, 'Strongly disagree', 'Strongly agree', true);
  addScale(form, 'Task 2 ASQ 3 — Overall, I am satisfied with the support information provided while completing this task.', 1, 7, 'Strongly disagree', 'Strongly agree', true);

  form.addPageBreakItem().setTitle('Version-level usability and workload');
  SUS_ITEMS.forEach((item, index) => addScale(form, 'SUS' + (index + 1) + ' — ' + item, 1, 5, 'Strongly disagree', 'Strongly agree', true));
  NASA_ITEMS.forEach((item) => addScale(form, 'Raw NASA-TLX — ' + item, 0, 10, 'Low', 'High', true));

  form.addPageBreakItem().setTitle('Version-level decision support');
  addScale(form, 'The system helped me understand what decision I needed to make.', 1, 5, 'Strongly disagree', 'Strongly agree', true);
  addScale(form, 'The system gave enough information for me to choose the next step.', 1, 5, 'Strongly disagree', 'Strongly agree', true);
  addScale(form, 'I felt able to decide whether to follow the AI advice.', 1, 5, 'Strongly disagree', 'Strongly agree', true);
  addScale(form, 'I felt able to decide whether to allow the AI to continue the service process.', 1, 5, 'Strongly disagree', 'Strongly agree', true);
  addParagraph(form, 'What was unclear or missing in this version?', 'Optional.', false);

  form.addPageBreakItem().setTitle('TraceGuide-only items — skip if this block was Baseline');
  TRACEGUIDE_ITEMS.forEach((item, index) => addScale(form, 'TraceGuide item ' + (index + 1) + ' — ' + item, 1, 5, 'Strongly disagree', 'Strongly agree', false));

  finaliseForm(form);
}

function setupPostTestForm() {
  const form = FormApp.openById(POST_TEST_FORM_ID);
  resetForm(form);
  form.setTitle('TraceGuide Agent UX Study — Final Comparison');
  form.setDescription('Complete this once after finishing both prototype versions.');

  addText(form, 'Participant code', 'Use the same code throughout the study.', true);
  addMultipleChoice(form, 'Sequence group', [
    'Group 1 — Baseline Set 1 → TraceGuide Set 2',
    'Group 2 — TraceGuide Set 1 → Baseline Set 2',
    'Not sure'
  ], true);

  addMultipleChoice(form, 'Overall, which version better supported your decision-making?', ['A — Baseline AI customer service', 'B — TraceGuide Agent', 'No clear difference'], true);
  addMultipleChoice(form, 'Which version felt easier to use?', ['A — Baseline AI customer service', 'B — TraceGuide Agent', 'No clear difference'], true);
  addMultipleChoice(form, 'Which version made you feel more in control?', ['A — Baseline AI customer service', 'B — TraceGuide Agent', 'No clear difference'], true);
  addMultipleChoice(form, 'Which version would you prefer to use for e-commerce support tasks?', ['A — Baseline AI customer service', 'B — TraceGuide Agent', 'No clear preference'], true);
  addParagraph(form, 'Why did you prefer that version?', '', false);
  addParagraph(form, 'What was confusing or difficult?', '', false);
  addParagraph(form, 'What should be improved before using this in a real e-commerce service?', '', false);

  finaliseForm(form);
}

function setupScoringWorkbook() {
  const ss = SpreadsheetApp.openById(RESPONSE_WORKBOOK_ID);
  upsertSheet(ss, 'Study Links', [
    ['Item', 'Link'],
    ['Pre-test form — participant link', FormApp.openById(PRE_TEST_FORM_ID).getPublishedUrl()],
    ['Version Block Survey — participant link', FormApp.openById(TASK_RESPONSE_FORM_ID).getPublishedUrl()],
    ['Final Comparison — participant link', FormApp.openById(POST_TEST_FORM_ID).getPublishedUrl()],
    ['Pre-test form — edit link', 'https://docs.google.com/forms/d/' + PRE_TEST_FORM_ID + '/edit'],
    ['Version Block Survey — edit link', 'https://docs.google.com/forms/d/' + TASK_RESPONSE_FORM_ID + '/edit'],
    ['Final Comparison — edit link', 'https://docs.google.com/forms/d/' + POST_TEST_FORM_ID + '/edit'],
    ['Prototype A — Baseline', 'https://tracecare-agent.vercel.app/traceguide-baseline'],
    ['Prototype B — TraceGuide', 'https://tracecare-agent.vercel.app/traceguide-demo']
  ]);

  upsertSheet(ss, 'Task Scoring Key', [
    ['Task ID', 'Score 2 next step', 'Score 1 next step', 'Score 0 next step'],
    ['S1-T1 Product information — Milk Cookies peanut allergy', 'Follow the AI advice and not eat the product / Ask human support if unsure', 'Check more information first / I am not sure', 'Still eat the product'],
    ['S1-T2 Return/refund — Glass Lunch Box arrived damaged', 'Authorise the agent to prepare the request', 'Check more information first / Ask human support / I am not sure', 'Do not continue despite eligible damaged item'],
    ['S2-T1 Product information — Protein Bar peanut allergy', 'Follow the AI advice and not eat the product / Ask human support if unsure', 'Check more information first / I am not sure', 'Still eat the product'],
    ['S2-T2 Return/refund — Snack Package damaged, photo not added', 'Add photo/evidence first / Ask human support', 'Check more information first / I am not sure', 'Authorise the agent to prepare the request without evidence']
  ]);

  upsertSheet(ss, 'Participant Groups', [
    ['Group', 'Order', 'First condition tasks', 'Second condition tasks', 'Participant codes'],
    ['Group 1', 'Baseline Set 1 → TraceGuide Set 2', 'Baseline: S1-T1, S1-T2', 'TraceGuide: S2-T1, S2-T2', 'P01, P03, P05, P07, P09, P11, P13, P15, P17, P19'],
    ['Group 2', 'TraceGuide Set 1 → Baseline Set 2', 'TraceGuide: S1-T1, S1-T2', 'Baseline: S2-T1, S2-T2', 'P02, P04, P06, P08, P10, P12, P14, P16, P18, P20']
  ]);

  upsertSheet(ss, 'Scoring Notes', [
    ['How to score and report results', ''],
    ['Primary outcome', 'Decision appropriateness, 0–2 per task, scored against the ground truth key.'],
    ['0', 'Participant follows incorrect advice or authorises an inappropriate action.'],
    ['1', 'Participant notices uncertainty and pauses/asks human, but does not fully identify the correct reason/action.'],
    ['2', 'Participant makes a decision aligned with policy, order context, item condition and action status.'],
    ['SUS scoring', 'Odd SUS items: response - 1. Even SUS items: 5 - response. Sum × 2.5 = 0–100.'],
    ['Raw NASA-TLX', 'Average the six dimensions. This form records 0–10; multiply by 10 if you need 0–100.'],
    ['ASQ', 'Average the three ASQ items for each task; higher is better.'],
    ['Survey structure', 'Each participant completes one Version Block Survey after each prototype version, so two block surveys total.'],
    ['Comparison', 'Because each participant uses both A and B, compare paired participant-level means.']
  ]);
}

function resetForm(form) {
  const items = form.getItems();
  for (let i = items.length - 1; i >= 0; i--) {
    form.deleteItem(items[i]);
  }
  try {
    form.setCollectEmail(false);
  } catch (e) {}
  form.setAcceptingResponses(true);
  form.setConfirmationMessage('Thank you. Your response has been recorded.');
}

function finaliseForm(form) {
  form.setDestination(FormApp.DestinationType.SPREADSHEET, RESPONSE_WORKBOOK_ID);
  form.setAcceptingResponses(true);
}

function addText(form, title, helpText, required) {
  const item = form.addTextItem().setTitle(title).setRequired(required);
  if (helpText) item.setHelpText(helpText);
  return item;
}

function addParagraph(form, title, helpText, required) {
  const item = form.addParagraphTextItem().setTitle(title).setRequired(required);
  if (helpText) item.setHelpText(helpText);
  return item;
}

function addMultipleChoice(form, title, choices, required) {
  return form.addMultipleChoiceItem().setTitle(title).setChoiceValues(choices).setRequired(required);
}

function addScale(form, title, lower, upper, lowerLabel, upperLabel, required) {
  return form.addScaleItem()
    .setTitle(title)
    .setBounds(lower, upper)
    .setLabels(lowerLabel, upperLabel)
    .setRequired(required);
}

function upsertSheet(ss, name, values) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  sheet.getRange(1, 1, 1, values[0].length).setFontWeight('bold');
  sheet.autoResizeColumns(1, values[0].length);
}
