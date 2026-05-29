import { NextResponse } from "next/server"
import { researchDocuments } from "@/data/inverted-world"
import { researchDoctrine, researchSourceSeeds, type ResearchSourcePriority } from "@/data/research-sources"
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
  priority?: ResearchSourcePriority | "crawler" | "site"
  score: number
}

const RESEARCH_QUERY_STOPWORDS = new Set([
  "about",
  "against",
  "anything",
  "best",
  "can",
  "case",
  "claim",
  "claims",
  "conspiracies",
  "conspiracy",
  "does",
  "evidence",
  "explain",
  "find",
  "for",
  "from",
  "how",
  "into",
  "me",
  "real",
  "record",
  "records",
  "research",
  "show",
  "source",
  "sources",
  "strongest",
  "tell",
  "the",
  "there",
  "theories",
  "theory",
  "thing",
  "things",
  "this",
  "truth",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
])

// Common nouns too broad to make a recency-driven current-news item relevant on their
// own. A worldwire/current item must share a *distinctive* (non-generic) query token, so
// e.g. "rendlesham forest" can't surface an unrelated story that merely mentions "forest".
const RESEARCH_GENERIC_TOKENS = new Set([
  "area",
  "day",
  "days",
  "fire",
  "forest",
  "forests",
  "light",
  "lights",
  "news",
  "night",
  "people",
  "photo",
  "photos",
  "place",
  "report",
  "reports",
  "sky",
  "stories",
  "story",
  "today",
  "update",
  "updates",
  "video",
  "videos",
  "water",
  "wood",
  "woods",
  "world",
  "year",
  "years",
])

const MAINSTREAM_COMPARATOR_HOSTS = new Set([
  "abcnews.go.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "cbsnews.com",
  "cnn.com",
  "msnbc.com",
  "nbcnews.com",
  "newsweek.com",
  "npr.org",
  "nytimes.com",
  "politico.com",
  "reuters.com",
  "theguardian.com",
  "time.com",
  "usatoday.com",
  "washingtonpost.com",
  "wsj.com",
])

function researchDoctrineMarkdown() {
  return researchDoctrine.map((line) => `- ${line}`).join("\n")
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

function normalizeTokenText(value: string) {
  return value
    .toLowerCase()
    .replace(/\b9\s*\/\s*11\b/g, " 911 ")
    .replace(/\b9\s*-\s*11\b/g, " 911 ")
    .replace(/\bsept(?:ember)?\s+11(?:th)?\b/g, " 911 ")
}

function tokenSet(value: string) {
  return new Set(
    normalizeTokenText(value)
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  )
}

function queryTokenSet(value: string) {
  return new Set([...tokenSet(value)].filter((word) => !RESEARCH_QUERY_STOPWORDS.has(word)))
}

function linkHost(url?: string) {
  if (!url) return ""
  try {
    return new URL(url, "https://www.inverted.world").hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function mainstreamComparatorPenalty(url?: string, source?: string) {
  const normalizedSource = (source || "").toLowerCase().replace(/^www\./, "")
  const host = linkHost(url)
  if (MAINSTREAM_COMPARATOR_HOSTS.has(host) || MAINSTREAM_COMPARATOR_HOSTS.has(normalizedSource)) return -24
  return 0
}

function priorityBoost(priority?: ResearchLink["priority"]) {
  if (priority === "primary") return 34
  if (priority === "independent") return 32
  if (priority === "alternative") return 30
  if (priority === "archive") return 28
  return 0
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

// Count matches on distinctive query tokens only (generic common nouns excluded). Used to
// gate the current-news lane so a lone generic word can't qualify an unrelated story.
function distinctiveMatchCount(queryTokens: Set<string>, value: string) {
  const valueTokens = tokenSet(value)
  let matches = 0
  for (const token of queryTokens) {
    if (!RESEARCH_GENERIC_TOKENS.has(token) && valueTokens.has(token)) matches += 1
  }
  return matches
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
      priority: "site",
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
      priority: "crawler",
      score: sourceMatches ? baseScore + scoreText(queryTokens, sourceText, 8) + mainstreamComparatorPenalty(source.url, source.outlet) : 0,
    })
  }

  return links
}

function worldwireLink(item: WorldwireItem, queryTokens: Set<string>): ResearchLink {
  const itemText = `${item.title} ${item.excerpt || ""} ${item.sectionTitle} ${item.source || ""}`
  // Require a distinctive token match, not just any overlap, so a lone generic word like
  // "forest" can't attach an unrelated current-news item to a specific research subject.
  const distinctiveMatches = distinctiveMatchCount(queryTokens, itemText)
  return {
    title: item.title,
    url: item.url,
    source: item.source || item.sectionTitle,
    excerpt: item.excerpt,
    priority: "crawler",
    score: distinctiveMatches ? scoreText(queryTokens, itemText, item.score / 20) + mainstreamComparatorPenalty(item.url, item.source) : 0,
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
      priority: "primary",
      score: documentMatches ? scoreText(queryTokens, documentText, 18) : 0,
    }
  })
}

