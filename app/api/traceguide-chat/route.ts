import OpenAI from "openai";
import { supabase } from "../../../lib/supabase";
import {
  commerceContextFromDatabaseRows,
  commerceContextToKnowledgeDocs,
  getCommerceContext,
  type CommerceContext,
  type CommerceDatabaseRows,
  type TraceVariables,
} from "../../../lib/traceguide-commerce-data";

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

type ProductContext = {
  name: string;
  image: "glass-box" | "cookies" | "container-set" | "coffee-maker" | "protein-bar" | "yoghurt" | "sandwich" | "snack";
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
  | "protein_bar_allergen_safety"
  | "coffee_maker_address_change"
  | "fresh_sandwich_address_change"
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
  matchScore: number;
  relevance: "High relevance" | "Medium relevance" | "Relevant";
  matchedAnswer?: string;
};

type ActionState = {
  kind: "ready" | "needs_evidence" | "needs_human_review" | "informational";
  label: string;
  prompt: string;
  primaryAction: string;
  secondaryAction: string;
  canStartRequest: boolean;
};

type VariableAssessment = {
  answer?: string;
  nextAction: string;
  taskType?: string;
  sourceTags?: string[];
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
    id: "demo-protein-bar-ingredients",
    title: "Protein Bar ingredients and allergen notice",
    category: "Product details",
    status: "active",
    content:
      "The Protein Bar ingredients include oats, cocoa, milk protein, soy lecithin and roasted peanut pieces. The allergen notice says it contains peanuts, milk and soy.",
  },
  {
    id: "demo-address-change-before-dispatch",
    title: "Address change before dispatch policy",
    category: "Order modification",
    status: "active",
    content:
      "A delivery address can usually be changed before the order is dispatched. The customer must confirm the new address before support submits the change request.",
  },
  {
    id: "demo-address-change-after-dispatch",
    title: "Address change after dispatch policy",
    category: "Order modification",
    status: "active",
    content:
      "After an order has been dispatched or is out for delivery, the delivery address usually cannot be changed in the normal self-service flow. Support may contact the carrier or hand the case to a human agent.",
  },
  {
    id: "demo-coffee-maker-order-status",
    title: "Order status — Coffee Maker",
    category: "Order status",
    status: "active",
    content:
      "The Coffee Maker order is still processing and has not been dispatched. Because the package has not left the warehouse, an address change request can be prepared before submission.",
  },
  {
    id: "demo-fresh-sandwich-delivery-status",
    title: "Delivery status — Fresh Sandwich",
    category: "Order status",
    status: "active",
    content:
      "The Fresh Sandwich order is already out for delivery. The normal address change window has closed, so any change needs human support or carrier review.",
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
  protein_bar_allergen_safety: {
    key: "protein_bar_allergen_safety",
    product: {
      name: "Protein Bar",
      image: "protein-bar",
      detail: "60g / bar",
      status: "Delivered yesterday",
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
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Protein Bar ingredients", "roasted peanut pieces", "contains peanuts"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Allergen information safety", "verified product ingredient", "do not eat"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["peanuts", "milk", "soy"]),
    ],
    answerTemplate: (sources) => {
      const ingredients = sourceNumber(sources, (source) => /ingredient|product/i.test(source.category + source.title), 1);
      const safety = sourceNumber(sources, (source) => /safety|allergen/i.test(source.category + source.title), 2);
      return `I would not recommend eating this product.\n\nThe product information says the Protein Bar contains roasted peanut pieces and the allergen notice includes peanuts [${ingredients}]. For allergy questions, I should use verified ingredient data and avoid reassuring you when there is a listed allergen risk [${safety}].`;
    },
  },
  coffee_maker_address_change: {
    key: "coffee_maker_address_change",
    product: {
      name: "Coffee Maker",
      image: "coffee-maker",
      detail: "1 item",
      status: "Not dispatched yet",
      linkLabel: "Order details",
    },
    variables: {
      issueIdentified: "Delivery address change",
      request: "Change delivery address",
      reason: "Order has not been dispatched",
      evidence: "Order status available",
    },
    nextAction: "prepare an address change request",
    sourceTags: ["Address policy", "Order status", "Confirmation needed"],
    loadingTitle: "Checking if the address can be changed...",
    loadingSteps: ["Understanding your request", "Checking order status", "Reading address change policy", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Address change before dispatch", "before the order is dispatched", "new address"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Coffee Maker", "not been dispatched", "processing"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["confirm the new address", "submits the change request"]),
    ],
    answerTemplate: (sources) => {
      const policy = sourceNumber(sources, (source) => /modification|address/i.test(source.category + source.title), 1);
      const order = sourceNumber(sources, (source) => /order/i.test(source.category), 2);
      return `Yes, I can help prepare an address change request.\n\nThe order status shows the Coffee Maker has not been dispatched yet [${order}]. The address change policy says the delivery address can usually be changed before dispatch, but you need to confirm the new address before it is submitted [${policy}].`;
    },
  },
  fresh_sandwich_address_change: {
    key: "fresh_sandwich_address_change",
    product: {
      name: "Fresh Sandwich",
      image: "sandwich",
      detail: "1 pack",
      status: "Out for delivery",
      linkLabel: "Delivery details",
    },
    variables: {
      issueIdentified: "Delivery address change",
      request: "Change delivery address",
      reason: "Order is already out for delivery",
      evidence: "Delivery status available",
    },
    nextAction: "send this to human support for review",
    sourceTags: ["Address policy", "Delivery status", "Human support"],
    loadingTitle: "Checking delivery status...",
    loadingSteps: ["Understanding your request", "Checking delivery status", "Reading address change policy", "Preparing answer"],
    sourceMatchers: [
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Address change after dispatch", "out for delivery", "cannot be changed"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["Fresh Sandwich", "out for delivery", "normal address change window"]),
      (doc) => includesAny(`${doc.title} ${doc.category} ${doc.content}`, ["human support", "carrier review"]),
    ],
    answerTemplate: (sources) => {
      const policy = sourceNumber(sources, (source) => /modification|address/i.test(source.category + source.title), 1);
      const order = sourceNumber(sources, (source) => /order|delivery/i.test(source.category + source.title), 2);
      return `I would not start a normal address change from this screen.\n\nThe delivery status says the Fresh Sandwich is already out for delivery [${order}]. The address change policy says orders that have been dispatched or are out for delivery usually cannot be changed through the normal self-service flow, so this needs human support or carrier review [${policy}].`;
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
  if (task === "S1-T1") return scenarios.allergen_safety;
  if (task === "S1-T2") return scenarios.coffee_maker_address_change;
  if (task === "S1-T3") return scenarios.glass_damaged_refund;
  if (task === "S2-T1") return scenarios.protein_bar_allergen_safety;
  if (task === "S2-T2") return scenarios.fresh_sandwich_address_change;
  if (task === "S2-T3") return scenarios.snack_package_evidence_unclear;

  const q = question.toLowerCase();

  if (includesAny(q, ["change address", "delivery address", "modify address", "new address", "改地址", "修改地址", "收货地址"])) {
    if (includesAny(q, ["sandwich", "fresh", "out for delivery", "already shipped", "already dispatched", "三明治", "已发货", "配送中"])) {
      return scenarios.fresh_sandwich_address_change;
    }

    return scenarios.coffee_maker_address_change;
  }
  if (includesAny(q, ["protein bar", "蛋白棒"])) return scenarios.protein_bar_allergen_safety;
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

function scoreDoc(question: string, doc: KnowledgeDoc, scenario: Scenario, variables = scenario.variables): number {
  const text = `${doc.title} ${doc.category} ${doc.content}`.toLowerCase();
  const terms = Array.from(
    new Set(
      normaliseWords(
        `${question} ${variables.issueIdentified} ${variables.request} ${variables.reason} ${variables.evidence}`
      )
    )
  );
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

const productNames = [
  "Glass Lunch Box",
  "Glass Food Container",
  "Glass Food Containers Set",
  "Milk Cookies",
  "Coffee Maker",
  "Protein Bar",
  "Chilled Yoghurt",
  "Fresh Sandwich",
  "Snack Pack",
];

function isRelevantToScenario(doc: KnowledgeDoc, scenario: Scenario) {
  const text = `${doc.title} ${doc.content}`.toLowerCase();
  const scenarioProduct = scenario.product.name.toLowerCase();
  const mentionedOtherProduct = productNames.some((name) => {
    const lowerName = name.toLowerCase();
    return lowerName !== scenarioProduct && text.includes(lowerName);
  });

  if (!mentionedOtherProduct) return true;

  const category = doc.category.toLowerCase();
  const isProductOrOrderSpecific =
    category.includes("product") ||
    category.includes("order") ||
    category.includes("evidence") ||
    doc.title.toLowerCase().startsWith("order ") ||
    doc.title.toLowerCase().startsWith("product ");

  return !isProductOrOrderSpecific;
}

function pickScenarioDocs(docs: KnowledgeDoc[], scenario: Scenario, question: string, variables = scenario.variables) {
  const relevantDocs = docs.filter((doc) => isRelevantToScenario(doc, scenario));
  const selected: RankedDoc[] = [];

  for (const matcher of scenario.sourceMatchers) {
    const match = relevantDocs
      .filter((doc) => !selected.some((item) => item.id === doc.id))
      .map((doc) => ({ ...doc, score: scoreDoc(question, doc, scenario, variables) }))
      .sort((a, b) => b.score - a.score)
      .find((doc) => matcher(doc));

    if (match) selected.push(match);
  }

  const ranked = relevantDocs
    .filter((doc) => !selected.some((item) => item.id === doc.id))
    .map((doc) => ({ ...doc, score: scoreDoc(question, doc, scenario, variables) }))
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
    matchScore: doc.score,
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
    if (/modification/i.test(source.category) || /address/i.test(source.title)) return "Address policy";
    if (/return/i.test(source.category)) return "Food return rule";
    if (/logistics/i.test(source.category)) return "Delivery policy";
    if (/safety/i.test(source.category)) return "Safety rule";
    if (/product/i.test(source.category)) return "Product details";
    if (/order/i.test(source.category)) return scenario.key === "late_delivery_compensation" ? "Order timeline" : "Order status";
    return source.category;
  });

  return Array.from(new Set(tags)).slice(0, 3);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function variableCompleteness(variables: TraceVariables) {
  const values = [
    variables.issueIdentified,
    variables.request,
    variables.reason,
    variables.evidence,
  ];
  const knownValues = values.filter((value) => {
    const normalised = value.toLowerCase();
    return (
      value.trim() &&
      !normalised.includes("not provided") &&
      !normalised.includes("not sure") &&
      !normalised.includes("not added") &&
      !normalised.includes("needed") &&
      !normalised.includes("unclear")
    );
  });

  return knownValues.length / values.length;
}

function confidenceFor(
  scenario: Scenario,
  sources: BuyerSource[],
  variables: TraceVariables,
  assessment: VariableAssessment,
  usedLLM: boolean
) {
  const sourceStrength = sources.length
    ? sources.reduce((total, source) => total + clamp(source.matchScore / 30, 0, 1), 0) / sources.length
    : 0;
  const hasPolicyLikeSource = sources.some((source) =>
    /policy|refund|return|exception|logistics|safety|evidence/i.test(`${source.category} ${source.title}`)
  );
  const hasOrderOrProductSource = sources.some((source) =>
    /order|product|ingredient|status/i.test(`${source.category} ${source.title}`)
  );
  const hasSupportingSource = sources.length >= 3;
  const coverageScore =
    (hasPolicyLikeSource ? 0.42 : 0) +
    (hasOrderOrProductSource ? 0.38 : 0) +
    (hasSupportingSource ? 0.2 : 0);
  const variableScore = variableCompleteness(variables);
  const guardedGenerationScore = usedLLM ? 1 : 0.86;
  const requiresHumanReview =
    /human_review|boundary_exception/.test(assessment.taskType || "") ||
    /human support|review/i.test(assessment.nextAction);
  const needsEvidence = /evidence_required/.test(assessment.taskType || "");

  let score =
    42 +
    sourceStrength * 26 +
    coverageScore * 18 +
    variableScore * 10 +
    guardedGenerationScore * 4 +
    (requiresHumanReview || needsEvidence ? 1 : 3);

  const caps: string[] = [];
  if (scenario.key === "unknown") {
    score = Math.min(score, 64);
    caps.push("unknown task");
  }

  if (needsEvidence) {
    score = Math.min(score, 76);
    caps.push("evidence is still missing");
  }

  if (requiresHumanReview) {
    score = Math.min(score, 82);
    caps.push("human review is recommended");
  }

  const roundedScore = Math.round(clamp(score, 48, 96));
  const coverageLabels = [
    hasPolicyLikeSource ? "policy/source evidence" : null,
    hasOrderOrProductSource ? "order or product record" : null,
    hasSupportingSource ? "supporting store guidance" : null,
  ].filter(Boolean);

  return {
    score: roundedScore,
    reason: [
      `Calculated from ${sources.length} matched source${sources.length === 1 ? "" : "s"}`,
      coverageLabels.length ? `covering ${coverageLabels.join(", ")}` : "with limited source coverage",
      `and ${Math.round(variableScore * 100)}% completed task details`,
      usedLLM ? "with the generated answer passing safety checks" : "using the grounded fallback answer",
      caps.length ? `capped because ${caps.join(" and ")}` : "no execution blocker detected",
    ].join("; "),
  };
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

  const heading = firstPart
    .replace(/\s*\[\d+\]/g, "")
    .replace(/,?\s+(as stated|as shown|as per|according to|as mentioned)\b.*$/i, ".")
    .trim();

  if (/\[\d+\]/.test(cleaned)) return [heading, ...restParts].join("\n\n");

  if (restParts.length) {
    return [heading, `${restParts[0]} [1]`, ...restParts.slice(1)].join("\n\n");
  }

  return `${heading} [1]`;
}

function agentStagesFor(scenario: Scenario) {
  return scenario.loadingSteps.map((label, index) => ({
    label,
    status: "completed",
    visibleToBuyer: true,
    order: index + 1,
  }));
}

function taskTypeFor(scenario: Scenario, variables = scenario.variables) {
  const evidence = variables.evidence.toLowerCase();
  const evidenceMissing =
    evidence.includes("not added") ||
    evidence.includes("unclear") ||
    evidence.includes("not sure") ||
    evidence.includes("needed");

  if (scenario.key.includes("change_mind")) return "boundary_exception_review";
  if (scenario.key === "coffee_maker_address_change") return "order_modification_support";
  if (scenario.key === "fresh_sandwich_address_change") return "human_review";
  if ((scenario.key.includes("evidence") || scenario.key === "damaged_food_return") && evidenceMissing) {
    return "evidence_required_review";
  }
  if (scenario.key.includes("compensation")) return "delivery_compensation";
  if (scenario.key.includes("allergen")) return "product_safety_advice";
  if (scenario.key.includes("missing")) return "missing_item_support";
  return "refund_or_return_support";
}

function actionStateFor(scenario: Scenario, assessment: VariableAssessment): ActionState {
  const taskType = assessment.taskType || taskTypeFor(scenario);
  const nextAction = assessment.nextAction.toLowerCase();

  if (/evidence_required/.test(taskType) || /photo|evidence/.test(nextAction)) {
    return {
      kind: "needs_evidence",
      label: "Photo needed",
      prompt: "Please add a photo before I prepare the request.",
      primaryAction: "I have a photo",
      secondaryAction: "Talk to human",
      canStartRequest: false,
    };
  }

  if (/human_review|boundary_exception/.test(taskType) || /human support|review/.test(nextAction)) {
    return {
      kind: "needs_human_review",
      label: "Review needed",
      prompt: "This case needs human review before a request can be started.",
      primaryAction: "Talk to human",
      secondaryAction: "Ask another question",
      canStartRequest: false,
    };
  }

  if (/safety|allergen/.test(taskType)) {
    return {
      kind: "informational",
      label: "Advice only",
      prompt: "I can show the product information used for this answer.",
      primaryAction: "Talk to human",
      secondaryAction: "Ask another question",
      canStartRequest: false,
    };
  }

  return {
    kind: "ready",
    label: "Ready to request",
    prompt: `Would you like me to ${assessment.nextAction}?`,
    primaryAction: "Yes",
    secondaryAction: "No",
    canStartRequest: true,
  };
}

function actionPreviewFor(scenario: Scenario, nextAction = scenario.nextAction) {
  return {
    label: nextAction,
    requiresUserConfirmation: true,
    simulatedAction: true,
    description:
      "The prototype can prepare a service request for review, but it does not process real payments, refunds, returns or order changes.",
  };
}

function cleanVariables(scenario: Scenario, bodyVariables: unknown): TraceVariables | undefined {
  if (!bodyVariables || typeof bodyVariables !== "object") return undefined;
  const incoming = bodyVariables as Partial<TraceVariables>;

  return {
    issueIdentified: typeof incoming.issueIdentified === "string" ? incoming.issueIdentified : scenario.variables.issueIdentified,
    request: typeof incoming.request === "string" ? incoming.request : scenario.variables.request,
    reason: typeof incoming.reason === "string" ? incoming.reason : scenario.variables.reason,
    evidence: typeof incoming.evidence === "string" ? incoming.evidence : scenario.variables.evidence,
  };
}

function hasAnyValue(text: string, terms: string[]) {
  return includesAny(text.toLowerCase(), terms.map((term) => term.toLowerCase()));
}

function sourceRef(sources: BuyerSource[], matcher: (source: BuyerSource) => boolean, fallback: number) {
  return sourceNumber(sources, matcher, fallback);
}

function assessVariables(scenario: Scenario, variables: TraceVariables, sources: BuyerSource[]): VariableAssessment {
  const allVariables = `${variables.issueIdentified} ${variables.request} ${variables.reason} ${variables.evidence}`;
  const evidenceProvided = hasAnyValue(variables.evidence, ["photos provided", "photo provided", "packaging kept"]);
  const noQualityIssue = hasAnyValue(`${variables.reason} ${variables.evidence}`, [
    "no quality issue",
    "changed their mind",
    "change-of-mind",
  ]);
  const qualityOrSafetyIssue = hasAnyValue(allVariables, [
    "damaged",
    "unsafe",
    "quality",
    "temperature",
    "wrong item",
    "expired",
    "broken",
  ]);
  const wantsHuman = hasAnyValue(variables.request, ["human support", "ask seller"]) || hasAnyValue(scenario.nextAction, ["human support"]);

  if (scenario.key === "allergen_safety" || scenario.key === "protein_bar_allergen_safety") {
    const ingredients = sourceRef(sources, (source) => /ingredient|product/i.test(source.category + source.title), 1);
    const safety = sourceRef(sources, (source) => /safety|allergen/i.test(source.category + source.title), 2);
    const ingredientClaim =
      scenario.key === "protein_bar_allergen_safety"
        ? "contains roasted peanut pieces and the allergen notice includes peanuts"
        : "lists peanut sauce and the allergen notice mentions peanuts";

    return {
      answer: `I would not recommend eating this product.\n\nThe ${scenario.product.name} product information ${ingredientClaim} [${ingredients}]. For allergy questions, I should use verified product data and avoid reassuring you when there is a listed allergen risk [${safety}].`,
      nextAction: "contact human support",
      taskType: "product_safety_advice",
      sourceTags: ["Ingredients", "Allergen notice", "Safety rule"],
    };
  }

  if (scenario.key === "coffee_maker_address_change") {
    const policy = sourceRef(sources, (source) => /modification|address/i.test(source.category + source.title), 1);
    const order = sourceRef(sources, (source) => /order/i.test(source.category), 2);
    return {
      answer: `Yes, I can help prepare an address change request.\n\nThe order status shows the Coffee Maker has not been dispatched yet [${order}]. The address change policy says the delivery address can usually be changed before dispatch, but you need to confirm the new address before it is submitted [${policy}].`,
      nextAction: "prepare an address change request",
      taskType: "order_modification_support",
      sourceTags: ["Address policy", "Order status", "Confirmation needed"],
    };
  }

  if (scenario.key === "fresh_sandwich_address_change") {
    const policy = sourceRef(sources, (source) => /modification|address/i.test(source.category + source.title), 1);
    const order = sourceRef(sources, (source) => /order|delivery/i.test(source.category + source.title), 2);
    return {
      answer: `I would not start a normal address change from this screen.\n\nThe delivery status says the Fresh Sandwich is already out for delivery [${order}]. The address change policy says orders that have been dispatched or are out for delivery usually cannot be changed through the normal self-service flow, so this needs human support or carrier review [${policy}].`,
      nextAction: "send this to human support for review",
      taskType: "human_review",
      sourceTags: ["Address policy", "Delivery status", "Human support"],
    };
  }

  if (wantsHuman && !qualityOrSafetyIssue) {
    const policy = sourceRef(sources, (source) => /policy|return|support/i.test(source.category + source.title), 1);
    return {
      answer: `I can pass this to human support for review.\n\nI checked the available policy and order information [${policy}], but this situation needs a human decision before any service request is started.`,
      nextAction: "contact human support",
      taskType: "human_review",
      sourceTags: ["Human review", "Policy", "Order status"],
    };
  }

  if (
    (scenario.key === "snack_package_evidence_unclear" || scenario.key === "damaged_food_return") &&
    evidenceProvided
  ) {
    const evidence = sourceRef(sources, (source) => /evidence|photo|policy|return/i.test(source.category + source.title), 1);
    const order = sourceRef(sources, (source) => /order/i.test(source.category), 2);
    return {
      answer: `Yes, I can now prepare this for review.\n\nThe order record is available [${order}], and the evidence requirement is now met because photos have been provided [${evidence}]. I can prepare the refund or replacement request after you confirm.`,
      nextAction: "start a refund request",
      taskType: "refund_or_return_support",
      sourceTags: ["Evidence checked", "Order status", "Store policy"],
    };
  }

  if (
    (scenario.key === "chilled_yoghurt_change_mind" || scenario.key === "fresh_sandwich_change_mind") &&
    qualityOrSafetyIssue &&
    !noQualityIssue
  ) {
    const exception = sourceRef(sources, (source) => /return|exception|food/i.test(source.category + source.title), 1);
    const order = sourceRef(sources, (source) => /order/i.test(source.category), 2);
    return {
      answer: `I would not start a standard change-of-mind return, but this should be reviewed.\n\nThe order record is available [${order}], and food return exceptions allow review when there is a quality, safety, temperature, packaging, or delivery issue [${exception}]. I can send this to human support with the details you confirmed.`,
      nextAction: "send this to human support for review",
      taskType: "human_review",
      sourceTags: ["Food exception", "Order status", "Human review"],
    };
  }

  if (scenario.key === "missing_accessory" && evidenceProvided) {
    const rule = sourceRef(sources, (source) => /missing|refund|support/i.test(source.category + source.title), 1);
    const order = sourceRef(sources, (source) => /order/i.test(source.category), 2);
    return {
      answer: `Yes, I can prepare a support request now.\n\nThe order record shows the product should include matching parts [${order}], and the support rule allows a replacement or refund request for missing accessories when the package details are available [${rule}].`,
      nextAction: "prepare a support request",
      taskType: "missing_item_support",
      sourceTags: ["Missing accessory", "Order status", "Store policy"],
    };
  }

  return {
    nextAction: scenario.nextAction,
    taskType: taskTypeFor(scenario, variables),
  };
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

async function fetchCommerceContextFromSupabase(
  scenario: Scenario,
  taskId: string | undefined,
  editedVariables?: TraceVariables
): Promise<CommerceContext | null> {
  try {
    let taskQuery = supabase.from("traceguide_experiment_tasks").select("*");
    taskQuery = taskId
      ? taskQuery.eq("id", taskId)
      : taskQuery.eq("scenario_key", scenario.key);

    const taskResult = await taskQuery.limit(1).maybeSingle();
    if (taskResult.error || !taskResult.data) return null;

    const task = taskResult.data as CommerceDatabaseRows["task"];
    const [customerResult, orderResult] = await Promise.all([
      supabase.from("traceguide_customers").select("*").eq("id", task.customer_id).maybeSingle(),
      supabase.from("traceguide_orders").select("*").eq("id", task.order_id).maybeSingle(),
    ]);

    if (customerResult.error || orderResult.error || !customerResult.data || !orderResult.data) return null;

    const order = orderResult.data as CommerceDatabaseRows["order"];
    const [productResult, evidenceResult] = await Promise.all([
      supabase.from("traceguide_products").select("*").eq("id", order.product_id).maybeSingle(),
      supabase
        .from("traceguide_evidence_records")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (productResult.error || evidenceResult.error || !productResult.data || !evidenceResult.data) return null;

    return commerceContextFromDatabaseRows(
      {
        task,
        customer: customerResult.data as CommerceDatabaseRows["customer"],
        product: productResult.data as CommerceDatabaseRows["product"],
        order,
        evidence: evidenceResult.data as CommerceDatabaseRows["evidence"],
      },
      editedVariables
    );
  } catch (error) {
    console.warn("TraceGuide commerce DB context unavailable; using server fixture.", error);
    return null;
  }
}

async function logAgentRun({
  participantCode,
  condition,
  taskId,
  question,
  scenarioKey,
  variables,
  sources,
  confidence,
  confidenceReason,
  answer,
  nextAction,
}: {
  participantCode?: string;
  condition?: string;
  taskId?: string;
  question: string;
  scenarioKey: string;
  variables: TraceVariables;
  sources: BuyerSource[];
  confidence: number;
  confidenceReason: string;
  answer: string;
  nextAction: string;
}) {
  try {
    await supabase.from("traceguide_agent_runs").insert({
      participant_code: participantCode || null,
      condition: condition || null,
      task_id: taskId || null,
      question,
      detected_scenario: scenarioKey,
      variables,
      sources,
      confidence,
      confidence_reason: confidenceReason,
      answer,
      next_action: nextAction,
    });
  } catch (error) {
    console.warn("TraceGuide agent run log skipped.", error);
  }
}

async function generateWithLLM(
  question: string,
  scenario: Scenario,
  sources: BuyerSource[],
  variables: TraceVariables,
  assessment: VariableAssessment
) {
  const client = getOpenAIClient();
  if (!client || scenario.key === "unknown" || assessment.answer) return null;

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
- Issue: ${variables.issueIdentified}
- Request: ${variables.request}
- Reason: ${variables.reason}
- Evidence: ${variables.evidence}

Current service decision:
- Next action: ${assessment.nextAction}
- Task type: ${assessment.taskType || taskTypeFor(scenario, variables)}

Sources:
${context}

Write a short answer with a bold-style first sentence but without markdown bullets. Use citations.`,
        },
      ],
    });

    const answer = cleanBuyerAnswer(completion.choices[0]?.message?.content || "");
    if (!answer || !/\[\d+\]/.test(answer) || !isSafeLLMAnswer(answer, scenario, sources, variables)) return null;

    return answer;
  } catch (error) {
    console.error("TraceGuide LLM error:", error);
    return null;
  }
}

function isSafeLLMAnswer(answer: string, scenario: Scenario, sources: BuyerSource[], variables = scenario.variables) {
  const validCitationNumbers = new Set(sources.map((source) => source.number));
  const citationNumbers = Array.from(answer.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]));
  if (!citationNumbers.length || citationNumbers.some((number) => !validCitationNumbers.has(number))) return false;

  const lower = answer.toLowerCase();
  if (scenario.product.name !== "Milk Cookies" && includesAny(lower, ["milk cookies", "cookie order"])) return false;
  if (scenario.product.name !== "Glass Lunch Box" && includesAny(lower, ["glass lunch box"])) return false;
  if (scenario.product.name !== "Chilled Yoghurt" && includesAny(lower, ["chilled yoghurt", "yoghurt order", "yogurt order"])) return false;
  if (scenario.product.name !== "Protein Bar" && includesAny(lower, ["protein bar"])) return false;
  if (scenario.product.name !== "Coffee Maker" && includesAny(lower, ["coffee maker"])) return false;
  if (scenario.key === "glass_damaged_refund" && includesAny(lower, ["food item", "food product", "hygiene"])) return false;
  if ((scenario.key === "allergen_safety" || scenario.key === "protein_bar_allergen_safety") && includesAny(lower, ["safe to eat", "you can eat", "fine to eat"])) return false;
  if (scenario.key === "fresh_sandwich_address_change" && includesAny(lower, ["i can change the address", "can change the delivery address", "start an address change", "prepare an address change request"])) return false;
  if (scenario.key === "chilled_yoghurt_change_mind" && includesAny(lower, ["eligible for a return and refund", "start a standard return"])) return false;
  if (scenario.key === "fresh_sandwich_change_mind" && includesAny(lower, ["eligible for a return and refund", "start a standard return", "can return it because"])) return false;
  const evidenceProvided = hasAnyValue(variables.evidence, ["photos provided", "photo provided", "packaging kept"]);
  if (!evidenceProvided && scenario.key === "damaged_food_return" && includesAny(lower, ["you are eligible for a refund", "i can start a refund request", "i can prepare a refund request"])) return false;
  if (!evidenceProvided && scenario.key === "snack_package_evidence_unclear" && includesAny(lower, ["proceed with your refund request", "start a refund request", "eligible for a refund"])) return false;

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
    const incomingVariables = cleanVariables(scenario, body.variables);
    const taskId = typeof body.taskId === "string" ? body.taskId : undefined;
    const commerceContext =
      (await fetchCommerceContextFromSupabase(scenario, taskId, incomingVariables)) ||
      getCommerceContext(scenario.key, taskId, incomingVariables);
    const variables = commerceContext.variables;
    const contextDocs = commerceContextToKnowledgeDocs(commerceContext);
    const remoteDocs = await fetchKnowledgeDocs();
    const knowledgeDocs = mergeKnowledge([...remoteDocs, ...contextDocs]);
    const selectedDocs = pickScenarioDocs(knowledgeDocs, scenario, question, variables);
    const docsForSources = selectedDocs.length
      ? selectedDocs
      : demoKnowledge.slice(0, 3).map((doc, index) => ({ ...doc, score: 10 - index }));
    const sources = buildSources(docsForSources);
    const assessment = assessVariables(scenario, variables, sources);
    const llmAnswer = await generateWithLLM(question, scenario, sources, variables, assessment);
    const answer = cleanBuyerAnswer(assessment.answer || llmAnswer || scenario.answerTemplate(sources));
    const nextAction = assessment.nextAction;
    const confidence = confidenceFor(scenario, sources, variables, assessment, Boolean(llmAnswer));
    await logAgentRun({
      participantCode: typeof body.participantCode === "string" ? body.participantCode : undefined,
      condition: typeof body.condition === "string" ? body.condition : undefined,
      taskId,
      question,
      scenarioKey: scenario.key,
      variables,
      sources,
      confidence: confidence.score,
      confidenceReason: confidence.reason,
      answer,
      nextAction,
    });

    return Response.json({
      runId: `traceguide-${Date.now()}`,
      answer,
      confidence: confidence.score,
      confidenceReason: confidence.reason,
      sources,
      sourceTags: assessment.sourceTags || sourceTags(scenario, sources.length ? sources : []),
      variables,
      nextAction,
      product: commerceContext.productContext,
      commerceContext: {
        customerId: commerceContext.customer.id,
        orderId: commerceContext.order.id,
        productId: commerceContext.product.id,
        evidenceId: commerceContext.evidence.id,
        evidenceStatus: commerceContext.evidence.status,
        correctDecision: commerceContext.task.correctDecision,
      },
      loadingTitle: scenario.loadingTitle,
      loadingSteps: scenario.loadingSteps,
      agentStages: agentStagesFor(scenario),
      taskType: assessment.taskType || taskTypeFor(scenario, variables),
      actionState: actionStateFor(scenario, assessment),
      actionPreview: actionPreviewFor(scenario, nextAction),
      systemBoundary:
        "Functional research prototype: reads the knowledge base and calls an LLM for the answer; order records and service actions are simulated for safe testing.",
      scenario: scenario.key,
      usedLLM: Boolean(llmAnswer),
    });
  } catch (error) {
    console.error("TraceGuide API error:", error);
    const scenario = scenarios.glass_damaged_refund;
    const sources = buildSources(demoKnowledge.slice(0, 3).map((doc, index) => ({ ...doc, score: 10 - index })));

    return Response.json({
      runId: `traceguide-fallback-${Date.now()}`,
      answer: scenario.answerTemplate(sources),
      confidence: 72,
      sources,
      sourceTags: scenario.sourceTags,
      variables: scenario.variables,
      nextAction: scenario.nextAction,
      product: scenario.product,
      loadingTitle: scenario.loadingTitle,
      loadingSteps: scenario.loadingSteps,
      agentStages: agentStagesFor(scenario),
      taskType: taskTypeFor(scenario),
      actionState: actionStateFor(scenario, {
        nextAction: scenario.nextAction,
        taskType: taskTypeFor(scenario),
      }),
      actionPreview: actionPreviewFor(scenario),
      systemBoundary:
        "Functional research prototype fallback: uses built-in demo knowledge when live retrieval or LLM generation is unavailable.",
      scenario: scenario.key,
      usedLLM: false,
    });
  }
}
