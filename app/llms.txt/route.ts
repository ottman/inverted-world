import { NextResponse } from "next/server"
import { getDeepArchive } from "@/lib/deep-archive"

const baseUrl = "https://invertedworld.on.recursiv.io"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET() {
  const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
  const lines = [
    "# Inverted World",
    "",
    "A topic-organized video archive for Tales From the Inverted World with hourly live article feeds.",
    "",
    "## Core URLs",
    `${baseUrl}/`,
    `${baseUrl}/archive`,
    `${baseUrl}/sitemap.xml`,
    "",
    "## Video Archive",
    ...archive.videos
      .filter((video) => video.videoId)
      .map((video) => `- ${video.title} (${video.date || "archive"}): ${baseUrl}/archive/${video.videoId}`),
  ]

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "s-maxage=3600, stale-while-revalidate=3600",
    },
  })
}
