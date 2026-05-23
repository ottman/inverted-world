import { NextRequest } from "next/server"
import { ensureInvertedWorldSchema, syncSourceDocumentsToRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  return runRecursivJob(request, "source-documents", async () => {
    await ensureInvertedWorldSchema()
    return syncSourceDocumentsToRecursiv()
  })
}
