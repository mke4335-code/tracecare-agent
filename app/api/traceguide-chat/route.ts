import OpenAI from "openai";
import { supabase } from "../../../lib/supabase";

type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  content: string;
  status: string;
};

type RankedDoc = KnowledgeDoc & {
  score: number;
};

type TraceVariables = {
  issueIdentified: string;
  request: string;
  reason: string;
  evidence: string;
};

type ProductContext = {
  name: string;
  image: "glass-box" | "cookies" | "container-set" | "yoghurt" | "sandwich" | "snack";
  detail: string;
  status: string;
  linkLabel: string;
};

type ScenarioKey =
  | "glass_damaged_refund"
  | "glass_container_broken"
  | "chilled_yoghurt_change_mind"
  | "fresh_sandwich_change_mind"
  | "damaged_food_return"
  | "snack_package_evidence_unclear"
  | "late_delivery_compensation"
  | "allergen_safety"
  | "missing_accessory"
  | "unknown";

type Scenario = {
  key: ScenarioKey;
  product: ProductContext;
  variables: TraceVariables;
  nextAction: string;
  sourceTags: string[];
  loadingTitle: string;
  loadingSteps: string[];
  answerTemplate: (sources: BuyerSource[]) => string;
  sourceMatchers: Array<(doc: KnowledgeDoc) => boolean>;
};

type BuyerSource = {
  id: string;
  number: number;
  title: string;
  category: string;
  excerpt: string;
  relevance: "High relevance" | "Medium relevance" | "Relevant";
  matchedAnswer?: string;
};

