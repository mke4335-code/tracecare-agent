import type { NextRequest, NextResponse } from "next/server";

const cookieName = "traceguide_case_session";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TraceGuideCaseSession = { caseId: string; caseToken: string };

export function readTraceGuideCaseSession(request: NextRequest): TraceGuideCaseSession | null {
  const value = request.cookies.get(cookieName)?.value || "";
  const [caseId, caseToken, extra] = value.split(".");
  if (extra || !uuidPattern.test(caseId || "") || !uuidPattern.test(caseToken || "")) return null;
  return { caseId, caseToken };
}

export function attachTraceGuideCaseSession(
  response: NextResponse,
  session: TraceGuideCaseSession
) {
  response.cookies.set(cookieName, `${session.caseId}.${session.caseToken}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return response;
}

