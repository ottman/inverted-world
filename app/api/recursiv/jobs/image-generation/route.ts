import { NextRequest } from "next/server"
import { generateImagesForDraftsInRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  return runRecursivJob(request, "image-generation", generateImagesForDraftsInRecursiv)
}
