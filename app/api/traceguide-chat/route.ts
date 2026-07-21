import { NextRequest, NextResponse } from "next/server";

import { orchestrateDamagedItemCase } from "@/lib/traceguide-agent-orchestrator";
import { getCommerceContext } from "@/lib/traceguide-commerce-data";
import { getCommerceContextFromDatabase } from "@/lib/traceguide-commerce-repository";
import {
  caseStageForEligibility,
  eligibilityForCommerceContext,
  getActiveDamagedItemPolicy,
  recordServiceCaseToolEvents,
  startServiceCase,
  updateServiceCaseAssessment,
  type ServiceCaseRuntime,
} from "@/lib/traceguide-case-runtime";
import {
  attachTraceGuideCaseSession,
  readTraceGuideCaseSession,
} from "@/lib/traceguide-case-session";
import { searchDamagedItemPolicy, type PolicySearchResult } from "@/lib/traceguide-policy-retrieval";
import { resolveTraceguideStudyTask, traceguideStudyTasks } from "@/lib/traceguide-study-config";
import { supabase } from "@/lib/supabase";
import type { EligibilityDecision } from "@/lib/traceguide-eligibility";

type BuyerSource = {
  id: string;
  number: number;
  title: string;
  category: string;
  sourceType: "policy" | "order_record" | "product_record" | "customer_detail" | "evidence_record";
  excerpt: string;
  relevance: "High relevance" | "Relevant";
  matchedAnswer?: string;
  sourceUri?: string | null;
  policyVersion?: number;
};

type ActionState = {
  kind: "ready" | "needs_evidence" | "needs_human_review" | "informational";
  label: string;
  prompt: string;
  primaryAction: string;
  secondaryAction: string;
  canStartRequest: boolean;
};

function policySource(result: PolicySearchResult, number: number): BuyerSource {
  return {
    id: result.chunkId,
    number,
    title: `${result.title} — ${result.heading}`,
    category: "Policy source",
    sourceType: "policy",
    excerpt: result.content,
    relevance: "High relevance",
    sourceUri: result.sourceUri,
    policyVersion: result.policyVersion,
  };
}

function policyMatch(
  results: PolicySearchResult[],
  pattern: RegExp,
  fallbackIndex = 0
) {
  return results.find((result) => pattern.test(`${result.heading} ${result.content}`))
    || results[fallbackIndex];
}

function sourcesFor(
  policyResults: PolicySearchResult[],
  context: Awaited<ReturnType<typeof getCommerceContextFromDatabase>> extends infer T
    ? Exclude<T, null>
    : never,
  eligibility: EligibilityDecision
) {
  const primaryPolicy = eligibility.outcome === "needs_evidence"
    ? policyMatch(policyResults, /supporting evidence|photo/i)
    : policyMatch(policyResults, /eligibility window|30 days/i);
  const approvalPolicy = policyMatch(policyResults, /buyer approval|confirm/i, 1);
  if (!primaryPolicy) throw new Error("No policy source supports this answer.");

  const policySources = [primaryPolicy];
  if (approvalPolicy && approvalPolicy.chunkId !== primaryPolicy.chunkId) {
    policySources.push(approvalPolicy);
  }
  const sources: BuyerSource[] = policySources.map((result, index) => policySource(result, index + 1));
  sources.push({
    id: `order-${context.order.id}`,
    number: sources.length + 1,
    title: `Order ${context.order.id}`,
    category: "Order record",
    sourceType: "order_record",
    excerpt: `${context.product.name} was delivered ${context.order.deliveredDaysAgo === 0 ? "today" : `${context.order.deliveredDaysAgo} day${context.order.deliveredDaysAgo === 1 ? "" : "s"} ago`}. The recorded order status is ${context.order.status}.`,
    relevance: "High relevance",
  });
  sources.push({
    id: `evidence-${context.evidence.id}`,
    number: sources.length + 1,
    title: "Damage evidence for this case",
    category: "Evidence record",
    sourceType: "evidence_record",
    excerpt: context.evidence.description,
    relevance: "High relevance",
  });
  return sources;
}

function citationFor(sources: BuyerSource[], sourceType: BuyerSource["sourceType"], titlePattern?: RegExp) {
  return sources.find((source) =>
    source.sourceType === sourceType && (!titlePattern || titlePattern.test(source.title))
  )?.number || 1;
}

