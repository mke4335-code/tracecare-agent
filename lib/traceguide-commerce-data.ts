export type ProductImage =
  | "glass-box"
  | "cookies"
  | "container-set"
  | "coffee-maker"
  | "protein-bar"
  | "yoghurt"
  | "sandwich"
  | "snack";

export type ProductContext = {
  name: string;
  image: ProductImage;
  detail: string;
  status: string;
  linkLabel: string;
};

export type TraceVariables = {
  issueIdentified: string;
  request: string;
  reason: string;
  evidence: string;
};

export type KnowledgeDocLike = {
  id: string;
  title: string;
  category: string;
  content: string;
  status: string;
};

type Customer = {
  id: string;
  displayName: string;
  segment: "standard" | "plus";
  savedAllergens: string[];
  preferredResolution: "refund" | "replacement" | "human_review";
};

type Product = {
  id: string;
  name: string;
  image: ProductImage;
  detail: string;
  category: "homeware" | "packaged_food" | "chilled_food" | "fresh_food" | "snacks";
  returnClass: "standard" | "perishable_exception" | "food_quality_review";
  priceGbp: number;
  allergens?: string[];
  policyTags: string[];
};

type Order = {
  id: string;
  customerId: string;
  productId: string;
  quantity: number;
  status: "processing" | "out_for_delivery" | "delivered" | "in_transit";
  deliveredDaysAgo: number;
  promisedDeliveryDaysAgo?: number;
  coldChainOk?: boolean;
  includedItems?: string[];
};

type EvidenceRecord = {
  id: string;
  orderId: string;
  status: "not_added" | "photos_provided" | "not_required" | "unclear";
  description: string;
};

type ExperimentTaskRecord = {
  id: string;
  scenarioKey:
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
  customerId: string;
  orderId: string;
  issueType: string;
  requestType: string;
  reason: string;
  defaultEvidenceStatus: EvidenceRecord["status"];
  correctDecision: string;
};

export type CommerceDatabaseRows = {
  task: {
    id: string;
    scenario_key: ExperimentTaskRecord["scenarioKey"];
    customer_id: string;
    order_id: string;
    issue_type: string;
    request_type: string;
    reason: string;
    default_evidence_status: EvidenceRecord["status"];
    correct_decision: string;
  };
  customer: {
    id: string;
    display_name: string;
    segment: Customer["segment"];
    saved_allergens: string[] | null;
    preferred_resolution: Customer["preferredResolution"];
  };
  product: {
    id: string;
    name: string;
    image_key: ProductImage;
    detail: string;
    category: Product["category"];
    return_class: Product["returnClass"];
    price_gbp: number | string;
    allergens: string[] | null;
    policy_tags: string[] | null;
  };
  order: {
    id: string;
    customer_id: string;
    product_id: string;
    quantity: number;
    status: Order["status"];
    delivered_days_ago: number;
    promised_delivery_days_ago: number | null;
    cold_chain_ok: boolean | null;
    included_items: string[] | null;
  };
  evidence: {
    id: string;
    order_id: string;
    status: EvidenceRecord["status"];
    description: string;
  };
};

export type CommerceContext = {
  task: ExperimentTaskRecord;
  customer: Customer;
  product: Product;
  order: Order;
  evidence: EvidenceRecord;
  variables: TraceVariables;
  productContext: ProductContext;
};

export const traceguideCustomers: Customer[] = [
  {
    id: "cust-ke-demo",
    displayName: "Ke Ma",
    segment: "standard",
    savedAllergens: ["peanut"],
    preferredResolution: "refund",
  },
];

