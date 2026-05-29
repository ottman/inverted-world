import { createRecursivServerClient } from "@/lib/recursiv/client"
import { queryInvertedWorldDatabase } from "@/lib/recursiv/database"

// Story clusters via newsapi.ai (Event Registry) "Events": each event is the same story
// clustered across many outlets, with a coverage count. We fetch recent significant events,
// filter spam/junk, and (elsewhere) have the agent write a viral-neutral headline + a balanced
// synopsis. No political bias rating here yet — that's a later layer.

const NEWSAPI_AI_EVENTS_ENDPOINT = "https://eventregistry.org/api/v1/event/getEvents"

// Event Registry clusters include spam/adult/SEO-junk "events"; drop anything that smells like it.
const STORY_SPAM_PATTERN =
  /\b(xnxx|xhamster|pornhub|porn|xxx|nude|onlyfans|escort|sex tape|sex video|leaked video|viral video|camgirl|casino|sportsbook|betting odds|crypto airdrop|giveaway)\b|[\uD800-\uDFFF]{2,}|🎡|💡/i

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
  synopsis?: string
  // Filled when we fetch the cluster's coverage:
  outlets?: string[]
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

// Fetch recent significant story clusters, newest-window first, filtered for quality.
export async function fetchNewsApiEvents(options: { limit?: number; sinceDays?: number; minArticles?: number } = {}): Promise<StoryCluster[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY
  if (!apiKey) return []
  const limit = Math.max(1, Math.min(options.limit ?? 16, 50))
  const sinceDays = Math.max(1, Math.min(options.sinceDays ?? 2, 14))
  const minArticles = Math.max(5, options.minArticles ?? 25)
  const dateStart = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let response: Response
  try {
    response = await fetch(NEWSAPI_AI_EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "getEvents",
        resultType: "events",
        eventsSortBy: "size",
        eventsCount: Math.min(limit * 3, 100),
        lang: "eng",
        dateStart,
        minArticlesInEvent: minArticles,
        includeEventConcepts: true,
        includeEventSummary: true,
        eventImageCount: 1,
        apiKey,
      }),
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 600 },
    })
  } catch {
    return []
  }
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as { events?: { results?: RawEvent[] } } | null
  const events = data?.events?.results || []

  const stories: StoryCluster[] = []
  for (const event of events) {
    const title = engText(event.title)
    const summary = engText(event.summary)
    const concepts = (event.concepts || [])
      .map((concept) => engText(concept.label))
      .filter(Boolean)
      .slice(0, 6)
    if (!event.uri || !isQualityStory(title, summary, concepts)) continue
    stories.push({
      uri: event.uri,
      title,
      summary,
      articleCount: event.totalArticleCount || 0,
      concepts,
      eventDate: event.eventDate,
      imageUrl: Array.isArray(event.images) ? event.images[0] : undefined,
    })
    if (stories.length >= limit) break
  }
  return stories
}

// ── Agent: viral-but-neutral headline + balanced synopsis per cluster ──────────────────────────
// One batched agent call for all clusters (cheap + fast vs one call each). Returns the stories
// with `headline`/`synopsis` filled; falls back to the event's own title/summary on any failure.
function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[")
  const end = text.lastIndexOf("]")
  if (start < 0 || end < 0 || end < start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
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

  const prompt = [
    "You are a neutral newswire editor for a balanced news aggregator.",
    "For EACH story cluster below, write two things:",
    '1) "headline": a compelling, shareable, but STRICTLY NEUTRAL headline — factual, no partisan spin, no clickbait falsehoods, max ~90 characters.',
    '2) "synopsis": a balanced 2-sentence summary of what happened, neutral tone, no editorializing, drawn from the cluster.',
    'Return ONLY a raw JSON array (no prose, no markdown fences): [{"id":"<id>","headline":"...","synopsis":"..."}]',
    "Story clusters:",
    stories
      .map((story) => `[${story.uri}]\nTITLE: ${story.title}\nSUMMARY: ${story.summary}\nTOPICS: ${story.concepts.join(", ")}`)
      .join("\n\n"),
  ].join("\n\n")

  let content = ""
  try {
    const response = await sdk.agents.chatStreamText(agentId, { message: prompt, new_conversation: true })
    content = String(response.content || "")
  } catch {
    return stories
  }

  const parsed = extractJsonArray(content)
  if (!parsed) return stories
  const byId = new Map<string, { headline?: string; synopsis?: string }>()
  for (const row of parsed) {
    if (row && typeof row === "object") {
      const r = row as { id?: unknown; headline?: unknown; synopsis?: unknown }
      if (typeof r.id === "string") {
        byId.set(r.id, {
          headline: typeof r.headline === "string" ? r.headline.trim().slice(0, 200) : undefined,
          synopsis: typeof r.synopsis === "string" ? r.synopsis.trim().slice(0, 600) : undefined,
        })
      }
    }
  }
  return stories.map((story) => {
    const gen = byId.get(story.uri)
    return {
      ...story,
      headline: gen?.headline || story.title,
      synopsis: gen?.synopsis || story.summary,
    }
  })
}

type TopStoriesRow = { items?: unknown }

// ── Read (for /news rendering) ─────────────────────────────────────────────────────────────────
export async function fetchRecursivTopStories(options: { limit?: number } = {}): Promise<StoryCluster[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 12, 30))
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
