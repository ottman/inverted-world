import { NextRequest, NextResponse } from "next/server"
import { featuredVideos } from "@/data/inverted-world"
import { getDeepArchive } from "@/lib/deep-archive"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || "100")
  const offset = Number(request.nextUrl.searchParams.get("offset") || "0")
  try {
    const archive = await getDeepArchive({ limit, offset, maxLimit: 1000, allowProviderFallbacks: false })
    return NextResponse.json(archive)
  } catch (error) {
    const seeded = featuredVideos.filter((video) => video.source === "YouTube" && video.videoId)
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 1000)
    const safeOffset = Math.min(Math.max(Math.trunc(offset) || 0, 0), seeded.length)
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sourceMode: "seed",
      completeHistoryAvailable: false,
      videos: seeded.slice(safeOffset, safeOffset + safeLimit),
      totalCount: seeded.length,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: safeOffset + safeLimit < seeded.length,
      warnings: [
        "Archive read recovered from a backend failure.",
        error instanceof Error ? error.message : "Unknown archive read failure.",
      ],
    })
  }
}
