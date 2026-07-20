import { NextRequest, NextResponse } from "next/server";

import { startServiceCase } from "@/lib/traceguide-case-runtime";
import {
  attachTraceGuideCaseSession,
  readTraceGuideCaseSession,
} from "@/lib/traceguide-case-session";
import { resolveTraceguideStudyTask } from "@/lib/traceguide-study-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

    const requestedCaseId = typeof body.caseId === "string" ? body.caseId : null;
    const session = readTraceGuideCaseSession(request);
    if (requestedCaseId && session?.caseId === requestedCaseId) {
      return NextResponse.json({ caseId: session.caseId, resumed: true });
    }

    const task = resolveTraceguideStudyTask(
      question,
      typeof body.taskId === "string" ? body.taskId : undefined
    );
    if (!task) {
      return NextResponse.json(
        {
          error:
            "I could not identify one of the damaged-item study orders. Choose a study task or name the item in your order.",
        },
        { status: 422 }
      );
    }
    const runtime = await startServiceCase({
      taskId: task.id,
      participantCode: typeof body.participantCode === "string" ? body.participantCode : undefined,
      condition: body.condition === "baseline" || body.condition === "traceguide"
        ? body.condition
        : undefined,
      goal: question,
    });
    if (!runtime) {
      return NextResponse.json(
        { error: "A service case could not be created. No decision was made." },
        { status: 503 }
      );
    }

    const response = NextResponse.json({
      caseId: runtime.caseId,
      taskId: task.id,
      resumed: false,
    });
    return attachTraceGuideCaseSession(response, {
      caseId: runtime.caseId,
      caseToken: runtime.caseToken,
    });
  } catch (error) {
    console.error("TraceGuide case start failed.", error);
    return NextResponse.json(
      { error: "The service case could not be started." },
      { status: 503 }
    );
  }
}