const demoKnowledge: KnowledgeDoc[] = [
  {
    id: "demo-damaged-refund-policy",
    title: "Damaged item refund policy",
    category: "Refund",
    status: "active",
    content:
      "If an item arrives damaged, the customer can request a refund within 7 days. The customer should provide photos of the damaged item and packaging. For low-value items under £50, support may approve a refund without requiring a return.",
  },
  {
    id: "demo-opened-food-return-rule",
    title: "Opened food product return rule",
    category: "Return",
    status: "active",
    content:
      "Opened food products usually cannot be returned for hygiene reasons. If the product is damaged, unsafe, expired, or has a quality issue, support should offer a refund or replacement based on evidence.",
  },
  {
    id: "demo-chilled-food-exception",
    title: "Chilled food return exception",
    category: "Return",
    status: "active",
    content:
      "Chilled or perishable food cannot usually be returned for change-of-mind reasons, even if unopened. If there is a quality issue, temperature problem, damaged packaging, or safety concern, support should review evidence and may offer a refund or replacement.",
  },
  {
    id: "demo-fresh-food-exception",
    title: "Fresh food return exception",
    category: "Return",
    status: "active",
    content:
      "Fresh or perishable food, including sandwiches and chilled meals, cannot usually be returned because the customer changed their mind. If the product is unsafe, spoiled, damaged, expired, or incorrectly delivered, support should review evidence and may offer a refund or replacement.",
  },
  {
    id: "demo-yoghurt-order-status",
    title: "Order status — Chilled Yoghurt",
    category: "Order status",
    status: "active",
    content:
      "The Chilled Yoghurt order was delivered today. The item is unopened and the delivery record shows it arrived within the expected cold-chain window.",
  },
  {
    id: "demo-change-mind-return-policy",
    title: "Change-of-mind return policy",
    category: "Return",
    status: "active",
    content:
      "Standard non-perishable items can usually be returned within 30 days if unused and in original packaging. Product-specific exceptions, such as chilled food and hygiene-sensitive goods, override the general return window.",
  },
  {
    id: "demo-late-delivery-compensation",
    title: "Late delivery compensation",
    category: "Logistics",
    status: "active",
    content:
      "If delivery is delayed for more than 48 hours beyond the promised delivery date, the customer can receive a shipping fee refund or a small store voucher. Compensation depends on the order timeline and store policy.",
  },
  {
    id: "demo-allergen-safety-rule",
    title: "Allergen information safety rule",
    category: "Product Safety",
    status: "active",
    content:
      "When customers ask about allergens, support must answer only based on verified product ingredient data. If allergen data is missing or uncertain, advise the customer not to eat the product and contact human support.",
  },
  {
    id: "demo-missing-accessory-refund",
    title: "Missing accessory refund rule",
    category: "Refund",
    status: "active",
    content:
      "If a product arrives with a missing accessory, the customer should provide photos of the package and item. Support can offer a replacement accessory, partial refund, or full refund depending on the case.",
  },
  {
    id: "demo-glass-order-status",
    title: "Order status — Glass Lunch Box",
    category: "Order status",
    status: "active",
    content:
      "The Glass Lunch Box order was delivered 2 days ago. The return window is still open and the item is eligible for review if it arrived damaged.",
  },
  {
    id: "demo-cookies-order-status",
    title: "Order status — Milk Cookies",
    category: "Order status",
    status: "active",
    content:
      "The Milk Cookies order was delivered 2 days ago. Food items require photo evidence and condition review before return, refund, or replacement.",
  },
  {
    id: "demo-container-order-status",
    title: "Order status — Glass Food Containers Set",
    category: "Order status",
    status: "active",
    content:
      "The Glass Food Containers Set order was marked delivered today. The product page lists four containers and matching lids as included accessories.",
  },
  {
    id: "demo-glass-container-order-status",
    title: "Order status — Glass Food Container",
    category: "Order status",
    status: "active",
    content:
      "The Glass Food Container order was delivered yesterday. The customer reported that the lid was broken on arrival. The item is inside the return window.",
  },
  {
    id: "demo-broken-container-policy",
    title: "Replacement and refund options for broken container",
    category: "Refund",
    status: "active",
    content:
      "If a reusable container or lid arrives broken, support can prepare a replacement request or refund request after the customer confirms the issue. Photos help the seller review the case faster.",
  },
  {
    id: "demo-fresh-sandwich-order-status",
    title: "Order status — Fresh Sandwich",
    category: "Order status",
    status: "active",
    content:
      "The Fresh Sandwich order was delivered today. The item is unopened. No quality issue, temperature issue or incorrect delivery has been reported.",
  },
  {
    id: "demo-snack-package-evidence-status",
    title: "Snack package evidence status",
    category: "Evidence",
    status: "active",
    content:
      "The Snack Pack order was delivered yesterday. The customer reported damaged packaging, but no photo evidence has been added yet. The support request should not be submitted for seller review until evidence is added or the case is sent to human support.",
  },
  {
    id: "demo-snack-order-status",
    title: "Order status — Snack Pack",
    category: "Order status",
    status: "active",
    content:
      "The Snack Pack order was delivered yesterday. The delivery record is available, but the evidence field is currently incomplete.",
  },
  {
    id: "demo-photo-evidence-rule",
    title: "Photo evidence rule for damaged package",
    category: "Store policy",
    status: "active",
    content:
      "When a package is damaged but the extent of product damage is unclear, support should ask for a photo or send the case to human support before starting a refund or replacement request.",
  },
  {
    id: "demo-delayed-order-status",
    title: "Order timeline — Glass Food Containers Set",
    category: "Order status",
    status: "active",
    content:
      "The order arrived 2 days after the promised delivery date. The shipping timeline can be checked for possible late delivery compensation.",
  },
  {
    id: "demo-cookie-ingredients",
    title: "Milk Cookies ingredients list",
    category: "Product details",
    status: "active",
    content:
      "The ingredients list for Milk Cookies includes wheat flour, vegetable oil, white sugar, peanut sauce, egg, milk, salt and flavouring. The allergen notice mentions peanuts, sesame, egg and milk.",
  },
  {
    id: "demo-store-return-note",
    title: "Store return note",
    category: "Store policy",
    status: "active",
    content:
      "The store may ask for a photo when an item arrives damaged, missing accessories, or has a quality issue, so the request can be reviewed faster.",
  },
];

