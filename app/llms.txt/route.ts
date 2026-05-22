import { NextResponse } from "next/server"
import { getDeepArchive } from "@/lib/deep-archive"

const baseUrl = "https://www.inverted.world"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET() {
  const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
  const lines = [
    "# Inverted World",
    "",
    "Tales From The Inverted World.",
    "",
    "This site is designed for LLM retrieval: every video has an indexable page, canonical metadata, source links, live coverage, and a transcript section when YouTube captions are public.",
    "",
    "## Update Cadence",
    "- YouTube live status: checked every 60 seconds.",
    "- Full channel archive and header video: refreshed from the YouTube Data API every 5 minutes when the API is available.",
    "- Google News topic feeds: refreshed every hour.",
    "- Viral X signal fetches: refreshed every 30 minutes; X API metrics are used when available.",
    "- YouTube transcripts: refreshed daily because caption tracks are mostly stable after upload.",
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
