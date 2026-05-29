import { createRecursivServerClient } from "@/lib/recursiv/client"
import { queryInvertedWorldDatabase } from "@/lib/recursiv/database"
import type { RightsClearedImage } from "@/lib/openverse"

// Story clusters via newsapi.ai (Event Registry) "Events": each event is the same story
// clustered across many outlets, with a coverage count. We fetch recent significant events,
// filter spam/junk, and (elsewhere) have the agent write a viral-neutral headline + a balanced
// synopsis. No political bias rating here yet — that's a later layer.

const NEWSAPI_AI_EVENTS_ENDPOINT = "https://eventregistry.org/api/v1/event/getEvents"

// Event Registry clusters include spam/adult/SEO-junk "events"; drop anything that smells like it.
const STORY_SPAM_PATTERN =
  /\b(xnxx|xhamster|pornhub|porn|xxx|nude|onlyfans|escort|sex tape|sex video|leaked video|viral video|camgirl|casino|sportsbook|betting odds|crypto airdrop|giveaway)\b|[\uD800-\uDFFF]{2,}|🎡|💡/i

export type CoveringArticle = { outlet: string; headline: string; url: string }

export type StoryCluster = {
  uri: string
  title: string
  summary: string
  articleCount: number
  concepts: string[]
  eventDate?: string
  imageUrl?: string
  // Enriched by the agent step (lib/story-clusters generation):
  headline?: string
  synopsis?: string // short, for cards
  body?: string // full neutral synopsis article, for the detail page
  imageQuery?: string // AI-crafted visual search terms for a rights-cleared image
  image?: RightsClearedImage // rights-cleared (CC/PD) image via Openverse
  // The actual outlets + their headlines covering this story (newsapi.ai event articles):
  coveringArticles?: CoveringArticle[]
}

type RawEvent = {
  uri?: string
  title?: Record<string, string> | string
  summary?: Record<string, string> | string
  totalArticleCount?: number
  eventDate?: string
  images?: string[]
  concepts?: Array<{ label?: Record<string, string> }>
}

function engText(value: Record<string, string> | string | undefined): string {
  if (!value) return ""
  if (typeof value === "string") return value.trim()
  return (value.eng || Object.values(value)[0] || "").trim()
}

function isQualityStory(title: string, summary: string, concepts: string[]): boolean {
  if (title.length < 12) return false
  if (!concepts.length) return false
  if (STORY_SPAM_PATTERN.test(title) || STORY_SPAM_PATTERN.test(summary)) return false
  // Require mostly-latin title (drops foreign-script SEO spam that slipped past lang=eng).
  const latin = (title.match(/[a-zA-Z]/g) || []).length
  if (latin < title.length * 0.5) return false
  return true
}

// Fetch recent significant story clusters, newest-window first, filtered for quality. Event
// Registry rejects any getEvents call asking for more than 50 events, so we page at 50 and
// paginate until we have `limit` quality stories (supports the 10x story count) or run out.
const NEWSAPI_EVENTS_PAGE_SIZE = 50
const NEWSAPI_EVENTS_MAX_PAGES = 8

export async function fetchNewsApiEvents(options: { limit?: number; sinceDays?: number; minArticles?: number } = {}): Promise<StoryCluster[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY
  if (!apiKey) return []
  const limit = Math.max(1, Math.min(options.limit ?? 16, 250))
  const sinceDays = Math.max(1, Math.min(options.sinceDays ?? 2, 14))
  const minArticles = Math.max(5, options.minArticles ?? 25)
  const dateStart = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const maxPages = Math.min(NEWSAPI_EVENTS_MAX_PAGES, Math.ceil((limit * 2) / NEWSAPI_EVENTS_PAGE_SIZE) || 1)

  const stories: StoryCluster[] = []
  const seen = new Set<string>()
  for (let page = 1; page <= maxPages && stories.length < limit; page += 1) {
    let response: Response
    try {
      response = await fetch(NEWSAPI_AI_EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "getEvents",
          resultType: "events",
          eventsSortBy: "size",
          eventsCount: NEWSAPI_EVENTS_PAGE_SIZE,
          eventsPage: page,
          lang: "eng",
          dateStart,
          minArticlesInEvent: minArticles,
          includeEventConcepts: true,
          includeEventSummary: true,
          eventImageCount: 1,
          apiKey,
        }),
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 600 },
      })
    } catch {
      break
    }
    if (!response.ok) break
    const data = (await response.json().catch(() => null)) as { events?: { results?: RawEvent[] } } | null
    const events = data?.events?.results || []
    if (!events.length) break

    for (const event of events) {
      if (stories.length >= limit) break
      const title = engText(event.title)
      const summary = engText(event.summary)
      const concepts = (event.concepts || [])
        .map((concept) => engText(concept.label))
        .filter(Boolean)
        .slice(0, 6)
      if (!event.uri || seen.has(event.uri) || !isQualityStory(title, summary, concepts)) continue
      seen.add(event.uri)
      stories.push({
        uri: event.uri,
        title,
        summary,
        articleCount: event.totalArticleCount || 0,
        concepts,
        eventDate: event.eventDate,
        imageUrl: Array.isArray(event.images) ? event.images[0] : undefined,
      })
    }
    if (events.length < NEWSAPI_EVENTS_PAGE_SIZE) break
  }
  return stories
}

