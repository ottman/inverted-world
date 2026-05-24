import { NextResponse } from "next/server"
import { getDeepArchive } from "@/lib/deep-archive"

const baseUrl = "https://www.inverted.world"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET() {
  const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000, allowProviderFallbacks: false })
  const lines = [
    "# Inverted World",
    "",
    "Tales From The Inverted World.",
    "",
    "This site is designed for LLM retrieval: every video has an indexable page, canonical metadata, story source links, live coverage, and transcript JSON when a stored Recursiv transcript is available.",
    "",
    "## Update Cadence",
    "- Public archive, news, X, and transcript routes read Recursiv database rows or committed Recursiv snapshots.",
    "- YouTube live status, channel archive, news search, X signals, source documents, and transcripts are ingestion responsibilities, not public-render provider calls.",
    "- Stored source snapshots are refreshed by Recursiv jobs; public pages avoid third-party provider keys.",
    "",
    "## Core URLs",
    `${baseUrl}/`,
    `${baseUrl}/archive`,
    `${baseUrl}/how-it-works`,
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/api/archive`,
    `${baseUrl}/api/articles`,
    "",
    "## Video Archive",
    ...archive.videos
      .filter((video) => video.videoId)
      .map(
        (video) =>
          `- ${video.title} (${video.date || "archive"}): ${baseUrl}/archive/${video.videoId} | transcript JSON: ${baseUrl}/api/transcript/${video.videoId}`,
      ),
  ]

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "s-maxage=3600, stale-while-revalidate=3600",
    },
  })
}
