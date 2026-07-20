export type BuyerProgressEvent = {
  id: string;
  label: string;
  status: "done" | "in_progress";
};

export async function runTraceguideStream<T>(input: {
  payload: Record<string, unknown>;
  caseId?: string | null;
  onProgress?: (event: BuyerProgressEvent) => void;
}): Promise<T> {
  let caseId = input.caseId || null;
  if (!caseId) {
    const startResponse = await fetch("/api/traceguide-run/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.payload),
    });
    const started = await startResponse.json() as { caseId?: string; error?: string };
    if (!startResponse.ok || !started.caseId) {
      throw new Error(started.error || "The service case could not be started.");
    }
    caseId = started.caseId;
  }

  const response = await fetch("/api/traceguide-run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ ...input.payload, caseId }),
  });
  if (!response.ok || !response.body) {
    const failure = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(failure.error || "The streamed service run could not be started.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: T | null = null;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const eventType = frame.match(/^event: (.+)$/m)?.[1];
      const dataLine = frame.match(/^data: (.+)$/m)?.[1];
      if (!eventType || !dataLine) continue;
      const payload = JSON.parse(dataLine) as Record<string, unknown>;
      if (eventType === "progress") {
        input.onProgress?.(payload as BuyerProgressEvent);
      } else if (eventType === "result") {
        finalResult = payload as T;
      } else if (eventType === "error") {
        throw new Error(typeof payload.message === "string" ? payload.message : "The service run failed.");
      }
    }
    if (done) break;
  }
  if (!finalResult) throw new Error("The service run ended without a result.");
  return finalResult;
}
