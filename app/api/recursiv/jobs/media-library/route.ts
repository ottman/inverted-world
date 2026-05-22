import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { ensureInvertedWorldSchema, syncMediaLibraryToRecursiv } from "@/lib/recursiv/ingestion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  await ensureInvertedWorldSchema()
  const result = await syncMediaLibraryToRecursiv()
  return NextResponse.json({ ok: true, job: "media-library", ...result })
}
