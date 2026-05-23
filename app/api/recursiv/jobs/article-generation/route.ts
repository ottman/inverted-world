import { NextRequest } from "next/server"
import { generateArticleDraftsInRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function optionalBoolean(value: string | null) {
  if (value === null) return undefined
  return !["0", "false", "no", "off"].includes(value.toLowerCase())
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  return runRecursivJob(request, "article-generation", () =>
    generateArticleDraftsInRecursiv({
      limit: Number(url.searchParams.get("limit") || "") || undefined,
      useAgent: optionalBoolean(url.searchParams.get("useAgent")),
    }),
  )
}
