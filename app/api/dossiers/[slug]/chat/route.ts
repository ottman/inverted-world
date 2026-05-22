import { NextResponse } from "next/server"
import { createRecursivServerClient } from "@/lib/recursiv/client"
import { fetchRecursivDossierChatMessages, getRecursivClaimDossier } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: {
    slug: string
  }
}

function trimMessage(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, 1200)
}

function dossierContext(dossier: NonNullable<Awaited<ReturnType<typeof getRecursivClaimDossier>>>) {
  const sourceLines = dossier.sourceLinks
    .slice(0, 8)
    .map((source, index) => {
      const excerpt = source.excerpt ? `\n   Extract: ${source.excerpt}` : ""
      return `${index + 1}. ${source.outlet || source.sourceKind || "source"}: ${source.title} (${source.url})${excerpt}`
    })
    .join("\n")
  const xLines = dossier.xSignals
    .slice(0, 6)
    .map((post, index) => `${index + 1}. @${post.username || "x"}: ${post.text}`)
    .join("\n")
  const videoLines = dossier.relatedVideos
    .slice(0, 4)
    .map((video, index) => `${index + 1}. ${video.title} (${video.href})`)
    .join("\n")

  return [
    dossier.chatPrompt,
    `Title: ${dossier.title}`,
    `Claim: ${dossier.claim}`,
    `Summary: ${dossier.summary}`,
    `Evidence grade: ${dossier.evidenceGrade}`,
    `Confidence score: ${dossier.confidenceScore}`,
    `Weird read: ${dossier.weirdRead}`,
    `Skeptical read: ${dossier.skepticalRead}`,
    `Sources:\n${sourceLines || "No source links attached."}`,
    `X signals:\n${xLines || "No X signals attached."}`,
    `Archive videos:\n${videoLines || "No related Tales videos attached."}`,
  ].join("\n\n")
}

export async function GET(request: Request, { params }: RouteContext) {
  const dossier = await getRecursivClaimDossier(params.slug)
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") || "8")
  const messages = (await fetchRecursivDossierChatMessages(dossier.slug, { limit })) || []

  return NextResponse.json({
    dossierSlug: dossier.slug,
    generatedAt: new Date().toISOString(),
    count: messages.length,
    messages,
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  const dossier = await getRecursivClaimDossier(params.slug)
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as { message?: unknown; conversationId?: unknown }
  const message = trimMessage(body.message)
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const { sdk, config } = createRecursivServerClient({ timeout: 120000 })
  if (!config.agentId) {
    return NextResponse.json({ error: "RECURSIV_AGENT_ID is not configured" }, { status: 503 })
  }

  const prompt = [
    "Answer as the Inverted World dossier analyst.",
    "Use only the supplied dossier context. If the dossier does not prove something, say what is missing.",
    "Separate documented fact, allegation, inference, speculation, and unknowns.",
    "Return clean Markdown: short paragraphs, bullets when useful, bold labels for categories, and inline links to supplied source URLs. Do not return HTML.",
    dossierContext(dossier),
    `User question: ${message}`,
  ].join("\n\n")

  const response = await sdk.agents.chatStreamText(config.agentId, {
    message: prompt,
    conversation_id: conversationId,
    new_conversation: !conversationId,
  })

  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO claim_chat_messages (dossier_slug, conversation_id, role, message, response, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    params: [
      dossier.slug,
      response.conversationId,
      "user",
      message,
      response.content,
      JSON.stringify({ agentId: config.agentId, sourceCount: dossier.sourceCount, xSignalCount: dossier.xSignalCount }),
    ],
  })

  return NextResponse.json({
    conversationId: response.conversationId,
    response: response.content,
  })
}
