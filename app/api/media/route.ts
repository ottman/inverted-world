import { NextResponse } from "next/server"
import { fetchMediaLibrary } from "@/lib/media-library"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const kind = url.searchParams.get("kind")
  const topicId = url.searchParams.get("topicId")
  const { sourceMode, items } = await fetchMediaLibrary()
  const filtered = items.filter((item) => {
    if (kind && item.kind !== kind) return false
    if (topicId && !item.topicIds.includes(topicId)) return false
    return true
  })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode,
    count: filtered.length,
    totalCount: items.length,
    filters: {
      kind: kind || null,
      topicId: topicId || null,
    },
    kinds: items.reduce<Record<string, number>>((counts, item) => {
      counts[item.kind] = (counts[item.kind] || 0) + 1
      return counts
    }, {}),
    items: filtered,
  })
}
