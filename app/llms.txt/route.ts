import { NextResponse } from "next/server"
import { intelligenceArticles } from "@/data/intelligence-articles"
import { getDeepArchive } from "@/lib/deep-archive"

const baseUrl = "https://invertedworld.on.recursiv.io"

export const dynamic = "force-dynamic"
export const revalidate = 900

export async function GET() {
  const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
  const lines = [
    "# Inverted World",
    "",
    "A research archive and AI dossier system for Tales From the Inverted World.",
    "",
    "## Core URLs",
    `${baseUrl}/`,
    `${baseUrl}/archive`,
    `${baseUrl}/news`,
    `${baseUrl}/documents`,
    `${baseUrl}/sitemap.xml`,
    "",
    "## Article Inventory",
    ...intelligenceArticles.map((article) => `- ${article.title} (${article.publishedAt}): ${baseUrl}/news/${article.id}`),
    "",
    "## Video Dossiers",
    ...archive.videos
      .filter((video) => video.videoId)
      .map((video) => `- ${video.title} (${video.date || "archive"}): ${baseUrl}/archive/${video.videoId}`),
  ]

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "s-maxage=900, stale-while-revalidate=3600",
    },
  })
}
