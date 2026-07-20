import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return Response.json({ error: "JSON body required" }, { status: 415 });
  }

  const body = await request.json().catch(() => ({})) as { input?: unknown };
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input || input.length > 2000) {
    return Response.json({ error: "Input must be between 1 and 2000 characters" }, { status: 400 });
  }

  try {
    const embedding = await model.run(input, { mean_pool: true, normalize: true });
    if (!Array.isArray(embedding) || embedding.length !== 384) {
      throw new Error("Unexpected embedding dimensions");
    }
    return Response.json({ embedding, model: "gte-small", dimensions: 384 });
  } catch (error) {
    console.error("Embedding generation failed", error);
    return Response.json({ error: "Embedding generation unavailable" }, { status: 503 });
  }
});