function getOpenAIClient() {
  if (!process.env.GROQ_API_KEY) return null;

  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function normaliseWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function sourceNumber(sources: BuyerSource[], matcher: (source: BuyerSource) => boolean, fallback: number) {
  return sources.find(matcher)?.number || fallback;
}

const scenarios: Record<Exclude<ScenarioKey, "unknown">, Scenario> = {
  glass_damaged_refund: {
    key: "glass_damaged_refund",
    product: {
      name: "Glass Lunch Box",
      image: "glass-box",
      detail: "1 item",
      status: "Delivered 2 days ago",
      linkLabel: "Order details",
    },
    variables: {
      issueIdentified: "Damaged item",
      request: "Return & Refund",
      reason: "Item arrived damaged",
      evidence: "Photos needed",
    },
    nextAction: "start a refund request",
    sourceTags: ["Return policy", "Order status", "Store policy"],
    loadingTitle: "Checking refund eligibility...",
    loadingSteps: ["Understanding your request", "Checking order status", "Reading return policy", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["damaged item refund", "arrives damaged", "damaged during delivery"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Glass Lunch Box"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["photo", "packaging", "store return note"]),
    ],
    answerTemplate: (sources) => {
      const policy = sourceNumber(sources, (source) => source.category.toLowerCase().includes("refund"), 1);
      const order = sourceNumber(sources, (source) => source.category.toLowerCase().includes("order"), 2);
      return `Yes, this item is likely eligible for a return and refund.\n\nYour order is still within the return window according to the return policy [${policy}]. The order status shows it was delivered recently [${order}]. Please keep the item and packaging if possible.`;
    },
  },
  glass_container_broken: {
    key: "glass_container_broken",
    product: {
      name: "Glass Food Container",
      image: "container-set",
      detail: "1 item",
      status: "Delivered yesterday",
      linkLabel: "Order details",
    },
    variables: {
      issueIdentified: "Broken lid",
      request: "Replacement or refund",
      reason: "Lid was broken on arrival",
      evidence: "Photos helpful",
    },
    nextAction: "prepare a replacement or refund request",
    sourceTags: ["Refund policy", "Order status", "Store policy"],
    loadingTitle: "Checking replacement options...",
    loadingSteps: ["Understanding your request", "Checking order status", "Reading support options", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["broken container", "lid arrives broken", "replacement request", "reusable container"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Glass Food Container", "delivered yesterday", "lid was broken"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["photo", "seller review", "store return note"]),
    ],
    answerTemplate: (sources) => {
      const policy = sourceNumber(sources, (source) => /refund|replacement/i.test(source.category + source.title), 1);
      const order = sourceNumber(sources, (source) => /order/i.test(source.category), 2);
      return `Yes, this looks suitable for a replacement or refund request.\n\nThe order record says the container was delivered yesterday and the lid was reported broken on arrival [${order}]. The support policy allows a replacement or refund request for broken reusable items after you confirm the issue [${policy}].`;
    },
  },
  chilled_yoghurt_change_mind: {
    key: "chilled_yoghurt_change_mind",
    product: {
      name: "Chilled Yoghurt",
      image: "yoghurt",
      detail: "4 x 125g",
      status: "Delivered today",
      linkLabel: "Product details",
    },
    variables: {
      issueIdentified: "Change-of-mind chilled food return",
      request: "Return & Refund",
      reason: "Customer changed their mind",
      evidence: "No quality issue reported",
    },
    nextAction: "send this to human support for review",
    sourceTags: ["Food exception", "Order status", "Return policy"],
    loadingTitle: "Checking chilled food return rules...",
    loadingSteps: ["Understanding your request", "Checking product type", "Reading food return exception", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Chilled food return exception", "chilled", "perishable", "change-of-mind"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Chilled Yoghurt", "cold-chain", "delivered today"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Change-of-mind", "non-perishable", "exceptions"]),
    ],
    answerTemplate: (sources) => {
      const exception = sourceNumber(sources, (source) => /return/i.test(source.category + source.title), 1);
      const order = sourceNumber(sources, (source) => /order/i.test(source.category), 2);
      return `I would not recommend starting a standard return for this item.\n\nYour order was delivered today and appears unopened [${order}], but chilled food is usually excluded from change-of-mind returns unless there is a quality, temperature, packaging, or safety issue [${exception}]. If you think there is a quality problem, I can send the details to human support for review.`;
    },
  },
  fresh_sandwich_change_mind: {
    key: "fresh_sandwich_change_mind",
    product: {
      name: "Fresh Sandwich",
      image: "sandwich",
      detail: "1 pack",
      status: "Delivered today",
      linkLabel: "Product details",
    },
    variables: {
      issueIdentified: "Change-of-mind fresh food return",
      request: "Return & Refund",
      reason: "Customer changed their mind",
      evidence: "No quality issue reported",
    },
    nextAction: "send this to human support for review",
    sourceTags: ["Food exception", "Order status", "Return policy"],
    loadingTitle: "Checking fresh food return rules...",
    loadingSteps: ["Understanding your request", "Checking product type", "Reading food exception", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Fresh food return exception", "fresh", "sandwich", "perishable", "changed their mind"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Fresh Sandwich", "delivered today", "unopened"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Change-of-mind", "exceptions", "non-perishable"]),
    ],
    answerTemplate: (sources) => {
      const exception = sourceNumber(sources, (source) => /return/i.test(source.category + source.title), 1);
      const order = sourceNumber(sources, (source) => /order/i.test(source.category), 2);
      return `I would not recommend starting a standard return for this item.\n\nThe order record says the sandwich was delivered today and no quality issue has been reported [${order}]. Fresh or perishable food is usually excluded from change-of-mind returns unless there is a safety, quality, temperature, or delivery problem [${exception}].`;
    },
  },
  damaged_food_return: {
    key: "damaged_food_return",
    product: {
      name: "Milk Cookies",
      image: "cookies",
      detail: "100g / pack",
      status: "Delivered 2 days ago",
      linkLabel: "Product details",
    },
    variables: {
      issueIdentified: "Damaged food item",
      request: "Return & Refund",
      reason: "Food arrived damaged",
      evidence: "Photo not added",
    },
    nextAction: "prepare a return request",
    sourceTags: ["Food return rule", "Order status", "Store policy"],
    loadingTitle: "Checking food return options...",
    loadingSteps: ["Understanding your issue", "Checking product type", "Reading return policy", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Opened food product", "food products", "quality issue", "unsafe"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Milk Cookies"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["photo", "quality issue", "store return note"]),
    ],
    answerTemplate: (sources) => {
      const foodRule = sourceNumber(sources, (source) => /return/i.test(source.category + source.title), 1);
      const order = sourceNumber(sources, (source) => source.category.toLowerCase().includes("order"), 2);
      return `This can usually be reviewed, but evidence is needed before a refund request is ready.\n\nFood products are normally restricted for hygiene reasons, but damaged or unsafe items can be refunded or replaced when there is evidence [${foodRule}]. Your order was delivered recently [${order}], so the next step is to add photos of the item and packaging.`;
    },
  },
  snack_package_evidence_unclear: {
    key: "snack_package_evidence_unclear",
    product: {
      name: "Snack Pack",
      image: "snack",
      detail: "6-pack",
      status: "Delivered yesterday",
      linkLabel: "Order details",
    },
    variables: {
      issueIdentified: "Damaged package",
      request: "Return & Refund",
      reason: "Package damage reported",
      evidence: "Photo not added",
    },
    nextAction: "ask for photos before starting a refund request",
    sourceTags: ["Evidence needed", "Order status", "Store policy"],
    loadingTitle: "Checking evidence needed...",
    loadingSteps: ["Understanding your issue", "Checking order status", "Reading evidence rule", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Snack package evidence", "no photo evidence", "not be submitted"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Snack Pack", "delivered yesterday", "evidence field"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Photo evidence rule", "damaged package", "human support"]),
    ],
    answerTemplate: (sources) => {
      const evidence = sourceNumber(sources, (source) => /evidence|photo/i.test(source.category + source.title), 1);
      const order = sourceNumber(sources, (source) => /order/i.test(source.category), 2);
      return `I would not start a refund request yet.\n\nThe order record is available [${order}], but the evidence field is still incomplete. When package damage is unclear, the support rule says a photo or human review is needed before starting a refund or replacement request [${evidence}].`;
    },
  },
  late_delivery_compensation: {
    key: "late_delivery_compensation",
    product: {
      name: "Glass Food Containers Set",
      image: "container-set",
      detail: "4-piece set",
      status: "Arrived 2 days late",
      linkLabel: "Delivery details",
    },
    variables: {
      issueIdentified: "Late delivery",
      request: "Compensation",
      reason: "Delivered after promised date",
      evidence: "Order timeline available",
    },
    nextAction: "prepare a compensation request",
    sourceTags: ["Delivery policy", "Order timeline", "Store policy"],
    loadingTitle: "Checking delivery compensation...",
    loadingSteps: ["Understanding your request", "Checking delivery timeline", "Reading compensation policy", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Late delivery compensation", "48 hours", "voucher", "shipping fee"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["arrived 2 days after", "shipping timeline", "promised delivery"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["store policy", "compensation"]),
    ],
    answerTemplate: (sources) => {
      const policy = sourceNumber(sources, (source) => /logistics|delivery/i.test(source.category + source.title), 1);
      const timeline = sourceNumber(sources, (source) => /order/i.test(source.category), 2);
      return `You may be eligible for delivery compensation.\n\nThe delivery record shows the order arrived 2 days after the promised date [${timeline}]. The compensation policy says delays over 48 hours may qualify for a shipping fee refund or store voucher [${policy}].`;
    },
  },
  allergen_safety: {
    key: "allergen_safety",
    product: {
      name: "Milk Cookies",
      image: "cookies",
      detail: "100g / pack",
      status: "Product information available",
      linkLabel: "Product details",
    },
    variables: {
      issueIdentified: "Allergen concern",
      request: "Product safety advice",
      reason: "Customer is allergic to peanuts",
      evidence: "Ingredient data available",
    },
    nextAction: "contact human support",
    sourceTags: ["Ingredients", "Allergen notice", "Safety rule"],
    loadingTitle: "Checking product safety...",
    loadingSteps: ["Understanding allergy concern", "Reading ingredients", "Checking safety rule", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Milk Cookies ingredients", "peanut sauce", "allergen notice"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Allergen information safety", "verified product ingredient", "do not eat"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["peanuts", "sesame", "egg", "milk"]),
    ],
    answerTemplate: (sources) => {
      const ingredients = sourceNumber(sources, (source) => /ingredient|product/i.test(source.category + source.title), 1);
      const safety = sourceNumber(sources, (source) => /safety|allergen/i.test(source.category + source.title), 2);
      return `I would not recommend eating this product.\n\nThe ingredient information lists peanut sauce and the allergen notice mentions peanuts [${ingredients}]. For allergy questions, I should only use verified product data and suggest human support if there is any risk [${safety}].`;
    },
  },
  missing_accessory: {
    key: "missing_accessory",
    product: {
      name: "Glass Food Containers Set",
      image: "container-set",
      detail: "4-piece set",
      status: "Delivered today",
      linkLabel: "Order details",
    },
    variables: {
      issueIdentified: "Missing accessory",
      request: "Replacement or refund",
      reason: "Accessory missing from package",
      evidence: "Photos needed",
    },
    nextAction: "prepare a support request",
    sourceTags: ["Missing accessory", "Order status", "Store policy"],
    loadingTitle: "Checking support options...",
    loadingSteps: ["Understanding your issue", "Checking order contents", "Reading support rule", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Missing accessory", "replacement accessory", "partial refund"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Glass Food Containers Set", "matching lids"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["photo", "package", "reviewed faster"]),
    ],
    answerTemplate: (sources) => {
      const rule = sourceNumber(sources, (source) => /missing|refund/i.test(source.title + source.category), 1);
      const order = sourceNumber(sources, (source) => /order/i.test(source.category), 2);
      return `Yes, I can help prepare a support request for the missing accessory.\n\nThe support rule says missing accessories may be handled with a replacement, partial refund, or full refund depending on the case [${rule}]. The order record shows this product should include matching parts [${order}].`;
    },
  },
};

