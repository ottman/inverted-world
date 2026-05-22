import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { ensureInvertedWorldSchema, syncSourceDocumentsToRecursiv } from "@/lib/recursiv/ingestion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  await ensureInvertedWorldSchema()
  const result = await syncSourceDocumentsToRecursiv()
  return NextResponse.json({ ok: true, job: "source-documents", ...result })
}
