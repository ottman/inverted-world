import { NextRequest, NextResponse } from "next/server"
import { getDocumentsForTopic, researchDocuments, topics, universalTopic } from "@/data/inverted-world"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get("topic")
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase()
  const base = topicId && topicId !== universalTopic.id ? getDocumentsForTopic(topicId) : researchDocuments
  const documents = q
    ? base.filter((doc) => `${doc.title} ${doc.source} ${doc.kind}`.toLowerCase().includes(q))
    : base

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    topics: [universalTopic, ...topics],
    count: documents.length,
    documents,
  })
}
