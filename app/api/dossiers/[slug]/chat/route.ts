import { NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse, readLimitedJsonBody, requestClientId } from "@/lib/api-security"
import { createRecursivServerClient } from "@/lib/recursiv/client"
import { fetchRecursivDossierChatMessages, getRecursivClaimDossier, type ClaimDossier } from "@/lib/recursiv/content"
import { xPostExternalHref } from "@/lib/x-links"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: {
    slug: string
  }
}

type RecursivClient = ReturnType<typeof createRecursivServerClient>
type ChatMode = "agent" | "context-fallback"
const CHAT_BODY_LIMIT_BYTES = 16_384
const CHAT_POST_RATE_LIMIT = { max: 8, windowMs: 60_000 }
const CHAT_GET_RATE_LIMIT = { max: 60, windowMs: 60_000 }

function trimMessage(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, 1200)
}

function normalizeConversationId(value: unknown) {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(normalized)) return undefined
  return normalized
}

function dossierContext(dossier: ClaimDossier) {
  const sourceLines = dossier.sourceLinks
    .slice(0, 8)
    .map((source, index) => {
      const excerpt = source.excerpt ? `\n   Extract: ${source.excerpt}` : ""
      return `${index + 1}. ${source.outlet || source.sourceKind || "source"}: ${source.title} (${source.url})${excerpt}`
    })
    .join("\n")
  const xLines = dossier.xSignals
    .slice(0, 6)
    .map((post, index) => `${index + 1}. @${post.username || "x"} (${xPostExternalHref(post)}): ${post.text}`)
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

function markdownLabel(value: string, fallback = "Source") {
  return (value || fallback).replace(/[\[\]\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) || fallback
}

function markdownLink(label: string, url?: string) {
  if (!url || url === "#") return markdownLabel(label)
  return `[${markdownLabel(label)}](${url})`
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function topSourceLines(dossier: ClaimDossier) {
  return dossier.sourceLinks.slice(0, 5).map((source) => {
    const outlet = source.outlet || source.sourceKind || "source"
    const lane = source.biasLane || source.stance
    const suffix = [outlet, lane].filter(Boolean).join(", ")
    return `- ${markdownLink(source.title || outlet, source.url)}${suffix ? ` - ${suffix}` : ""}`
  })
}

function topXSignalLines(dossier: ClaimDossier) {
  return dossier.xSignals.slice(0, 3).map((post) => {
    const author = post.username ? `@${post.username}` : post.authorName || "X signal"
    const text = post.text.replace(/\s+/g, " ").trim().slice(0, 180)
    return `- ${markdownLink(author, xPostExternalHref(post))}: ${text}`
  })
}

function topVideoLines(dossier: ClaimDossier) {
  return dossier.relatedVideos.slice(0, 3).map((video) => {
    const href = video.videoId ? `/archive/${video.videoId}` : video.href
    return `- ${markdownLink(video.title, href)}`
  })
}

function questionFocus(message: string) {
  const normalized = message.toLowerCase()
  return {
    evidence: /\b(evidence|source|document|proof|prove|primary|link)\b/.test(normalized),
    truth: /\b(true|truth|real|verified|fact|facts|documented)\b/.test(normalized),
    missing: /\b(missing|unknown|not know|unproven|weak|skeptical|counter)\b/.test(normalized),
    x: /\b(x|twitter|viral|post|social|velocity)\b/.test(normalized),
    video: /\b(video|youtube|tales|episode|archive|show)\b/.test(normalized),
  }
}

function fallbackDossierAnswer(dossier: ClaimDossier, message: string) {
  const focus = questionFocus(message)
  const sourceLines = topSourceLines(dossier)
  const xLines = topXSignalLines(dossier)
  const videoLines = topVideoLines(dossier)
  const attachedCounts = [
    countLabel(dossier.sourceLinks.length || dossier.sourceCount, "source"),
    countLabel(dossier.xSignals.length || dossier.xSignalCount, "X signal"),
    countLabel(dossier.relatedVideos.length || dossier.relatedVideoCount, "Tales archive item"),
  ].join(", ")

  const lead = focus.truth
    ? `The stored dossier treats **${dossier.title}** as a developing, sourced story rather than a final verdict.`
    : focus.evidence
      ? `The strongest starting point is the source pack attached to **${dossier.title}**.`
      : focus.x
        ? `The X layer shows how **${dossier.title}** is moving socially, but the source links still carry the evidentiary weight.`
        : focus.video
          ? `The related Tales archive gives background context for **${dossier.title}**; it should be read alongside the primary source links.`
          : `**${dossier.title}** is currently supported by ${attachedCounts}.`

  const documented = [
    dossier.summary ? `- ${dossier.summary}` : "",
    `- Evidence grade: **${dossier.evidenceGrade || "developing"}**. Confidence score: **${dossier.confidenceScore || 0}/100**.`,
    sourceLines.length
      ? `- The source pack includes ${countLabel(dossier.sourceLinks.length, "link")} across ${countLabel(new Set(dossier.sourceLinks.map((source) => source.outlet || source.sourceKind || "source")).size, "source lane")}.`
      : "- No primary source links are attached yet, so this story needs more reporting before it can be treated as settled.",
  ].filter(Boolean)

  const missing = [
    dossier.skepticalRead ? `- ${dossier.skepticalRead}` : "",
    focus.truth || focus.missing
      ? "- Treat unsupported leaps as unknown until a primary document, named witness, full transcript, or on-record institutional response is attached."
      : "- The next useful check is whether the source links contain primary documents or only secondhand summaries.",
  ].filter(Boolean)

  const sections = [
    `**Short answer:** ${lead}`,
    `**Documented in the dossier**\n${documented.join("\n")}`,
    `**What still needs checking**\n${missing.join("\n")}`,
  ]

  if (sourceLines.length) sections.push(`**Start with these sources**\n${sourceLines.join("\n")}`)
  if (focus.x && xLines.length) sections.push(`**X velocity**\n${xLines.join("\n")}`)
  if (focus.video && videoLines.length) sections.push(`**Tales archive context**\n${videoLines.join("\n")}`)
  if (!focus.x && !focus.video && (xLines.length || videoLines.length)) {
    const contextLines = [...xLines.slice(0, 2), ...videoLines.slice(0, 2)]
    sections.push(`**Related context**\n${contextLines.join("\n")}`)
  }

  return sections.join("\n\n")
}

async function askRecursivAgent(dossier: ClaimDossier, message: string, conversationId?: string) {
  const client = createRecursivServerClient({ timeout: 120000 })
  const { sdk, config } = client
  if (!config.agentId) return null

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
  const content = String(response.content || "").trim()
  if (!content) return null

  return {
    client,
    conversationId: response.conversationId || conversationId,
    content,
    agentId: config.agentId,
  }
}

async function persistChatMessage(
  dossier: ClaimDossier,
  message: string,
  response: string,
  conversationId: string,
  metadata: Record<string, unknown>,
  client?: RecursivClient,
) {
  try {
    const activeClient = client || createRecursivServerClient({ timeout: 30000, maxRetries: 0 })
    await activeClient.sdk.databases.query({
      project_id: activeClient.config.projectId,
      database_name: activeClient.config.databaseName,
      sql: `INSERT INTO claim_chat_messages (dossier_slug, conversation_id, role, message, response, metadata)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      params: [
        dossier.slug,
        conversationId,
        "user",
        message,
        response,
        JSON.stringify({
          ...metadata,
          sourceCount: dossier.sourceCount,
          xSignalCount: dossier.xSignalCount,
          relatedVideoCount: dossier.relatedVideoCount,
        }),
      ],
    })
    return true
  } catch {
    return false
  }
}

function fallbackConversationId(dossier: ClaimDossier, conversationId?: string) {
  return conversationId || `context-${dossier.slug}-${Date.now().toString(36)}`
}

export async function GET(request: Request, { params }: RouteContext) {
  const clientId = requestClientId(request)
  const rate = checkRateLimit(`dossier-chat:get:${clientId}`, CHAT_GET_RATE_LIMIT)
  if (!rate.ok) return rateLimitResponse(rate)

  const dossier = await getRecursivClaimDossier(params.slug)
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") || "8")
  const conversationId = normalizeConversationId(url.searchParams.get("conversationId"))
  const messages = conversationId ? (await fetchRecursivDossierChatMessages(dossier.slug, { limit, conversationId })) || [] : []

  return NextResponse.json({
    dossierSlug: dossier.slug,
    conversationId,
    generatedAt: new Date().toISOString(),
    count: messages.length,
    messages,
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  const clientId = requestClientId(request)
  const rate = checkRateLimit(`dossier-chat:post:${params.slug}:${clientId}`, CHAT_POST_RATE_LIMIT)
  if (!rate.ok) return rateLimitResponse(rate)

  const dossier = await getRecursivClaimDossier(params.slug)
  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const parsedBody = await readLimitedJsonBody<{
    message?: unknown
    conversationId?: unknown
    contextOnly?: unknown
    persist?: unknown
  }>(request, CHAT_BODY_LIMIT_BYTES)
  if (!parsedBody.ok) return parsedBody.response

  const body = parsedBody.body
  const message = trimMessage(body.message)
  const conversationId = normalizeConversationId(body.conversationId)
  const contextOnly = body.contextOnly === true
  const shouldPersist = body.persist !== false
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const agentAnswer = contextOnly ? null : await askRecursivAgent(dossier, message, conversationId).catch(() => null)
  const mode: ChatMode = agentAnswer ? "agent" : "context-fallback"
  const responseText = agentAnswer?.content || fallbackDossierAnswer(dossier, message)
  const responseConversationId = agentAnswer?.conversationId || fallbackConversationId(dossier, conversationId)
  const stored = shouldPersist
    ? await persistChatMessage(
        dossier,
        message,
        responseText,
        responseConversationId,
        {
          mode,
          ...(contextOnly ? { contextOnly: true } : {}),
          ...(agentAnswer?.agentId ? { agentId: agentAnswer.agentId } : {}),
        },
        agentAnswer?.client,
      )
    : false

  return NextResponse.json({
    conversationId: responseConversationId,
    response: responseText,
    mode,
    stored,
  })
}