function sourceSeedLink(queryTokens: Set<string>) {
  return researchSourceSeeds.map<ResearchLink>((seed) => {
    const seedText = `${seed.title} ${seed.source} ${seed.summary} ${seed.tags.join(" ")}`
    const seedMatches = matchingTokenCount(queryTokens, seedText)
    return {
      title: seed.title,
      url: seed.url,
      source: seed.source,
      excerpt: seed.summary,
      priority: seed.priority,
      score: seedMatches ? scoreText(queryTokens, seedText, priorityBoost(seed.priority)) : 0,
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
  const queryTokens = queryTokenSet(message)
  const [dossiers, worldwire] = await Promise.all([
    fetchRecursivClaimDossiers({ limit: 36 }).catch(() => []),
    fetchRecursivWorldwireItems({ limitPerLane: 8 }).catch(() => []),
  ])
  const links = uniqueLinks([
    ...((dossiers || []) as ClaimDossier[]).flatMap((dossier) => dossierLinks(dossier, queryTokens)),
    ...((worldwire || []) as WorldwireItem[]).map((item) => worldwireLink(item, queryTokens)),
    ...documentLink(queryTokens),
    ...sourceSeedLink(queryTokens),
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

function linkSourceLabel(link: ResearchLink) {
  return link.source || linkHost(link.url) || "source"
}

function linkBullet(link: ResearchLink) {
  const suffix = [linkSourceLabel(link), link.excerpt?.replace(/\s+/g, " ").trim().slice(0, 180)].filter(Boolean).join(" - ")
  return `- ${markdownLink(link.title, link.url)}${suffix ? ` - ${suffix}` : ""}`
}

function sourceGroups(links: ResearchLink[]) {
  return {
    primary: links.filter((link) => link.priority === "primary" || link.priority === "archive").slice(0, 4),
    independent: links.filter((link) => link.priority === "independent" || link.priority === "alternative").slice(0, 5),
    current: links.filter((link) => link.priority === "crawler" || link.priority === "site").slice(0, 4),
  }
}

function knownTopicDirectRead(message: string) {
  const normalized = normalizeTokenText(message)
  if (/\b911\b/.test(normalized)) {
    return [
      "The useful way to approach 9/11 is not as one giant yes/no conspiracy claim. It is a stack of separate questions: the official timeline, intelligence foreknowledge, Saudi and foreign-government contacts, aviation/security failures, the collapse explanations for the towers and Building 7, media behavior on the day, and the way the attacks were used to justify war and surveillance.",
      "The official baseline is the 9/11 Commission, NIST, and FBI record. The serious skeptical lane asks whether those records fully explain foreknowledge, institutional failure, WTC 7, financial/intelligence anomalies, and the speed with which the post-9/11 security state was built. Strong research keeps those lanes separate instead of pretending every alternative claim has the same evidentiary weight.",
    ].join("\n\n")
  }

  if (/\b(ufo|uap|aliens?|disclosure|non human|nonhuman)\b/.test(normalized)) {
    return [
      "The grounded answer is that the UAP record contains real government admissions, sensor/witness cases, classified-program questions, and unresolved provenance gaps. That does not automatically prove a single alien explanation, but it does prove the old dismissal posture was false.",
      "The strongest lane starts with official releases, congressional testimony, FOIA archives, and named witnesses; the speculative lane starts when people jump from unexplained sightings to specific claims about origin, treaties, bases, or bodies without documents or chain of custody.",
    ].join("\n\n")
  }

  if (/\b(mkultra|mind control|cia experiments?|behavioral modification)\b/.test(normalized)) {
    return [
      "MKULTRA is not just a theory. The documented core is that the CIA funded covert behavioral-modification experiments, including drugs, psychological manipulation, front organizations, and unwitting subjects. The open question is how much of the destroyed or still-withheld record connects to later programs, contractors, prisons, cult networks, or domestic operations.",
      "Treat the declassified CIA record as the floor, not the ceiling: it establishes capability and intent, while broader claims still need named programs, documents, witnesses, budgets, and custody trails.",
    ].join("\n\n")
  }

  if (/\b(epstein|maxwell|sex trafficking|island|blackmail)\b/.test(normalized)) {
    return [
      "The documented Epstein story is already institutional: trafficking convictions, elite social proximity, sweetheart treatment, missing or withheld records, and unresolved questions around money, intelligence contacts, surveillance, and who was protected.",
      "The responsible research line is to separate court-proven conduct from blackmail-network allegations, then follow flight logs, depositions, financial records, address books, immunity decisions, and document redactions.",
    ].join("\n\n")
  }

  if (/\b(jfk|kennedy assassination|oswald|grassy knoll)\b/.test(normalized)) {
    return [
      "The JFK case is a primary-record problem before it is a theory problem. The official lone-gunman conclusion sits against decades of withheld files, intelligence contacts around Oswald, witness conflicts, chain-of-custody disputes, and repeated institutional resistance to full disclosure.",
      "A serious answer starts with the Warren Commission and later congressional record, then tests the strongest dissenting claims against released CIA/FBI files, medical evidence, ballistics, witness timelines, and still-redacted material.",
    ].join("\n\n")
  }

  return ""
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

type ResearchTurn = { role: "user" | "assistant"; text: string }

// Recursiv's chat does NOT thread history across calls (verified: a fact stated in turn 1 is
// not remembered in turn 2 of the same conversation_id). So multi-turn context must be supplied
// in the prompt. The client sends recent turns; bound them hard (count + length + total).
function parseResearchHistory(value: unknown): ResearchTurn[] {
  if (!Array.isArray(value)) return []
  const turns: ResearchTurn[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const role = (item as { role?: unknown }).role
    const raw = (item as { text?: unknown; content?: unknown }).text ?? (item as { content?: unknown }).content
    if ((role !== "user" && role !== "assistant") || typeof raw !== "string") continue
    const text = raw.replace(/\s+/g, " ").trim().slice(0, 800)
    if (text) turns.push({ role, text })
  }
  return turns.slice(-6)
}

async function askResearchAgent(
  message: string,
  conversationId: string | undefined,
  links: ResearchLink[],
  history: ResearchTurn[] = [],
) {
  const { sdk, config } = createRecursivServerClient({ timeout: 120000, allowDeveloperApiKey: true })
  if (!config.agentId) return null
  const agentId = config.agentId

  const prompt = [
    "You are the Inverted World research analyst: a sharp, well-read, genuinely intelligent investigator. Think like a top research analyst and adapt your answer to the actual question instead of forcing a fixed template.",
    `Standing research doctrine (apply its spirit, not as a rigid format):\n${researchDoctrineMarkdown()}`,
    "Match your response to the question type:",
    "- Simple or factual questions: answer directly and concisely. A one-line question deserves a short answer, not a five-section report.",
    "- Instructional or explanatory questions (how something works, definitions, code, math): explain clearly and accurately like a knowledgeable teacher, with no skeptical or conspiracy framing where it does not belong.",
    "- Creative or conversational requests (write a poem, brainstorm, chat): just do them naturally and well.",
    "- Investigative, contested, historical, or hidden-power topics (disclosure, institutions, suppressed records, anomalous evidence): THIS is where you bring the full treatment — separate what is documented vs alleged vs inferred vs speculation, prioritize primary records, name sources, and track incentives and who benefits.",
    "Only use structured sections such as `## Direct answer`, `## What is documented`, `## Serious skeptical lanes`, `## Source trail`, and `## What would change the answer` when the topic actually warrants an evidence map. Never impose them on simple, factual, instructional, or creative questions.",
    "Always lead with the substance of the answer. Never open with process, protocol, disclaimers, or meta commentary about how you would research it. Never start with phrases like 'Research frame', 'Truth protocol', 'I would treat', or 'Start by treating'.",
    "When sources matter: prioritize primary records, declassified archives, court files, transcripts, longform independent media, alternative-media archives, and named witnesses; treat mainstream outlets as official-narrative comparators unless they carry a primary admission, named witness, leaked document, or useful timeline. Use Markdown links for any URL you cite, and do not return HTML.",
    "Do not cite unrelated Inverted World sources just because they are provided. If a provided source is not relevant to the question, ignore it. Do not invent certainty or citations.",
    links.length ? `Possibly-relevant Inverted World source context (use only if genuinely relevant):\n${contextLines(links)}` : "",
    history.length
      ? `Earlier in this conversation (oldest first) — use it to resolve references like "it" or "that" in the new question:\n${history
          .map((turn) => `${turn.role === "user" ? "User" : "You"}: ${turn.text}`)
          .join("\n")}`
      : "",
    `New question: ${message}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  // A Recursiv conversation_id is a bare UUID the server issued. The chat sends its OWN
  // client-generated id (e.g. "research-<uuid>") on the very first message, and asking the
  // agent to CONTINUE a conversation it never created errors instantly -> fallback every time.
  // So only continue when the id looks like a Recursiv UUID; otherwise start a fresh
  // conversation and return the real id for the client to reuse on follow-ups.
  const recursivConversationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const continueId = conversationId && recursivConversationId.test(conversationId) ? conversationId : undefined

  const callAgent = (cid: string | undefined) =>
    sdk.agents.chatStreamText(agentId, {
      message: prompt,
      conversation_id: cid,
      new_conversation: !cid,
    })

  let response
  try {
    response = await callAgent(continueId)
  } catch (error) {
    // Continuing an existing conversation failed (invalid/expired/unknown id) — don't drop
    // straight to the fallback; retry once as a brand-new conversation.
    if (!continueId) throw error
    response = await callAgent(undefined)
  }
  const content = String(response.content || "").trim()
  if (!content) return null

  return {
    content,
    conversationId: response.conversationId || continueId,
  }
}

function isWeakResearchAnswer(content: string) {
  const text = content.replace(/\s+/g, " ").trim()
  const lower = text.toLowerCase()
  // No length floor: a crisp short answer (e.g. "Paris.") is correct, not weak. Only reject
  // empty output and the specific meta/process preambles we never want to surface.
  if (!text) return true
  if (lower.includes("research frame:")) return true
  if (lower.includes("truth protocol")) return true
  if (lower.startsWith("start by treating")) return true
  if (lower.startsWith("i would treat")) return true
  if (lower.includes("relevant source trail") && lower.includes("what would move the answer") && !lower.includes("direct answer")) return true
  return false
}

// Fires only when the live research agent is unreachable (timeout/error/rate-limit). Degrade
// honestly: give the curated read for known topics if we have one, surface any genuinely
// relevant local sources, and say plainly that the engine could not be reached. No invented
// conspiracy boilerplate or forced section template.
function fallbackResearchAnswer(message: string, links: ResearchLink[]) {
  const knownRead = knownTopicDirectRead(message)
  const groups = sourceGroups(links)
  const sourceLines = [
    ...groups.primary.map(linkBullet),
    ...groups.independent.map(linkBullet),
    ...groups.current.map(linkBullet),
  ].slice(0, 9)

  if (knownRead) {
    return [knownRead, sourceLines.length ? `## Source trail\n${sourceLines.join("\n")}` : ""].filter(Boolean).join("\n\n")
  }

  // Agent-unreachable case: keep it clean. Don't append a "Related sources" list — during a
  // failure those local links are often only loosely related and read like a wrong answer.
  return "The live research engine is busy or unreachable right now, so I can't give a full answer to this one. Please try again in a moment."
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
    history?: unknown
  }>(request, RESEARCH_BODY_LIMIT_BYTES)
  if (!parsedBody.ok) return parsedBody.response

  const message = trimMessage(parsedBody.body.message)
  const conversationId = normalizeConversationId(parsedBody.body.conversationId)
  const history = parseResearchHistory(parsedBody.body.history)
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
  const agentAnswer = await askResearchAgent(message, conversationId, links, history).catch(() => null)
  const responseText =
    agentAnswer?.content && !isWeakResearchAnswer(agentAnswer.content) ? agentAnswer.content : fallbackResearchAnswer(message, links)

  return NextResponse.json({
    conversationId: agentAnswer?.conversationId || fallbackConversationId(conversationId),
    response: responseText,
    mode: agentAnswer?.content && !isWeakResearchAnswer(agentAnswer.content) ? "agent" : "context-fallback",
    linkCount: links.length,
  })
}
