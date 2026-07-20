import { NextRequest, NextResponse } from "next/server";

import {
  confirmServiceCaseEvidence,
  getServiceCase,
  markServiceCaseEvidenceRemoved,
} from "@/lib/traceguide-case-runtime";
import { supabase } from "@/lib/supabase";
import { readTraceGuideCaseSession } from "@/lib/traceguide-case-session";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);

const maxEvidenceBytes = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const caseId = String(formData.get("caseId") || "").trim();
    const session = readTraceGuideCaseSession(request);
    const caseToken = session && session.caseId === caseId ? session.caseToken : "";
    const file = formData.get("file");

    if (!caseId || !caseToken || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A service case and evidence image are required." },
        { status: 400 }
      );
    }

    const extension = allowedTypes.get(
      file.type as "image/jpeg" | "image/png" | "image/webp"
    );
    if (!extension) {
      return NextResponse.json(
        { error: "Use a JPEG, PNG or WebP image." },
        { status: 415 }
      );
    }
    if (file.size === 0 || file.size > maxEvidenceBytes) {
      return NextResponse.json(
        { error: "The evidence image must be between 1 byte and 10 MB." },
        { status: 413 }
      );
    }

    const storagePath = `${caseToken}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("traceguide-evidence")
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    try {
      const evidence = await confirmServiceCaseEvidence({
        caseId,
        caseToken,
        storagePath,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        fileSizeBytes: file.size,
      });
      return NextResponse.json({ evidence });
    } catch (error) {
      await supabase.storage.from("traceguide-evidence").remove([storagePath]);
      throw error;
    }
  } catch (error) {
    console.error("TraceGuide evidence upload failed.", error);
    return NextResponse.json(
      { error: "The evidence could not be saved. Please try again or ask for human support." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      caseId?: string;
      storagePath?: string;
    };
    const caseId = body.caseId?.trim();
    const session = readTraceGuideCaseSession(request);
    const caseToken = session && session.caseId === caseId ? session.caseToken : "";
    const storagePath = body.storagePath?.trim();
    if (!caseId || !caseToken || !storagePath || !storagePath.startsWith(`${caseToken}/`)) {
      return NextResponse.json({ error: "Invalid evidence removal request." }, { status: 400 });
    }

    const serviceCase = await getServiceCase({ caseId, caseToken });
    if (!serviceCase) {
      return NextResponse.json({ error: "Service case not found." }, { status: 404 });
    }

    const { error: removeError } = await supabase.storage
      .from("traceguide-evidence")
      .remove([storagePath]);
    if (removeError) throw removeError;

    const evidence = await markServiceCaseEvidenceRemoved({
      caseId,
      caseToken,
      storagePath,
    });
    return NextResponse.json({ evidence });
  } catch (error) {
    console.error("TraceGuide evidence removal failed.", error);
    return NextResponse.json(
      { error: "The evidence could not be removed." },
      { status: 500 }
    );
  }
}
