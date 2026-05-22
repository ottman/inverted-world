import { NextResponse } from "next/server"
import { topics } from "@/data/inverted-world"
import { fetchSourceDocuments, type SourceDocument } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "")
}

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function documentMatches(document: SourceDocument, filters: { topicId?: string; kind?: string }) {
  if (filters.topicId && !document.topicIds.includes(filters.topicId)) return false
  if (filters.kind && document.kind !== filters.kind) return false
  return true
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const topicId = url.searchParams.get("topicId") || undefined
  const kind = url.searchParams.get("kind") || undefined
  const { sourceMode, documents: allDocuments } = await fetchSourceDocuments()
  const documents = allDocuments.filter((document) => documentMatches(document, { topicId, kind }))

  const kinds = allDocuments.reduce<Record<string, number>>((counts, document) => {
    counts[document.kind] = (counts[document.kind] || 0) + 1
    return counts
  }, {})

  const topicSummary = topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    signal: topic.signal,
    documentCount: allDocuments.filter((document) => document.topicIds.includes(topic.id)).length,
  }))

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode,
    count: documents.length,
    totalCount: allDocuments.length,
    filters: {
      topicId: topicId || null,
      kind: kind || null,
    },
    kinds,
    topics: topicSummary,
    documents: documents.map((document) => ({
      id: document.id || slugify(`${document.source}-${document.title}`) || slugify(document.url) || "source-document",
      title: document.title,
      source: document.source,
      url: document.url,
      host: document.host || hostName(document.url),
      kind: document.kind,
      topicIds: document.topicIds,
      topics: document.topics,
    })),
  })
}
