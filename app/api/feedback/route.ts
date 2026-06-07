import { supabase } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      question,
      ai_answer,
      sources,
      user_feedback,
      edited_variables,
    } = body;

    if (!question || !ai_answer) {
      return Response.json(
        { error: "question and ai_answer are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bad_cases")
      .insert({
        question,
        ai_answer,
        sources: sources || [],
        user_feedback: user_feedback || "not_helpful",
        edited_variables: edited_variables || {},
        error_type: "user_marked_not_helpful",
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save bad case:", error);
      return Response.json(
        { error: "Failed to save bad case." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      bad_case: data,
    });
  } catch (error) {
    console.error("Feedback API error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}