const unknownScenario: Scenario = {
  key: "unknown",
  product: {
    name: "Current order",
    image: "glass-box",
    detail: "Recent order",
    status: "Checking details",
    linkLabel: "Order details",
  },
  variables: {
    issueIdentified: "General support question",
    request: "Advice",
    reason: "Customer needs help",
    evidence: "Not provided",
  },
  nextAction: "contact human support",
  sourceTags: ["Knowledge base", "Policy", "Human support"],
  loadingTitle: "Checking support information...",
  loadingSteps: ["Understanding your question", "Checking available records", "Reading relevant policy", "Preparing answer"],
  sourceMatchers: [
    () => true,
    (doc) => includesAny(`${doc.title} ${doc.category}`, ["policy", "return", "refund", "logistics", "safety"]),
    (doc) => includesAny(doc.content, ["support", "contact", "human"]),
  ],
  answerTemplate: (sources) => {
    const first = sourceNumber(sources, () => true, 1);
    return `I found some related support information, but I may need more details before taking action.\n\nThe closest available source is [${first}]. If this does not match your situation, I can pass this to human support with your question and the sources I checked.`;
  },
};

function detectScenario(question: string, taskId?: string): Scenario {
  const task = (taskId || "").toUpperCase();
  if (task === "S1-T1") return scenarios.glass_damaged_refund;
  if (task === "S1-T2") return scenarios.chilled_yoghurt_change_mind;
  if (task === "S1-T3") return scenarios.damaged_food_return;
  if (task === "S2-T1") return scenarios.glass_container_broken;
  if (task === "S2-T2") return scenarios.fresh_sandwich_change_mind;
  if (task === "S2-T3") return scenarios.snack_package_evidence_unclear;

  const q = question.toLowerCase();

  if (includesAny(q, ["sandwich", "fresh sandwich", "三明治", "鲜食"])) {
    return scenarios.fresh_sandwich_change_mind;
  }
  if (includesAny(q, ["yoghurt", "yogurt", "chilled", "cold", "refrigerated", "perishable", "酸奶", "冷藏", "生鲜"])) {
    return scenarios.chilled_yoghurt_change_mind;
  }
  if (includesAny(q, ["snack", "snacks", "package damage", "damaged package", "薯片", "零食", "包装破损"])) {
    return scenarios.snack_package_evidence_unclear;
  }
  if (includesAny(q, ["peanut", "allergen", "allergic", "过敏", "花生"])) return scenarios.allergen_safety;
  if (includesAny(q, ["late", "delay", "delayed", "compensation", "迟", "延迟", "补偿"])) return scenarios.late_delivery_compensation;
  if (includesAny(q, ["missing accessory", "missing lid", "accessory", "缺少", "少了", "配件"])) return scenarios.missing_accessory;
  if (includesAny(q, ["lid broken", "container lid", "food container", "container arrived broken", "盖子坏", "保鲜盒"])) {
    return scenarios.glass_container_broken;
  }
  if (includesAny(q, ["food", "cookie", "cookies", "biscuit", "snack", "食品", "饼干", "吃的"])) return scenarios.damaged_food_return;
  if (includesAny(q, ["glass", "lunch box", "damaged", "broken", "return", "refund", "玻璃", "破损", "损坏", "退货", "退款"])) {
    return scenarios.glass_damaged_refund;
  }

  return unknownScenario;
}

