import { NextRequest } from "next/server";

import { POST as runProcedure } from "../traceguide-chat/route";
import { readTraceGuideCaseSession } from "@/lib/traceguide-case-session";

const encoder = new TextEncoder();

function event(type: string, payload: Record<string, unknown>) {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const session = readTraceGuideCaseSession(request);
  if (!caseId || session?.caseId !== caseId) {
    return Response.json(
      { error: "The service case session has expired. No decision was made." },
      { status: 401 }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(event("progress", {
          id: `${caseId}:understood`,
          label: "Understanding your request",
          status: "done",
        }));
        controller.enqueue(event("progress", {
          id: `${caseId}:service-checks`,
          label: "Checking your order, evidence and returns policy",
          status: "in_progress",
        }));

        const forwarded = new NextRequest(new URL("/api/traceguide-chat", request.url), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({ ...body, caseId }),
        });
        const response = await runProcedure(forwarded);
        const result = await response.json() as Record<string, unknown>;
        if (!response.ok) {
          controller.enqueue(event("error", {
            message: typeof result.error === "string"
              ? result.error
              : "The service checks could not be completed.",
          }));
          return;
        }

        controller.enqueue(event("progress", {
          id: `${caseId}:service-checks`,
          label: "Checking your order, evidence and returns policy",
          status: "done",
        }));
        controller.enqueue(event("result", result));
      } catch (error) {
        console.error("TraceGuide streamed run failed.", error);
        controller.enqueue(event("error", {
          message: "The service checks could not be completed. No decision was made.",
        }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
