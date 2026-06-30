type RefundActionBody = {
  action?: string;
  product?: string;
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

    if (body.action !== "refund_request") {
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    }

    const requestId = `RF-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-2048`;

    return Response.json({
      requestId,
      status: "draft_started",
      product: body.product || "Glass Lunch Box",
      summary: {
        issue: body.variables?.issueIdentified || "Damaged item",
        request: body.variables?.request || "Return & Refund",
        reason: body.variables?.reason || "Item arrived damaged",
        evidence: body.variables?.evidence || "Photos provided",
        sourcesChecked: body.sources || ["Return and refund policy", "Order status"],
      },
      steps: [
        "Creating refund request",
        "Attaching your uploaded photos",
        "Submitting request to seller",
        "Notifying you of updates",
      ],
      note:
        "This demo prepares a simulated refund request for review. It does not process real payments, refunds or order changes.",
    });
  } catch (error) {
    console.error("TraceGuide action API error:", error);
    return Response.json({ error: "Could not prepare the request." }, { status: 500 });
  }
}