function scoreDoc(question: string, doc: KnowledgeDoc, scenario: Scenario): number {
  const text = `${doc.title} ${doc.category} ${doc.content}`.toLowerCase();
  const terms = Array.from(new Set(normaliseWords(`${question} ${scenario.variables.issueIdentified} ${scenario.variables.reason}`)));
  let score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);

  scenario.sourceMatchers.forEach((matcher, index) => {
    if (matcher(doc)) score += 18 - index * 4;
  });

  return score;
}

function mergeKnowledge(remoteDocs: KnowledgeDoc[]) {
  const byKey = new Map<string, KnowledgeDoc>();

  for (const doc of [...demoKnowledge, ...remoteDocs]) {
    if (doc.status !== "active") continue;
    byKey.set(`${doc.title.toLowerCase()}-${doc.category.toLowerCase()}`, doc);
  }

  return Array.from(byKey.values());
}

function pickScenarioDocs(docs: KnowledgeDoc[], scenario: Scenario, question: string) {
  const selected: RankedDoc[] = [];

  for (const matcher of scenario.sourceMatchers) {
    const match = docs
      .filter((doc) => !selected.some((item) => item.id === doc.id))
      .map((doc) => ({ ...doc, score: scoreDoc(question, doc, scenario) }))
      .sort((a, b) => b.score - a.score)
      .find((doc) => matcher(doc));

    if (match) selected.push(match);
  }

  const ranked = docs
    .filter((doc) => !selected.some((item) => item.id === doc.id))
    .map((doc) => ({ ...doc, score: scoreDoc(question, doc, scenario) }))
    .sort((a, b) => b.score - a.score)
    .filter((doc) => doc.score > 0);

  return [...selected, ...ranked].slice(0, 3);
}

