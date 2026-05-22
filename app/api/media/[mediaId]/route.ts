import { NextResponse } from "next/server"
import { mediaItemHref } from "@/lib/media-links"
import { fetchMediaLibraryItem } from "@/lib/media-library"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: {
    mediaId: string
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const result = await fetchMediaLibraryItem(params.mediaId)
  if (!result) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 })
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode: result.sourceMode,
    archiveSourceMode: result.archiveSourceMode || null,
    item: {
      ...result.item,
      href: mediaItemHref(result.item),
    },
    related: result.related.map((item) => ({
      ...item,
      href: mediaItemHref(item),
    })),
  })
}