// Run an async mapper over items with a bounded number of concurrent workers. Used to keep large
// batches (10x stories) from hammering the agent / newsapi.ai / Openverse all at once.
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

// ── Agent: viral-but-neutral headline + balanced synopsis + full body per cluster ──────────────
// Batched in small chunks and run with bounded concurrency. Each story's body is ~600-900 words, so
// too many per call overflows the model's output budget and the JSON is truncated mid-array — which
// would drop the whole chunk back to bare event summaries. We keep chunks small AND, if a chunk
// returns fewer stories than asked (a sign of truncation), retry the missing ones one-at-a-time so a
// single oversized body can't take its neighbours down. Falls back to the event's own title/summary
// for any story the agent never returns.
const NARRATIVE_BATCH_SIZE = 3
const NARRATIVE_CONCURRENCY = 4

type StoryNarrative = { headline?: string; synopsis?: string; body?: string; imageQuery?: string }

function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "")
  const start = cleaned.indexOf("[")
  const end = cleaned.lastIndexOf("]")
  if (start < 0 || end < 0 || end < start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function buildNarrativePrompt(stories: StoryCluster[]): string {
  return [
    "You are a neutral newswire editor for a balanced news aggregator.",
    "For EACH story cluster below, write four things:",
    '1) "headline": a compelling, shareable, but STRICTLY NEUTRAL headline — factual, no partisan spin, no clickbait falsehoods, max ~90 characters.',
    '2) "synopsis": a balanced 2-sentence summary, neutral tone, for a card.',
    '3) "body": a full, in-depth neutral synopsis article of AT LEAST 6 and up to 10 substantial paragraphs (roughly 600-900 words). Separate the paragraphs with a blank line. Cover what happened, the context and background, the differing perspectives across outlets, and what remains unconfirmed. Factual and balanced, no editorializing.',
    "   IMPORTANT for the body: attribute specific facts and claims to the SPECIFIC named outlets covering the story (use the COVERAGE list provided). Write the outlet name in plain prose exactly as listed, e.g. \"Reuters reported...\", \"According to The Guardian,...\", \"BBC News noted...\". Spell each outlet's name out exactly as it appears in COVERAGE so it can be linked. Reference several different outlets across the political spectrum.",
    '4) "imageQuery": 2-4 concise, CONCRETE visual keywords for finding a relevant stock/public-domain photo (depict the subject, place, or object — NOT names of private individuals). E.g. "romanian apartment building", "drone military".',
    'Return ONLY a raw JSON array (no prose, no markdown fences): [{"id":"<id>","headline":"...","synopsis":"...","body":"...","imageQuery":"..."}]',
    "Story clusters:",
    stories
      .map((story) => {
        const coverage = (story.coveringArticles || [])
          .slice(0, 12)
          .map((article) => `- ${article.outlet}: ${article.headline}`)
          .join("\n")
        return `[${story.uri}]\nTITLE: ${story.title}\nSUMMARY: ${story.summary}\nTOPICS: ${story.concepts.join(", ")}${
          coverage ? `\nCOVERAGE (outlets + their headlines — attribute to these by name):\n${coverage}` : ""
        }`
      })
      .join("\n\n"),
  ].join("\n\n")
}

function parseNarrativeRows(content: string, into: Map<string, StoryNarrative>) {
  const parsed = extractJsonArray(content)
  if (!parsed) return
  for (const row of parsed) {
    if (row && typeof row === "object") {
      const r = row as { id?: unknown; headline?: unknown; synopsis?: unknown; body?: unknown; imageQuery?: unknown }
      if (typeof r.id === "string") {
        into.set(r.id, {
          headline: typeof r.headline === "string" ? r.headline.trim().slice(0, 200) : undefined,
          synopsis: typeof r.synopsis === "string" ? r.synopsis.trim().slice(0, 600) : undefined,
          body: typeof r.body === "string" ? r.body.trim().slice(0, 12000) : undefined,
          imageQuery: typeof r.imageQuery === "string" ? r.imageQuery.trim().slice(0, 80) : undefined,
        })
      }
    }
  }
}

export async function generateStoryNarratives(stories: StoryCluster[]): Promise<StoryCluster[]> {
  if (!stories.length) return stories
  let sdk
  let agentId: string | undefined
  try {
    const client = createRecursivServerClient({ timeout: 120000, allowDeveloperApiKey: true })
    sdk = client.sdk
    agentId = client.config.agentId
  } catch {
    return stories
  }
  if (!agentId) return stories
  const resolvedAgentId = agentId

  const chunks: StoryCluster[][] = []
  for (let offset = 0; offset < stories.length; offset += NARRATIVE_BATCH_SIZE) {
    chunks.push(stories.slice(offset, offset + NARRATIVE_BATCH_SIZE))
  }

  const byId = new Map<string, StoryNarrative>()
  const runChunk = async (chunk: StoryCluster[]): Promise<void> => {
    try {
      const response = await sdk.agents.chatStreamText(resolvedAgentId, {
        message: buildNarrativePrompt(chunk),
        new_conversation: true,
      })
      parseNarrativeRows(String(response.content || ""), byId)
    } catch {
      // fall through to the per-story retry below
    }
    // Any story the chunk didn't yield (truncated/invalid JSON, or the call threw) gets one
    // single-story retry — small enough that the body can't overflow the output budget.
    const missing = chunk.filter((story) => !byId.has(story.uri))
    if (missing.length && chunk.length > 1) {
      for (const story of missing) {
        await runChunk([story])
        if (!byId.has(story.uri)) await runChunk([story]) // one extra single-story attempt
      }
    }
  }
  await mapWithConcurrency(chunks, NARRATIVE_CONCURRENCY, (chunk) => runChunk(chunk))

  return stories.map((story) => {
    const gen = byId.get(story.uri)
    return {
      ...story,
      headline: gen?.headline || story.title,
      synopsis: gen?.synopsis || story.summary,
      body: gen?.body || gen?.synopsis || story.summary,
      imageQuery: gen?.imageQuery || story.concepts.slice(0, 2).join(" "),
    }
  })
}

type TopStoriesRow = { items?: unknown }

// ── Read (for /news rendering) ─────────────────────────────────────────────────────────────────
export async function fetchRecursivTopStories(options: { limit?: number } = {}): Promise<StoryCluster[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 12, 250))
  const rows = await queryInvertedWorldDatabase<TopStoriesRow>(
    `SELECT items FROM coverage_snapshots
     WHERE source = 'top-stories'
     ORDER BY captured_at DESC, created_at DESC
     LIMIT 1`,
  )
  const raw = rows?.[0]?.items
  const items = typeof raw === "string" ? safeParseStories(raw) : Array.isArray(raw) ? (raw as StoryCluster[]) : []
  return items.filter((story) => story && story.uri && (story.headline || story.title)).slice(0, limit)
}