function buildSources(docs: RankedDoc[]) {
  return docs.slice(0, 3).map((doc, index) => ({
    id: doc.id,
    number: index + 1,
    title: doc.title.replace(/^Order status — /, ""),
    category: doc.category,
    excerpt: doc.content,
    relevance: index < 2 ? ("High relevance" as const) : ("Medium relevance" as const),
    matchedAnswer:
      index === 0
        ? "the main policy used in this answer"
        : index === 1
          ? "the order or product record used in this answer"
          : "supporting store guidance",
  }));
}

function sourceTags(scenario: Scenario, sources: BuyerSource[]) {
  const tags = sources.map((source) => {
    if (
      (scenario.key === "chilled_yoghurt_change_mind" || scenario.key === "fresh_sandwich_change_mind") &&
      /return|exception/i.test(source.category + source.title)
    ) return "Food exception";
    if (scenario.key === "snack_package_evidence_unclear" && /evidence|photo/i.test(source.category + source.title)) return "Evidence needed";
    if (/refund/i.test(source.category)) return scenario.key === "missing_accessory" ? "Missing accessory" : "Return policy";
    if (/return/i.test(source.category)) return "Food return rule";
    if (/logistics/i.test(source.category)) return "Delivery policy";
    if (/safety/i.test(source.category)) return "Safety rule";
    if (/product/i.test(source.category)) return "Product details";
    if (/order/i.test(source.category)) return scenario.key === "late_delivery_compensation" ? "Order timeline" : "Order status";
    return source.category;
  });

  return Array.from(new Set(tags)).slice(0, 3);
}

