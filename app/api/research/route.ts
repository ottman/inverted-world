import { NextResponse } from "next/server"
import { researchDocuments } from "@/data/inverted-world"
import { checkRateLimit, rateLimitResponse, readLimitedJsonBody, requestClientId } from "@/lib/api-security"
import { createRecursivServerClient } from "@/lib/recursiv/client"
import { fetchRecursivClaimDossiers, fetchRecursivWorldwireItems, type ClaimDossier } from "@/lib/recursiv/content"
import { checkRecursivRateLimit, durableRateLimitKey, hashedRateLimitSubject } from "@/lib/recursiv/rate-limit"
import type { WorldwireItem } from "@/lib/worldwire"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const RESEARCH_BODY_LIMIT_BYTES = 16_384
const RESEARCH_POST_RATE_LIMIT = { max: 10, windowMs: 60_000 }
const RESEARCH_CONVERSATION_DAILY_LIMIT = { max: 60, windowMs: 24 * 60 * 60_000 }

type ResearchLink = {
  title: string
  url: string
  source?: string
  excerpt?: string
  score: number
}

function trimMessage(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, 2000)
}

function normalizeConversationId(value: unknown) {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(normalized)) return undefined
  return normalized
}

function markdownLabel(value: string, fallback = "Source") {
  return (value || fallback).replace(/[\[\]\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) || fallback
}

function markdownLink(label: string, url?: string) {
  if (!url || url === "#") return markdownLabel(label)
  return `[${markdownLabel(label)}](${url})`
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  )
}

function matchingTokenCount(queryTokens: Set<string>, value: string) {
  const valueTokens = tokenSet(value)
  let matches = 0
  for (const token of queryTokens) {
    if (valueTokens.has(token)) matches += 1
  }
  return matches
}

function scoreText(queryTokens: Set<string>, value: string, boost = 0) {
  return boost + matchingTokenCount(queryTokens, value) * 12
}

function dossierLinks(dossier: ClaimDossier, queryTokens: Set<string>): ResearchLink[] {
  const dossierText = [dossier.title, dossier.deck, dossier.summary, dossier.weirdRead, dossier.skepticalRead].join(" ")
  const dossierMatches = matchingTokenCount(queryTokens, dossierText)
  const baseScore = dossierMatches
    ? scoreText(queryTokens, dossierText, dossier.confidenceScore / 10 + dossier.xVelocityScore / 40)
    : 0
  const links: ResearchLink[] = [
    {
      title: dossier.title,
      url: `/news/${dossier.slug}`,
      source: "Inverted World",
      excerpt: dossier.summary,
      score: baseScore ? baseScore + 18 : 0,
    },
  ]

  for (const source of dossier.sourceLinks.slice(0, 5)) {
    const sourceText = `${source.title || ""} ${source.excerpt || ""} ${source.outlet || ""} ${source.sourceKind || ""}`
    const sourceMatches = matchingTokenCount(queryTokens, sourceText)
    links.push({
      title: source.title || dossier.title,
      url: source.url,
      source: source.outlet || source.sourceKind || "source",
      excerpt: source.excerpt,
      score: sourceMatches ? baseScore + scoreText(queryTokens, sourceText, 8) : 0,
    })
  }

  return links
}

function worldwireLink(item: WorldwireItem, queryTokens: Set<string>): ResearchLink {
  const itemText = `${item.title} ${item.excerpt || ""} ${item.sectionTitle} ${item.source || ""}`
  const itemMatches = matchingTokenCount(queryTokens, itemText)
  return {
    title: item.title,
    url: item.url,
    source: item.source || item.sectionTitle,
    excerpt: item.excerpt,
    score: itemMatches ? scoreText(queryTokens, itemText, item.score / 20) : 0,
  }
}