export const traceguideProducts: Product[] = [
  {
    id: "prod-glass-lunch-box",
    name: "Glass Lunch Box",
    image: "glass-box",
    detail: "1 item",
    category: "homeware",
    returnClass: "standard",
    priceGbp: 18,
    policyTags: ["damaged_item", "standard_return"],
  },
  {
    id: "prod-glass-food-container",
    name: "Glass Food Container",
    image: "container-set",
    detail: "1 item",
    category: "homeware",
    returnClass: "standard",
    priceGbp: 16,
    policyTags: ["broken_item", "replacement_or_refund"],
  },
  {
    id: "prod-container-set",
    name: "Glass Food Containers Set",
    image: "container-set",
    detail: "4-piece set",
    category: "homeware",
    returnClass: "standard",
    priceGbp: 32,
    policyTags: ["missing_accessory", "late_delivery"],
  },
  {
    id: "prod-milk-cookies",
    name: "Milk Cookies",
    image: "cookies",
    detail: "100g / pack",
    category: "packaged_food",
    returnClass: "food_quality_review",
    priceGbp: 4,
    allergens: ["peanut", "sesame", "egg", "milk"],
    policyTags: ["food_quality", "allergen"],
  },
  {
    id: "prod-coffee-maker",
    name: "Coffee Maker",
    image: "coffee-maker",
    detail: "1 item",
    category: "homeware",
    returnClass: "standard",
    priceGbp: 49,
    policyTags: ["address_change", "pre_dispatch"],
  },
  {
    id: "prod-protein-bar",
    name: "Protein Bar",
    image: "protein-bar",
    detail: "60g / bar",
    category: "packaged_food",
    returnClass: "food_quality_review",
    priceGbp: 3,
    allergens: ["peanut", "milk", "soy"],
    policyTags: ["allergen", "product_safety"],
  },
  {
    id: "prod-chilled-yoghurt",
    name: "Chilled Yoghurt",
    image: "yoghurt",
    detail: "4 x 125g",
    category: "chilled_food",
    returnClass: "perishable_exception",
    priceGbp: 5,
    allergens: ["milk"],
    policyTags: ["perishable_exception", "cold_chain"],
  },
  {
    id: "prod-fresh-sandwich",
    name: "Fresh Sandwich",
    image: "sandwich",
    detail: "1 pack",
    category: "fresh_food",
    returnClass: "perishable_exception",
    priceGbp: 4,
    allergens: ["wheat", "egg"],
    policyTags: ["perishable_exception", "fresh_food"],
  },
  {
    id: "prod-snack-pack",
    name: "Snack Pack",
    image: "snack",
    detail: "6-pack",
    category: "snacks",
    returnClass: "food_quality_review",
    priceGbp: 7,
    policyTags: ["damaged_package", "evidence_required"],
  },
];

export const traceguideOrders: Order[] = [
  {
    id: "TC-2048",
    customerId: "cust-ke-demo",
    productId: "prod-glass-lunch-box",
    quantity: 1,
    status: "delivered",
    deliveredDaysAgo: 2,
  },
  {
    id: "TC-2091",
    customerId: "cust-ke-demo",
    productId: "prod-chilled-yoghurt",
    quantity: 1,
    status: "delivered",
    deliveredDaysAgo: 0,
    coldChainOk: true,
  },
  {
    id: "TC-2104",
    customerId: "cust-ke-demo",
    productId: "prod-milk-cookies",
    quantity: 1,
    status: "delivered",
    deliveredDaysAgo: 2,
  },
  {
    id: "TC-2152",
    customerId: "cust-ke-demo",
    productId: "prod-coffee-maker",
    quantity: 1,
    status: "processing",
    deliveredDaysAgo: 0,
  },
  {
    id: "TC-2166",
    customerId: "cust-ke-demo",
    productId: "prod-protein-bar",
    quantity: 1,
    status: "delivered",
    deliveredDaysAgo: 1,
  },
  {
    id: "TC-2118",
    customerId: "cust-ke-demo",
    productId: "prod-glass-food-container",
    quantity: 1,
    status: "delivered",
    deliveredDaysAgo: 1,
    includedItems: ["glass base", "locking lid"],
  },
  {
    id: "TC-2122",
    customerId: "cust-ke-demo",
    productId: "prod-fresh-sandwich",
    quantity: 1,
    status: "out_for_delivery",
    deliveredDaysAgo: 0,
  },
  {
    id: "TC-2136",
    customerId: "cust-ke-demo",
    productId: "prod-snack-pack",
    quantity: 1,
    status: "delivered",
    deliveredDaysAgo: 1,
  },
  {
    id: "TC-2140",
    customerId: "cust-ke-demo",
    productId: "prod-container-set",
    quantity: 1,
    status: "delivered",
    deliveredDaysAgo: 0,
    promisedDeliveryDaysAgo: 2,
    includedItems: ["4 containers", "4 matching lids"],
  },
];

