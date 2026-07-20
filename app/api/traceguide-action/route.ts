import {
  createServiceHandoff,
  getServiceCase,
  prepareAndApproveServiceAction,
} from "../../../lib/traceguide-case-runtime";
import { readTraceGuideCaseSession } from "../../../lib/traceguide-case-session";
import { NextRequest } from "next/server";

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
  caseId?: string;
  idempotencyKey?: string;
};

function normaliseResolution(value?: string) {
  const lower = value?.trim().toLowerCase();
  if (lower === "refund" || lower === "return & refund" || lower === "return and refund") {
    return { label: "Refund", actionType: "return_and_refund" as const };
  }
  if (lower === "replacement") {
    return { label: "Replacement", actionType: "replacement" as const };
  }
  if (lower === "human support") {
    return { label: "Human support", actionType: "human_handoff" as const };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RefundActionBody;

    if (body.action !== "refund_request" && body.action !== "agent_request") {
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    }

    const session = readTraceGuideCaseSession(request);
    if (!body.caseId || session?.caseId !== body.caseId) {
      return Response.json({ error: "The service case session has expired. No request was created." }, { status: 401 });
    }

    const selectedResolution = normaliseResolution(body.variables?.request);
    if (!selectedResolution) {
      return Response.json(
        { error: "Choose Refund, Replacement or Human support before confirming." },
        { status: 400 }
      );
    }
    const serviceRequest = selectedResolution.label;
    const actionType = selectedResolution.actionType;
    const serviceCase = await getServiceCase({
      caseId: body.caseId,
      caseToken: session.caseToken,
    });
    if (!serviceCase) {
      return Response.json({ error: "Service case not found." }, { status: 404 });
    }
    if (
      actionType !== "human_handoff" &&
      serviceCase.currentStage !== "waiting_for_approval" &&
      serviceCase.status !== "submitted"
    ) {
      return Response.json(
        {
          error:
            serviceCase.currentStage === "collecting_evidence"
              ? "Add the required evidence before preparing this request."
              : "This request is not ready for buyer approval.",
        },
        { status: 409 }
      );
    }
    const steps = actionType === "human_handoff"
      ? ["Human-support handoff recorded"]
      : ["Damaged-item service request recorded"];

    let persistedResult: Record<string, unknown> | null = null;
    if (body.caseId) {
      const summary = {
        product: body.product || "Glass Lunch Box",
        issue: body.variables?.issueIdentified || "Damaged item",
        request: serviceRequest,
        reason: body.variables?.reason || "Item arrived damaged",
        evidence: body.variables?.evidence || "Photos needed",
        sourcesChecked: body.sources || ["Return and refund policy", "Order status"],
      };

      persistedResult =
        actionType === "human_handoff"
          ? await createServiceHandoff({
              caseId: body.caseId,
              caseToken: session.caseToken,
              reasonCode: "BUYER_REQUESTED_HUMAN_REVIEW",
              summary,
            })
          : await prepareAndApproveServiceAction({
              caseId: body.caseId,
              caseToken: session.caseToken,
              actionType,
              preview: summary,
              idempotencyKey:
                body.idempotencyKey || `${body.caseId}:${actionType}:buyer-approved-v1`,
            });
    }

    if (!persistedResult || typeof persistedResult.requestId !== "string") {
      throw new Error("The service request was not persisted.");
    }
    const persistedRequestId = persistedResult.requestId;

    const runtimeStatus =
      persistedResult && typeof persistedResult.status === "string"
        ? persistedResult.status
        : "prepared";

    return Response.json({
      requestId: persistedRequestId,
      caseId: body.caseId || null,
      persisted: Boolean(persistedResult),
      runtimeResult: persistedResult,
      status: runtimeStatus,
      product: body.product || "Glass Lunch Box",
      summary: {
        issue: body.variables?.issueIdentified || "Damaged item",
        request: serviceRequest,
        reason: body.variables?.reason || "Item arrived damaged",
        evidence: body.variables?.evidence || "Photos needed",
        sourcesChecked: body.sources || ["Return and refund policy", "Order status"],
      },
      steps,
      note:
        "This research product records a simulated service request and its state transitions. It does not process real payments, refunds or order changes.",
    });
  } catch (error) {
    console.error("TraceGuide action API error:", error);
    return Response.json({ error: "Could not prepare the request." }, { status: 500 });
  }
}