function safeParseStories(value: string): StoryCluster[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as StoryCluster[]) : []
  } catch {
    return []
  }
}

// ── Coverage: who's covering a story (outlet + their actual headline) ──────────────────────────
const NEWSAPI_AI_EVENT_ENDPOINT = "https://eventregistry.org/api/v1/event/getEvent"

type EventArticleResult = { title?: string; url?: string; lang?: string; source?: { title?: string } }

export async function fetchEventCoverage(eventUri: string, limit = 18): Promise<CoveringArticle[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY
  if (!apiKey || !eventUri) return []
  let response: Response
  try {
    response = await fetch(NEWSAPI_AI_EVENT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "getEvent",
        eventUri,
        includeEventArticles: true,
        eventArticlesSortBy: "sourceImportance",
        eventArticlesCount: 60,
        resultType: "articles",
        apiKey,
      }),
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 600 },
    })
  } catch {
    return []
  }
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!data) return []
  const eventObj = data[eventUri] as { articles?: { results?: EventArticleResult[] } } | undefined
  const articles = eventObj?.articles?.results || []
  const seen = new Set<string>()
  const out: CoveringArticle[] = []
  for (const article of articles) {
    if (article.lang && article.lang !== "eng") continue
    const outlet = (article.source?.title || "").trim()
    const headline = (article.title || "").trim()
    const url = article.url || ""
    if (!outlet || !headline || !url || !url.startsWith("http")) continue
    const key = outlet.toLowerCase()
    if (seen.has(key)) continue // one headline per outlet
    seen.add(key)
    out.push({ outlet, headline, url })
    if (out.length >= limit) break
  }
  return out
}
// Read a single stored story cluster by its event uri (for the detail page).
export async function fetchRecursivTopStory(id: string): Promise<StoryCluster | null> {
  const stories = await fetchRecursivTopStories({ limit: 250 })
  return stories.find((story) => story.uri === id) || null
}