export const traceguideEvidenceRecords: EvidenceRecord[] = [
  {
    id: "ev-glass-damaged",
    orderId: "TC-2048",
    status: "photos_provided",
    description: "Customer can provide photos of the damaged glass lunch box and packaging.",
  },
  {
    id: "ev-yoghurt-change-mind",
    orderId: "TC-2091",
    status: "not_required",
    description: "No quality issue has been reported for the chilled yoghurt.",
  },
  {
    id: "ev-cookies-no-photo",
    orderId: "TC-2104",
    status: "not_added",
    description: "Customer reported damage, but no photo evidence has been added yet.",
  },
  {
    id: "ev-coffee-address",
    orderId: "TC-2152",
    status: "not_required",
    description: "Address change can be prepared because the order has not been dispatched.",
  },
  {
    id: "ev-protein-allergen",
    orderId: "TC-2166",
    status: "not_required",
    description: "Product ingredient and allergen records are available for safety advice.",
  },
  {
    id: "ev-container-lid",
    orderId: "TC-2118",
    status: "photos_provided",
    description: "Customer can provide photos showing the broken lid on arrival.",
  },
  {
    id: "ev-sandwich-change-mind",
    orderId: "TC-2122",
    status: "not_required",
    description: "No quality, temperature, or incorrect-delivery issue has been reported.",
  },
  {
    id: "ev-snack-unclear",
    orderId: "TC-2136",
    status: "not_added",
    description: "Package damage has been reported, but photo evidence is not yet attached.",
  },
  {
    id: "ev-container-set-missing",
    orderId: "TC-2140",
    status: "unclear",
    description: "Accessory/package contents need confirmation before support action.",
  },
];

export const traceguideExperimentTasks: ExperimentTaskRecord[] = [
  {
    id: "S1-T1",
    scenarioKey: "allergen_safety",
    customerId: "cust-ke-demo",
    orderId: "TC-2104",
    issueType: "Allergen concern",
    requestType: "Product safety advice",
    reason: "Customer is allergic to peanuts",
    defaultEvidenceStatus: "not_required",
    correctDecision: "Do not eat the product; use ingredient and allergen evidence, or contact human support if unsure.",
  },
  {
    id: "S1-T2",
    scenarioKey: "coffee_maker_address_change",
    customerId: "cust-ke-demo",
    orderId: "TC-2152",
    issueType: "Delivery address change",
    requestType: "Change delivery address",
    reason: "Order has not been dispatched",
    defaultEvidenceStatus: "not_required",
    correctDecision: "Can prepare an address change request because the order has not been dispatched; user confirmation is required before submission.",
  },
  {
    id: "S1-T3",
    scenarioKey: "glass_damaged_refund",
    customerId: "cust-ke-demo",
    orderId: "TC-2048",
    issueType: "Damaged item",
    requestType: "Return & Refund",
    reason: "Item arrived damaged",
    defaultEvidenceStatus: "photos_provided",
    correctDecision: "Can prepare a refund request after confirmation.",
  },
  {
    id: "S2-T1",
    scenarioKey: "protein_bar_allergen_safety",
    customerId: "cust-ke-demo",
    orderId: "TC-2166",
    issueType: "Allergen concern",
    requestType: "Product safety advice",
    reason: "Customer is allergic to peanuts",
    defaultEvidenceStatus: "not_required",
    correctDecision: "Do not eat the product; the product allergen record includes peanut risk, so user should not rely on a generic reassurance.",
  },
  {
    id: "S2-T2",
    scenarioKey: "fresh_sandwich_address_change",
    customerId: "cust-ke-demo",
    orderId: "TC-2122",
    issueType: "Delivery address change",
    requestType: "Change delivery address",
    reason: "Order is already out for delivery",
    defaultEvidenceStatus: "not_required",
    correctDecision: "Do not authorise a normal address change because the order is already out for delivery; send to human support if needed.",
  },
  {
    id: "S2-T3",
    scenarioKey: "snack_package_evidence_unclear",
    customerId: "cust-ke-demo",
    orderId: "TC-2136",
    issueType: "Damaged package",
    requestType: "Return & Refund",
    reason: "Package damage reported",
    defaultEvidenceStatus: "not_added",
    correctDecision: "Ask for photo evidence or human review before refund request.",
  },
];