function buyerAnswer(
  eligibility: EligibilityDecision,
  sources: BuyerSource[],
  productName: string,
  requestedResolution: string
) {
  const policy = citationFor(sources, "policy");
  const order = citationFor(sources, "order_record");
  const evidence = citationFor(sources, "evidence_record");

  if (eligibility.outcome === "eligible") {
    const resolution = requestedResolution.toLowerCase() === "replacement" ? "replacement" : "refund";
    return `This ${productName} can move to a damaged-item service request.\n\nThe order is inside the damaged-item window under the returns policy [${policy}], and the order record confirms it has been delivered [${order}]. A damage photo is attached to this case [${evidence}]. I can prepare a ${resolution} request for you to review before it is created.`;
  }
  if (eligibility.outcome === "needs_evidence") {
    return `A damage photo is needed before I can prepare the request.\n\nThe damaged-item policy requires a clear photo of the item and packaging before a service request is prepared [${policy}]. The order is recorded as delivered [${order}], but this case does not currently have a damage photo [${evidence}]. You can add one now or ask human support to review the case.`;
  }
  if (eligibility.outcome === "ineligible") {
    return `I cannot prepare a standard damaged-item request for this order.\n\nThe damaged-item policy has a 30-day standard window [${policy}], while the order record shows this item was delivered 45 days ago [${order}]. You can stop here or ask human support to review the circumstances.`;
  }
  return `This case needs human review before any request is prepared.\n\nThe order or case information does not support an automated damaged-item decision [${order}]. I can send the checked context to human support.`;
}

function actionStateFor(eligibility: EligibilityDecision): ActionState {
  if (eligibility.outcome === "eligible") {
    return {
      kind: "ready",
      label: "Ready for your choice",
      prompt: "Would you like me to prepare a damaged-item service request?",
      primaryAction: "Review request",
      secondaryAction: "Not now",
      canStartRequest: true,
    };
  }
  if (eligibility.outcome === "needs_evidence") {
    return {
      kind: "needs_evidence",
      label: "More information needed",
      prompt: "Would you like to add a damage photo now?",
      primaryAction: "Add photo",
      secondaryAction: "Human support",
      canStartRequest: false,
    };
  }
  return {
    kind: "needs_human_review",
    label: "Human review needed",
    prompt: "Would you like me to send this checked case to human support?",
    primaryAction: "Human support",
    secondaryAction: "Not now",
    canStartRequest: false,
  };
}

