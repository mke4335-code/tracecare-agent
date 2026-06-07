import { supabase } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      session_id,
      role,
      content,
      sources,
      confidence,
    } = body;

    if (!session_id || !role || !content) {
      return Response.json(
        { error: "session_id, role, and content are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        session_id,
        role,
        content,
        sources: sources || [],
        confidence: confidence ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save message:", error);
      return Response.json(
        { error: "Failed to save message." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: data,
    });
  } catch (error) {
    console.error("Messages API error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}