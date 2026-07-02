import { supabase } from "../../../lib/supabase";

type StudyEventBody = {
  sessionId?: string;
  participantCode?: string;
  condition?: "baseline" | "traceguide" | string;
  taskId?: string;
  eventName?: string;
  payload?: Record<string, unknown>;
  userAgent?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StudyEventBody;
    const eventName = typeof body.eventName === "string" ? body.eventName.trim() : "";

    if (!eventName) {
      return Response.json({ error: "eventName is required." }, { status: 400 });
    }

    const insertPayload = {
      // Keep the formal FK nullable. Browser-generated session ids are stored
      // in payload so anonymous participant logging cannot fail on FK checks.
      session_id: null,
      participant_code: body.participantCode || null,
      condition: body.condition || null,
      task_id: body.taskId || null,
      event_name: eventName,
      payload: {
        ...(body.payload || {}),
        clientSessionId: body.sessionId || null,
        userAgent: body.userAgent || null,
      },
    };

    const { error } = await supabase.from("study_events").insert(insertPayload);

    if (error) {
      console.error("Failed to save study event:", error);
      return Response.json({ error: "Failed to save study event." }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Study event API error:", error);
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