export function getCommerceContext(
  scenarioKey: ExperimentTaskRecord["scenarioKey"],
  taskId?: string,
  editedVariables?: TraceVariables
): CommerceContext {
  const task =
    (taskId && traceguideExperimentTasks.find((item) => item.id.toLowerCase() === taskId.toLowerCase())) ||
    traceguideExperimentTasks.find((item) => item.scenarioKey === scenarioKey) ||
    traceguideExperimentTasks[0];
  const order = traceguideOrders.find((item) => item.id === task.orderId) || traceguideOrders[0];
  const product = traceguideProducts.find((item) => item.id === order.productId) || traceguideProducts[0];
  const customer = traceguideCustomers.find((item) => item.id === task.customerId) || traceguideCustomers[0];
  const defaultEvidence =
    traceguideEvidenceRecords.find((item) => item.orderId === order.id && item.status === task.defaultEvidenceStatus) ||
    traceguideEvidenceRecords.find((item) => item.orderId === order.id) ||
    traceguideEvidenceRecords[0];

  const variables = {
    issueIdentified: editedVariables?.issueIdentified || task.issueType,
    request: editedVariables?.request || task.requestType,
    reason: editedVariables?.reason || task.reason,
    evidence: editedVariables?.evidence || evidenceStatusLabel(defaultEvidence.status),
  };

  const evidence: EvidenceRecord = {
    ...defaultEvidence,
    status: evidenceStatusFromVariable(variables.evidence, defaultEvidence.status),
    description: evidenceDescriptionFromVariable(variables.evidence, defaultEvidence.description),
  };

  return {
    task,
    customer,
    product,
    order,
    evidence,
    variables,
    productContext: {
      name: product.name,
      image: product.image,
      detail: product.detail,
      status: orderStatusLabel(order, product),
      linkLabel: product.category.includes("food") ? "Product details" : "Order details",
    },
  };
}

export function commerceContextFromDatabaseRows(
  rows: CommerceDatabaseRows,
  editedVariables?: TraceVariables
): CommerceContext {
  const task: ExperimentTaskRecord = {
    id: rows.task.id,
    scenarioKey: rows.task.scenario_key,
    customerId: rows.task.customer_id,
    orderId: rows.task.order_id,
    issueType: rows.task.issue_type,
    requestType: rows.task.request_type,
    reason: rows.task.reason,
    defaultEvidenceStatus: rows.task.default_evidence_status,
    correctDecision: rows.task.correct_decision,
  };

  const customer: Customer = {
    id: rows.customer.id,
    displayName: rows.customer.display_name,
    segment: rows.customer.segment,
    savedAllergens: rows.customer.saved_allergens || [],
    preferredResolution: rows.customer.preferred_resolution,
  };

  const product: Product = {
    id: rows.product.id,
    name: rows.product.name,
    image: rows.product.image_key,
    detail: rows.product.detail,
    category: rows.product.category,
    returnClass: rows.product.return_class,
    priceGbp: Number(rows.product.price_gbp),
    allergens: rows.product.allergens || [],
    policyTags: rows.product.policy_tags || [],
  };

  const order: Order = {
    id: rows.order.id,
    customerId: rows.order.customer_id,
    productId: rows.order.product_id,
    quantity: rows.order.quantity,
    status: rows.order.status,
    deliveredDaysAgo: rows.order.delivered_days_ago,
    promisedDeliveryDaysAgo: rows.order.promised_delivery_days_ago || undefined,
    coldChainOk: rows.order.cold_chain_ok ?? undefined,
    includedItems: rows.order.included_items || [],
  };

  const defaultEvidence: EvidenceRecord = {
    id: rows.evidence.id,
    orderId: rows.evidence.order_id,
    status: rows.evidence.status,
    description: rows.evidence.description,
  };

  const variables = {
    issueIdentified: editedVariables?.issueIdentified || task.issueType,
    request: editedVariables?.request || task.requestType,
    reason: editedVariables?.reason || task.reason,
    evidence: editedVariables?.evidence || evidenceStatusLabel(defaultEvidence.status),
  };

  const evidence: EvidenceRecord = {
    ...defaultEvidence,
    status: evidenceStatusFromVariable(variables.evidence, defaultEvidence.status),
    description: evidenceDescriptionFromVariable(variables.evidence, defaultEvidence.description),
  };

  return {
    task,
    customer,
    product,
    order,
    evidence,
    variables,
    productContext: {
      name: product.name,
      image: product.image,
      detail: product.detail,
      status: orderStatusLabel(order, product),
      linkLabel: product.category.includes("food") ? "Product details" : "Order details",
    },
  };
}

