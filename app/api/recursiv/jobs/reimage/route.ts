import { NextRequest } from "next/server"
import { reimageAllStoredSets } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Re-pick a relevant photo (or AI-generated image) for every stored "dud" thumbnail across all sets.
// Spends NO newsapi quota — Openverse + the free Pollinations AI fallback only.
export async function POST(request: NextRequest) {
  return runRecursivJob(request, "reimage", () => reimageAllStoredSets())
}