async function logRun(input: {
  caseId: string | null;
  participantCode?: string;
  condition?: string;
  taskId: string;
  question: string;
  variables: Record<string, unknown>;
  sources: BuyerSource[];
  answer: string;
  nextAction: string;
}) {
  const { error } = await supabase.from("traceguide_agent_runs").insert({
    case_id: input.caseId,
    participant_code: input.participantCode || null,
    condition: input.condition || null,
    task_id: input.taskId,
    question: input.question,
    detected_scenario: "damaged_item_resolution",
    variables: input.variables,
    sources: input.sources,
    confidence: null,
    confidence_reason: null,
    answer: input.answer,
    next_action: input.nextAction,
  });
  if (error) console.warn("TraceGuide run log could not be persisted.", error);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

    const task = resolveTraceguideStudyTask(question, typeof body.taskId === "string" ? body.taskId : undefined);
    if (!task) {
      return NextResponse.json(
        {
          error:
            "I could not identify one of the damaged-item study orders. Choose a study task or name the item in your order.",
        },
        { status: 422 }
      );
    }
    const session = readTraceGuideCaseSession(request);
    const requestedCaseId = typeof body.caseId === "string" ? body.caseId : null;
    const existingSession = session && (!requestedCaseId || requestedCaseId === session.caseId)
      ? session
      : null;

    let context = await getCommerceContextFromDatabase({
      taskId: task.id,
      caseId: existingSession?.caseId,
      caseToken: existingSession?.caseToken,
      editedVariables: typeof body.variables === "object" && body.variables
        ? body.variables as never
        : undefined,
    });
    if (!context && process.env.NODE_ENV === "test") {
      const fixtureTask = traceguideStudyTasks.find((item) => item.id === task.id)!;
      const scenarioByTask = {
        "S1-T1": "glass_damaged_refund",
        "S1-T2": "container_set_damaged_no_photo",
        "S1-T3": "snack_damaged_outside_window",
        "S2-T1": "glass_container_broken",
        "S2-T2": "coffee_maker_damaged_no_photo",
        "S2-T3": "cookies_damaged_outside_window",
      } as const;
      context = getCommerceContext(scenarioByTask[fixtureTask.id], fixtureTask.id);
    }
    if (!context) {
      return NextResponse.json(
        { error: "Order data is temporarily unavailable. No service decision was made." },
        { status: 503 }
      );
    }

    const policy = await getActiveDamagedItemPolicy();
    if (policy.source !== "database" || !policy.id) {
      return NextResponse.json(
        { error: "The active returns policy is unavailable. No service decision was made." },
        { status: 503 }
      );
    }

    let runtime: ServiceCaseRuntime | null = existingSession
      ? {
          caseId: existingSession.caseId,
          caseToken: existingSession.caseToken,
          status: "open",
          currentStage: "understanding_request",
          orderId: context.order.id,
          policyVersionId: policy.id,
        }
      : await startServiceCase({
          taskId: task.id,
          participantCode: typeof body.participantCode === "string" ? body.participantCode : undefined,
          condition: body.condition === "baseline" || body.condition === "traceguide" ? body.condition : undefined,
          goal: question,
        });
    if (!runtime) {
      return NextResponse.json(
        { error: "A service case could not be created. No action was taken." },
        { status: 503 }
      );
    }

    if (!existingSession) {
      context = await getCommerceContextFromDatabase({
        taskId: task.id,
        caseId: runtime.caseId,
        caseToken: runtime.caseToken,
        editedVariables: typeof body.variables === "object" && body.variables
          ? body.variables as never
          : undefined,
      }) || context;
    }

    const eligibility = eligibilityForCommerceContext(context, policy.rules);
    if (!eligibility) {
      return NextResponse.json(
        { error: "This prototype currently supports damaged-item resolution only." },
        { status: 422 }
      );
    }

    const retrieval = await searchDamagedItemPolicy(question, 4);
    if (!retrieval.results.length) {
      return NextResponse.json(
        { error: "No applicable policy source was found. The case should be reviewed by human support." },
        { status: 503 }
      );
    }

    const sources = sourcesFor(retrieval.results, context, eligibility);
    const answer = buyerAnswer(
      eligibility,
      sources,
      context.product.name,
      context.variables.request
    );
    const actionState = actionStateFor(eligibility);
    const nextAction = eligibility.outcome === "eligible"
      ? "prepare a damaged-item service request"
      : eligibility.outcome === "needs_evidence"
        ? "add damage photos"
        : "send this case to human support";
    const agentRuntime = orchestrateDamagedItemCase({ goal: question, context, policy: policy.rules });

    runtime = await updateServiceCaseAssessment({
      runtime,
      variables: context.variables,
      eligibility,
      stage: caseStageForEligibility(eligibility),
    }) || runtime;
    await recordServiceCaseToolEvents({ runtime, events: agentRuntime.toolEvents });
    await logRun({
      caseId: runtime.caseId,
      participantCode: typeof body.participantCode === "string" ? body.participantCode : undefined,
      condition: body.condition === "baseline" || body.condition === "traceguide" ? body.condition : undefined,
      taskId: task.id,
      question,
      variables: context.variables,
      sources,
      answer,
      nextAction,
    });

    const response = NextResponse.json({
      runId: `traceguide-${runtime.caseId}`,
      answer,
      sources,
      sourceTags: ["Policy source", "Order record", "Evidence record"],
      variables: context.variables,
      nextAction,
      decisionState: eligibility.outcome === "eligible"
        ? "ready_for_choice"
        : eligibility.outcome === "needs_evidence"
          ? "needs_information"
          : "needs_human_review",
      product: context.productContext,
      commerceContext: {
        customerId: context.customer.id,
        orderId: context.order.id,
        productId: context.product.id,
        evidenceId: context.evidence.id,
        evidenceStatus: context.evidence.status,
      },
      loadingTitle: "Checking your damaged-item request...",
      loadingSteps: agentRuntime.publicProgress.map((item) => item.label),
      toolEvents: agentRuntime.toolEvents.map((event) => ({
        label: event.publicLabel,
        status: event.status,
      })),
      actionState,
      actionPreview: {
        orderId: context.order.id,
        product: context.product.name,
        issue: context.variables.reason,
        requestedResolution: context.variables.request,
        evidenceStatus: context.evidence.status,
        boundary: "This creates a simulated service request for research. It does not issue a real refund or change an order.",
      },
      caseRuntime: {
        caseId: runtime.caseId,
        status: runtime.status,
        currentStage: runtime.currentStage,
        orderId: runtime.orderId,
        policyVersionId: runtime.policyVersionId,
      },
      eligibility,
      policyRuntime: { id: policy.id, retrievalMode: retrieval.mode },
      systemBoundary: "Functional research prototype using persisted order, case, evidence and policy records. Service requests are simulated and persistently recorded.",
      scenario: "damaged_item_resolution",
      usedLLM: false,
    });
    return attachTraceGuideCaseSession(response, {
      caseId: runtime.caseId,
      caseToken: runtime.caseToken,
    });
  } catch (error) {
    console.error("TraceGuide damaged-item procedure failed.", error);
    return NextResponse.json(
      { error: "The service checks could not be completed. No answer or service action was created." },
      { status: 503 }
    );
  }
}