function confidenceFor(scenario: Scenario, sources: BuyerSource[]) {
  if (scenario.key === "unknown") return 58;
  if (sources.length >= 3) return 88;
  if (sources.length === 2) return 80;
  return 66;
}

function cleanBuyerAnswer(answer: string) {
  const cleaned = answer
    .replace(/\*\*/g, "")
    .replace(/^[-•]\s+/gm, "")
    .trim();

  if (!cleaned) return cleaned;

  const [firstPart, ...restParts] = cleaned.includes("\n\n")
    ? cleaned.split("\n\n")
    : (() => {
        const splitIndex = cleaned.search(/\.\s+[A-Z]/);
        if (splitIndex === -1) return [cleaned];
        return [cleaned.slice(0, splitIndex + 1), cleaned.slice(splitIndex + 2)];
      })();

  const firstWithCitation = /\[\d+\]/.test(firstPart) ? firstPart : `${firstPart} [1]`;
  return [firstWithCitation, ...restParts].join("\n\n");
}

async function fetchKnowledgeDocs() {
  try {
    const query = supabase
      .from("knowledge_docs")
      .select("id, title, category, content, status")
      .eq("status", "active");

    const timeout = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), 1600);
    });

    const result = await Promise.race([query, timeout]);

    if (result === "timeout") {
      console.warn("TraceGuide Supabase timeout: using demo knowledge fallback.");
      return [];
    }

    const { data, error } = result;

    if (error) {
      console.error("TraceGuide Supabase error:", error);
      return [];
    }

    return (data || []) as KnowledgeDoc[];
  } catch (error) {
    console.error("TraceGuide Supabase connection error:", error);
    return [];
  }
}

async function generateWithLLM(question: string, scenario: Scenario, sources: BuyerSource[]) {
  const client = getOpenAIClient();
  if (!client || scenario.key === "unknown") return null;

  const context = sources
    .map(
      (source) => `[${source.number}] ${source.title}
Category: ${source.category}
Content: ${source.excerpt}`
    )
    .join("\n\n");

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.35,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You are a buyer-facing e-commerce service agent. Answer in natural UK English. Use only the provided sources. Keep it concise. Include source citations like [1] and [2] after the exact claims they support. Do not mention retrieval, embeddings, scores, internal tools, or chain-of-thought. If an action is possible, phrase it as something you can prepare after user confirmation.",
        },
        {
          role: "user",
          content: `Customer question: ${question}

Known task variables:
- Issue: ${scenario.variables.issueIdentified}
- Request: ${scenario.variables.request}
- Reason: ${scenario.variables.reason}
- Evidence: ${scenario.variables.evidence}

Sources:
${context}

Write a short answer with a bold-style first sentence but without markdown bullets. Use citations.`,
        },
      ],
    });

    const answer = cleanBuyerAnswer(completion.choices[0]?.message?.content || "");
    if (!answer || !/\[\d+\]/.test(answer) || !isSafeLLMAnswer(answer, scenario, sources)) return null;

    return answer;
  } catch (error) {
    console.error("TraceGuide LLM error:", error);
    return null;
  }
}

