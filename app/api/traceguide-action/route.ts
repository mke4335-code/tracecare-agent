type RefundActionBody = {
  action?: string;
  product?: string;
  nextAction?: string;
  variables?: {
    issueIdentified?: string;
    request?: string;
    reason?: string;
    evidence?: string;
  };
  sources?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RefundActionBody;

    if (body.action !== "refund_request" && body.action !== "agent_request") {
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    }

    const serviceRequest = body.variables?.request || "Return & Refund";
    const prefix = serviceRequest.toLowerCase().includes("compensation")
      ? "CP"
      : serviceRequest.toLowerCase().includes("safety") || body.nextAction?.toLowerCase().includes("human")
        ? "HS"
        : "RF";
    const requestId = `${prefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-2048`;
    const steps = serviceRequest.toLowerCase().includes("compensation")
      ? [
          "Creating compensation request",
          "Checking delivery timeline",
          "Sending request to seller",
          "Notifying you of updates",
        ]
      : serviceRequest.toLowerCase().includes("safety") || body.nextAction?.toLowerCase().includes("human")
        ? [
            "Preparing support summary",
            "Attaching product safety sources",
            "Sending to human support",
            "Notifying you of updates",
          ]
        : [
            "Creating refund request",
            "Adding evidence details",
            "Submitting request to seller",
            "Notifying you of updates",
          ];

    return Response.json({
      requestId,
      status: "draft_started",
      product: body.product || "Glass Lunch Box",
      summary: {
        issue: body.variables?.issueIdentified || "Damaged item",
        request: body.variables?.request || "Return & Refund",
        reason: body.variables?.reason || "Item arrived damaged",
        evidence: body.variables?.evidence || "Photos needed",
        sourcesChecked: body.sources || ["Return and refund policy", "Order status"],
      },
      steps,
      note:
        "This demo prepares a simulated service request for review. It does not process real payments, refunds or order changes.",
    });
  } catch (error) {
    console.error("TraceGuide action API error:", error);
    return Response.json({ error: "Could not prepare the request." }, { status: 500 });
  }
}
