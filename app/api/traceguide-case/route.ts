import { NextRequest, NextResponse } from "next/server";

import { getServiceCase } from "@/lib/traceguide-case-runtime";
import { readTraceGuideCaseSession } from "@/lib/traceguide-case-session";

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId")?.trim();
  const session = readTraceGuideCaseSession(request);
  const caseToken = session && session.caseId === caseId ? session.caseToken : "";

  if (!caseId || !caseToken) {
    return NextResponse.json(
      { error: "A case ID and case token are required." },
      { status: 400 }
    );
  }

  try {
    const serviceCase = await getServiceCase({ caseId, caseToken });
    if (!serviceCase) {
      return NextResponse.json({ error: "Service case not found." }, { status: 404 });
    }
    return NextResponse.json({ serviceCase });
  } catch (error) {
    console.error("TraceGuide case lookup failed.", error);
    return NextResponse.json(
      { error: "The service case could not be loaded." },
      { status: 500 }
    );
  }
}