function documentLink(queryTokens: Set<string>) {
  return researchDocuments.map<ResearchLink>((document) => {
    const documentText = `${document.title} ${document.kind} ${document.source} ${document.topicIds.join(" ")}`
    const documentMatches = matchingTokenCount(queryTokens, documentText)
    return {
      title: document.title,
      url: document.url,
      source: document.source,
      excerpt: document.kind,
      score: documentMatches ? scoreText(queryTokens, documentText, 18) : 0,
    }
  })
}

function uniqueLinks(links: ResearchLink[]) {
  const seen = new Set<string>()
  return links
    .filter((link) => link.url && link.title)
    .sort((left, right) => right.score - left.score)
    .filter((link) => {
      const key = `${link.url.replace(/\/$/, "")}:${link.title.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

async function gatherResearchContext(message: string) {
  const queryTokens = tokenSet(message)
  const [dossiers, worldwire] = await Promise.all([
    fetchRecursivClaimDossiers({ limit: 36 }).catch(() => []),
    fetchRecursivWorldwireItems({ limitPerLane: 8 }).catch(() => []),
  ])
  const links = uniqueLinks([
    ...((dossiers || []) as ClaimDossier[]).flatMap((dossier) => dossierLinks(dossier, queryTokens)),
    ...((worldwire || []) as WorldwireItem[]).map((item) => worldwireLink(item, queryTokens)),
    ...documentLink(queryTokens),
  ])
  return links.filter((link) => link.score > 0).slice(0, 12)
}

function contextLines(links: ResearchLink[]) {
  return links
    .slice(0, 10)
    .map((link, index) => {
      const suffix = [link.source, link.excerpt?.replace(/\s+/g, " ").trim().slice(0, 220)].filter(Boolean).join(" - ")
      return `${index + 1}. ${link.title} (${link.url})${suffix ? `\n   ${suffix}` : ""}`
    })
    .join("\n")
}

function normalizedIntentText(message: string) {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s']+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function conversationalResearchReply(message: string) {
  const normalized = normalizedIntentText(message)
  if (!normalized) return null

  const presenceChecks = new Set([
    "are you there",
    "are you here",
    "you there",
    "hello",
    "hi",
    "hey",
    "test",
    "testing",
    "is this working",
    "are you working",
  ])

  if (presenceChecks.has(normalized)) {
    return "I'm here. Send me a name, claim, document, event, or source and I'll help trace what is known, what is alleged, and what still needs primary evidence."
  }

  if (/^(thanks|thank you|thx|ty)\b/.test(normalized)) {
    return "You're welcome. Send the next thread when you want to dig deeper."
  }

  if (/^(what can you do|what do you do|how does this work|help)\b/.test(normalized)) {
    return "Give me a topic, source link, document, person, or claim. I'll map it against primary records, competing interpretations, incentives, and open evidence gaps, with Markdown source links when I have matching records."
  }

  return null
}

async function askResearchAgent(message: string, conversationId: string | undefined, links: ResearchLink[]) {
  const { sdk, config } = createRecursivServerClient({ timeout: 120000 })
  if (!config.agentId) return null

  const prompt = [
    "You are the Inverted World research analyst.",
    "Your job is to investigate any topic with a truth-seeking bend: disclosure, institutional incentives, hidden power, suppressed records, anomalous evidence, and the deeper nature of reality.",
    "If the user is only greeting, testing, or asking whether you are present, answer naturally in one or two sentences. Do not force an investigation frame onto conversational messages.",
    "Do not invent certainty. Separate documented facts, allegations, inference, speculation, unknowns, and next primary-source checks.",
    "Return clean Markdown with concise sections and links. Use Markdown links for every URL you cite. Do not return HTML.",
    "If you cannot verify a claim from available sources, say exactly what evidence would be needed.",
    links.length ? `Current Inverted World source context:\n${contextLines(links)}` : "No local source context matched this question.",
    `Research question: ${message}`,
  ].join("\n\n")

  const response = await sdk.agents.chatStreamText(config.agentId, {
    message: prompt,
    conversation_id: conversationId,
    new_conversation: !conversationId,
  })
  const content = String(response.content || "").trim()
  if (!content) return null

  return {
    content,
    conversationId: response.conversationId || conversationId,
  }
}

function fallbackResearchAnswer(message: string, links: ResearchLink[]) {
  const sourceLines = links.slice(0, 6).map((link) => {
    const suffix = link.source ? ` - ${link.source}` : ""
    return `- ${markdownLink(link.title, link.url)}${suffix}`
  })

  return [
    `I would treat **${message}** as an open investigation and start with records that can be checked directly.`,
    "**First pass**\n- Separate documented facts from allegation, inference, and speculation.\n- Look for primary documents, full transcripts, court records, official releases, raw data, or named on-record witnesses.\n- Compare the strongest official version against the strongest skeptical version before deciding what is likely true.",
    sourceLines.length
      ? `**Relevant source trail**\n${sourceLines.join("\n")}`
      : "**Relevant source trail**\n- I do not have a strong matched source trail for this exact query yet.",
    "**What would move the answer**\n- A primary record with provenance.\n- Independent confirmation from an adversarial or skeptical source.\n- Clear chain of custody for documents, images, video, data, or testimony.\n- A timeline showing who knew what, when, and what incentive they had to frame it that way.",
  ].join("\n\n")
}

async function checkResearchBudget(clientId: string, conversationId?: string) {
  const clientHash = hashedRateLimitSubject(clientId)
  const checks = await Promise.all([
    checkRecursivRateLimit(durableRateLimitKey("research", "ip", clientHash), RESEARCH_POST_RATE_LIMIT, {
      route: "research",
      scope: "ip-minute",
    }),
    conversationId
      ? checkRecursivRateLimit(durableRateLimitKey("research", "conversation", conversationId), RESEARCH_CONVERSATION_DAILY_LIMIT, {
          route: "research",
          scope: "conversation-day",
        })
      : Promise.resolve({ ok: true as const, remaining: RESEARCH_CONVERSATION_DAILY_LIMIT.max, resetAt: Date.now(), source: "recursiv-database" as const }),
  ])

  const blocked = checks.find((check) => check.ok === false)
  if (blocked?.ok === false) return { ok: false as const, blocked }
  return { ok: true as const, durableUnavailable: checks.some((check) => check.ok === null) }
}

function fallbackConversationId(conversationId?: string) {
  return conversationId || `research-${Date.now().toString(36)}`
}

export async function POST(request: Request) {
  const clientId = requestClientId(request)
  const rate = checkRateLimit(`research:${clientId}`, RESEARCH_POST_RATE_LIMIT)
  if (!rate.ok) return rateLimitResponse(rate)

  const parsedBody = await readLimitedJsonBody<{
    message?: unknown
    conversationId?: unknown
  }>(request, RESEARCH_BODY_LIMIT_BYTES)
  if (!parsedBody.ok) return parsedBody.response

  const message = trimMessage(parsedBody.body.message)
  const conversationId = normalizeConversationId(parsedBody.body.conversationId)
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 })

  const budget = await checkResearchBudget(clientId, conversationId)
  if (!budget.ok) return rateLimitResponse(budget.blocked)

  const conversationalAnswer = conversationalResearchReply(message)
  if (conversationalAnswer) {
    return NextResponse.json({
      conversationId: fallbackConversationId(conversationId),
      response: conversationalAnswer,
      mode: "conversation",
      linkCount: 0,
    })
  }

  const links = await gatherResearchContext(message)
  const agentAnswer = budget.durableUnavailable ? null : await askResearchAgent(message, conversationId, links).catch(() => null)
  const responseText = agentAnswer?.content || fallbackResearchAnswer(message, links)

  return NextResponse.json({
    conversationId: agentAnswer?.conversationId || fallbackConversationId(conversationId),
    response: responseText,
    mode: agentAnswer ? "agent" : "context-fallback",
    linkCount: links.length,
  })
}
