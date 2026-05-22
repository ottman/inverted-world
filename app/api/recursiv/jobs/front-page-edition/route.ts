import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { publishFrontPageEditionInRecursiv } from "@/lib/recursiv/ingestion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  const result = await publishFrontPageEditionInRecursiv()
  return NextResponse.json({ ok: true, job: "front-page-edition", ...result })
}