function isSafeLLMAnswer(answer: string, scenario: Scenario, sources: BuyerSource[]) {
  const validCitationNumbers = new Set(sources.map((source) => source.number));
  const citationNumbers = Array.from(answer.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]));
  if (!citationNumbers.length || citationNumbers.some((number) => !validCitationNumbers.has(number))) return false;

  const lower = answer.toLowerCase();
  if (scenario.product.name !== "Milk Cookies" && includesAny(lower, ["milk cookies", "cookie order"])) return false;
  if (scenario.product.name !== "Glass Lunch Box" && includesAny(lower, ["glass lunch box"])) return false;
  if (scenario.product.name !== "Chilled Yoghurt" && includesAny(lower, ["chilled yoghurt", "yoghurt order", "yogurt order"])) return false;
  if (scenario.key === "glass_damaged_refund" && includesAny(lower, ["food item", "food product", "hygiene"])) return false;
  if (scenario.key === "allergen_safety" && includesAny(lower, ["safe to eat", "you can eat"])) return false;
  if (scenario.key === "chilled_yoghurt_change_mind" && includesAny(lower, ["eligible for a return and refund", "start a standard return"])) return false;
  if (scenario.key === "fresh_sandwich_change_mind" && includesAny(lower, ["eligible for a return and refund", "start a standard return", "can return it because"])) return false;
  if (scenario.key === "damaged_food_return" && includesAny(lower, ["you are eligible for a refund", "i can start a refund request", "i can prepare a refund request"])) return false;
  if (scenario.key === "snack_package_evidence_unclear" && includesAny(lower, ["proceed with your refund request", "start a refund request", "eligible for a refund"])) return false;

  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return Response.json({ error: "Question is required." }, { status: 400 });
    }

    const scenario = detectScenario(question, typeof body.taskId === "string" ? body.taskId : undefined);
    const remoteDocs = await fetchKnowledgeDocs();
    const knowledgeDocs = mergeKnowledge(remoteDocs);
    const selectedDocs = pickScenarioDocs(knowledgeDocs, scenario, question);
    const docsForSources = selectedDocs.length
      ? selectedDocs
      : demoKnowledge.slice(0, 3).map((doc, index) => ({ ...doc, score: 10 - index }));
    const sources = buildSources(docsForSources);
    const llmAnswer = await generateWithLLM(question, scenario, sources);
    const answer = cleanBuyerAnswer(llmAnswer || scenario.answerTemplate(sources));

    return Response.json({
      answer,
      confidence: confidenceFor(scenario, sources),
      sources,
      sourceTags: sourceTags(scenario, sources.length ? sources : []),
      variables: {
        ...scenario.variables,
        ...(body.variables || {}),
      },
      nextAction: scenario.nextAction,
      product: scenario.product,
      loadingTitle: scenario.loadingTitle,
      loadingSteps: scenario.loadingSteps,
      scenario: scenario.key,
      usedLLM: Boolean(llmAnswer),
    });
  } catch (error) {
    console.error("TraceGuide API error:", error);
    const scenario = scenarios.glass_damaged_refund;
    const sources = buildSources(demoKnowledge.slice(0, 3).map((doc, index) => ({ ...doc, score: 10 - index })));

    return Response.json({
      answer: scenario.answerTemplate(sources),
      confidence: 72,
      sources,
      sourceTags: scenario.sourceTags,
      variables: scenario.variables,
      nextAction: scenario.nextAction,
      product: scenario.product,
      loadingTitle: scenario.loadingTitle,
      loadingSteps: scenario.loadingSteps,
      scenario: scenario.key,
      usedLLM: false,
    });
  }
}
