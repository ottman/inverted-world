import { NextResponse } from "next/server"
import { getDeepArchive } from "@/lib/deep-archive"
import { mediaItemHref } from "@/lib/media-links"
import { fetchExpandedMediaLibrary } from "@/lib/media-library"

const baseUrl = "https://www.inverted.world"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET() {
  const [archive, media] = await Promise.all([
    getDeepArchive({ limit: 1000, maxLimit: 1000, allowProviderFallbacks: false }),
    fetchExpandedMediaLibrary({ archiveLimit: 160, allowProviderFallbacks: false }),
  ])
  const lines = [
    "# Inverted World",
    "",
    "Tales From The Inverted World.",
    "",
    "This site is designed for LLM retrieval: every video has an indexable page, canonical metadata, source links, live coverage, and transcript JSON when a stored Recursiv transcript is available.",
    "",
    "## Update Cadence",
    "- Public archive, news, X, media, and transcript routes read Recursiv database rows or committed Recursiv snapshots.",
    "- YouTube live status, channel archive, news search, X signals, media manifests, and transcripts are ingestion responsibilities, not public-render provider calls.",
    "- Stored source snapshots are refreshed by Recursiv jobs; public pages avoid third-party provider keys.",
    "",
    "## Core URLs",
    `${baseUrl}/`,
    `${baseUrl}/archive`,
    `${baseUrl}/media`,
    `${baseUrl}/documents`,
    `${baseUrl}/how-it-works`,
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/api/archive`,
    `${baseUrl}/api/articles`,
    `${baseUrl}/api/media`,
    `${baseUrl}/api/documents`,
    "",
    "## Media Library",
    ...media.items
      .slice(0, 120)
      .map((item) => `- ${item.title} (${item.kind}, ${item.source}): ${baseUrl}${mediaItemHref(item)} | JSON: ${baseUrl}/api/media/${encodeURIComponent(item.id)}`),
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