export function commerceContextToKnowledgeDocs(context: CommerceContext): KnowledgeDocLike[] {
  const { customer, product, order, evidence, task } = context;
  const deliveryText = order.deliveredDaysAgo === 0 ? "delivered today" : `delivered ${order.deliveredDaysAgo} day${order.deliveredDaysAgo === 1 ? "" : "s"} ago`;

  return [
    {
      id: `ctx-order-${order.id}`,
      title: `Order record — ${product.name}`,
      category: "Order status",
      status: "active",
      content: `Order ${order.id} for ${product.name} was ${deliveryText}. Quantity: ${order.quantity}. Current status: ${order.status}. Reported issue: ${task.issueType}. Evidence status: ${evidenceStatusLabel(evidence.status)}.`,
    },
    {
      id: `ctx-product-${product.id}`,
      title: `Product record — ${product.name}`,
      category: "Product details",
      status: "active",
      content: `${product.name} is a ${product.category.replaceAll("_", " ")} item. Product detail: ${product.detail}. Return class: ${product.returnClass.replaceAll("_", " ")}. Price: £${product.priceGbp}. ${product.allergens?.length ? `Allergen data: ${product.allergens.join(", ")}.` : "No saved allergen warning for this item."} Policy tags: ${product.policyTags.join(", ")}.`,
    },
    {
      id: `ctx-evidence-${evidence.id}`,
      title: `Evidence record — ${product.name}`,
      category: "Evidence",
      status: "active",
      content: `${evidence.description} Current evidence state: ${evidenceStatusLabel(evidence.status)}. This state affects whether the agent should prepare a request, ask for photos, or hand off to human support.`,
    },
    {
      id: `ctx-customer-${customer.id}`,
      title: `Customer context — ${customer.displayName}`,
      category: "Customer context",
      status: "active",
      content: `Customer segment: ${customer.segment}. Saved allergens: ${customer.savedAllergens.length ? customer.savedAllergens.join(", ") : "none"}. Preferred resolution: ${customer.preferredResolution}. Customer context can support personalisation, but policy and order records remain the source of truth.`,
    },
  ];
}

function orderStatusLabel(order: Order, product: Product) {
  if (order.status === "processing") return "Not dispatched yet";
  if (order.status === "out_for_delivery") return "Out for delivery";
  if (order.status === "in_transit") return "In transit";

  if (product.category === "chilled_food" || product.category === "fresh_food") {
    return order.deliveredDaysAgo === 0 ? "Delivered today" : `Delivered ${order.deliveredDaysAgo} days ago`;
  }

  if (order.promisedDeliveryDaysAgo && order.promisedDeliveryDaysAgo > order.deliveredDaysAgo) {
    return `Arrived ${order.promisedDeliveryDaysAgo - order.deliveredDaysAgo} days late`;
  }

  return order.deliveredDaysAgo === 0 ? "Delivered today" : `Delivered ${order.deliveredDaysAgo} day${order.deliveredDaysAgo === 1 ? "" : "s"} ago`;
}

function evidenceStatusLabel(status: EvidenceRecord["status"]) {
  if (status === "photos_provided") return "Photos provided";
  if (status === "not_required") return "No quality issue reported";
  if (status === "unclear") return "Evidence unclear";
  return "Photo not added";
}

function evidenceStatusFromVariable(value: string, fallback: EvidenceRecord["status"]) {
  const normalised = value.toLowerCase();
  if (normalised.includes("photos provided") || normalised.includes("photo provided")) return "photos_provided";
  if (normalised.includes("no quality issue")) return "not_required";
  if (normalised.includes("unclear") || normalised.includes("not sure")) return "unclear";
  if (normalised.includes("not added") || normalised.includes("needed")) return "not_added";
  return fallback;
}

function evidenceDescriptionFromVariable(value: string, fallback: string) {
  const status = evidenceStatusFromVariable(value, "unclear");
  if (status === "photos_provided") return "Customer has provided photo evidence for the reported issue.";
  if (status === "not_added") return "Photo evidence has not been added yet.";
  if (status === "not_required") return "No quality issue evidence is required because no quality issue has been reported.";
  return fallback;
}
