import { NextRequest } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { buildTalesStoriesToRecursiv, type TaleArticleInput } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Ingest the generated evergreen tales: read the prepared articles JSON, validate a viral YouTube
// clip via keyless oEmbed + fetch a relevant/AI image per article, and store the tales-stories set.
// Run locally (writes to the shared Recursiv DB); the file lives in .tales-gen/ on the dev machine.
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const rebuild = /^(1|true|yes)$/i.test(url.searchParams.get("rebuild") || "")
  const file = url.searchParams.get("file") || ".tales-gen/articles.json"
  return runRecursivJob(request, "build-tales", () => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), file), "utf8")
    const articles = JSON.parse(raw) as TaleArticleInput[]
    return buildTalesStoriesToRecursiv(articles, { rebuild })
  })
}
