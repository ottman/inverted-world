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
  bodySource?: "agent" | "synth" // "agent" = model-written; "synth" = built from coverage (interim)
  imageQuery?: string // AI-crafted visual search terms for a rights-cleared image
  image?: RightsClearedImage // rights-cleared (CC/PD) image via Openverse
  imageChecked?: boolean // a relevance-scored image lookup has been attempted (don't retry forever)
  // The actual outlets + their headlines covering this story (newsapi.ai event articles):
  coveringArticles?: CoveringArticle[]
  // "lane" distinguishes the mainstream "everyone's covering" set from the under-covered fringe set.
  lane?: "top" | "fringe"
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

// ── "What nobody's talking about": stories MAINSTREAM media isn't covering ───────────────────────
// The defining signal is mainstream-absence, not topic. We discover recent clustered stories with a
// genuine (independent/social) footprint but LOW total coverage — big legacy outlets blanket a story
// with hundreds of articles, so a low count is a cheap proxy for "the majors aren't on it" — sorted
// by social engagement so it's what people are actually sharing. The covering-outlet mix is then
// checked downstream (see mainstreamCoverageCount) to drop anything the majors did pick up.

// Major legacy / wire outlets. If several of these are covering a story, mainstream IS talking.
const MAINSTREAM_OUTLET_PATTERN =
  /\b(reuters|associated press|ap news|apnews|new york times|nytimes|washington post|washingtonpost|wall street journal|wsj|bbc|cnn|nbc news|msnbc|abc news|cbs news|npr|pbs|the guardian|bloomberg|politico|the hill|usa today|fox news|foxnews|time magazine|newsweek|forbes|axios|cnbc|los angeles times|la times|financial times|the economist|sky news|al jazeera|the independent|the telegraph|daily mail|mail online|huffpost|huffington post|business insider|vox|the atlantic|vanity fair|the new yorker|national review|reuters)\b/i

export function mainstreamCoverageCount(story: StoryCluster): number {
  const seen = new Set<string>()
  for (const article of story.coveringArticles || []) {
    const outlet = (article.outlet || "").toLowerCase()
    if (MAINSTREAM_OUTLET_PATTERN.test(outlet)) seen.add(outlet.replace(/\s+/g, " ").trim())
  }
  return seen.size
}

// True when big legacy outlets are essentially absent from a story's coverage — i.e. "nobody [in
// the mainstream] is talking about it."
export function isMainstreamAbsent(story: StoryCluster, maxMainstream = 1): boolean {
  return mainstreamCoverageCount(story) <= maxMainstream
}

// The Inverted World beat: subjects the establishment press chronically under-covers. Discovery is
// anchored on these concept URIs (so stories are substantive and on-brand, not random local news),
// then gated on a beat term in the TITLE/SUMMARY, then — the user's defining criterion — checked for
// mainstream-absence downstream (mainstreamCoverageCount) so only stories the majors skipped remain.
// Event Registry caps concept filters at 10 for this subscription tier — keep the highest-signal.
const FRINGE_CONCEPT_URIS = [
  "http://en.wikipedia.org/wiki/Unidentified_flying_object",
  "http://en.wikipedia.org/wiki/Extraterrestrial_life",
  "http://en.wikipedia.org/wiki/Area_51",
  "http://en.wikipedia.org/wiki/Roswell_incident",
  "http://en.wikipedia.org/wiki/Jeffrey_Epstein",
  "http://en.wikipedia.org/wiki/Bigfoot",
  "http://en.wikipedia.org/wiki/Loch_Ness_Monster",
  "http://en.wikipedia.org/wiki/Paranormal",
  "http://en.wikipedia.org/wiki/Mass_surveillance",
  "http://en.wikipedia.org/wiki/Whistleblower",
]

const FRINGE_TITLE_PATTERN =
  /\b(ufo|uap|u\.f\.o|alien|extraterrestrial|flying object|roswell|area 51|epstein|maxwell|ghislaine|declassif(?:y|ied|ication)|deep state|men in black|non-?human|tic[ -]?tac|pentagon ufo|aaro|aatip|grusch|disclosure|secret program|black project|cryptid|bigfoot|sasquatch|loch ness|crop circle|paranormal|poltergeist|haunt(?:ed|ing)|remote viewing|mk[- ]?ultra|mind control|false flag|cover-?up|whistleblow|mass surveillance|censorship|psyop|cia|nsa)\b/i

// Beat terms also match entertainment ("Alien action film", "superhero" movies); drop those.
const FRINGE_EXCLUDE_PATTERN =
  /\b(film|movie|trailer|box office|sequel|prequel|superhero|web series|tv series|season \d|episode|album|single|song|actor|actress|bollywood|hollywood|netflix|premiere|red carpet|casting|biopic)\b/i

export async function fetchFringeEvents(options: { limit?: number; sinceDays?: number; maxArticles?: number } = {}): Promise<StoryCluster[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY
  if (!apiKey) return []
  const limit = Math.max(1, Math.min(options.limit ?? 24, 80))
  const sinceDays = Math.max(1, Math.min(options.sinceDays ?? 14, 45))
  // Mainstream blankets big stories with hundreds of articles; cap so we surface what the majors
  // aren't saturating. (A precise covering-outlet check happens after coverage is fetched.)
  const maxArticles = Math.max(6, options.maxArticles ?? 90)
  const dateStart = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const stories: StoryCluster[] = []
  const seen = new Set<string>()
  // Paginate (Event Registry caps at 50/page); over-fetch since the gates prune heavily.
  for (let page = 1; page <= 4 && stories.length < limit * 2; page += 1) {
    let response: Response
    try {
      response = await fetch(NEWSAPI_AI_EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "getEvents",
          resultType: "events",
          conceptUri: FRINGE_CONCEPT_URIS,
          conceptOper: "or",
          eventsSortBy: "date",
          eventsCount: NEWSAPI_EVENTS_PAGE_SIZE,
          eventsPage: page,
          lang: "eng",
          dateStart,
          minArticlesInEvent: 3,
          includeEventConcepts: true,
          includeEventSummary: true,
          eventImageCount: 1,
          apiKey,
        }),
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 1800 },
      })
    } catch {
      break
    }
    if (!response.ok) break
    const data = (await response.json().catch(() => null)) as { events?: { results?: RawEvent[] } } | null
    const events = data?.events?.results || []
    if (!events.length) break

    for (const event of events) {
      if (stories.length >= limit * 2) break
      const title = engText(event.title)
      const summary = engText(event.summary)
      const articleCount = event.totalArticleCount || 0
      if (articleCount > maxArticles) continue // mainstream-saturated → not "nobody's talking about"
      if (!FRINGE_TITLE_PATTERN.test(`${title} ${summary}`)) continue // on the beat, not a stray tag
      if (FRINGE_EXCLUDE_PATTERN.test(title)) continue // not film/TV/celebrity that merely matched
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
        articleCount,
        concepts,
        eventDate: event.eventDate,
        imageUrl: Array.isArray(event.images) ? event.images[0] : undefined,
        lane: "fringe",
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
const NARRATIVE_CONCURRENCY = 2
// The agent emits this when the account's daily response quota is spent; it isn't JSON, so treat it
// as a hard stop for the run instead of parsing it as a body.
const AGENT_LIMIT_SENTINEL = /daily response limit|Upgrade for higher limits/i

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

// Cheap one-shot probe: is the agent's daily response quota currently available? Used to skip the
// (newsapi-token-spending) self-heal repair pass when the agent would just return the limit notice.
export async function agentQuotaAvailable(): Promise<boolean> {
  let client
  try {
    client = createRecursivServerClient({ timeout: 30000, allowDeveloperApiKey: true })
  } catch {
    return false
  }
  const agentId = client.config.agentId
  if (!agentId) return false
  try {
    const response = await client.sdk.agents.chatStreamText(agentId, { message: "Reply with: ok", new_conversation: true })
    return !AGENT_LIMIT_SENTINEL.test(String(response.content || ""))
  } catch {
    return false
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
  // Once the agent reports its daily response limit, every further call returns the same notice
  // (not JSON) — so we stop calling and let the rest fall back, rather than burning the budget and
  // overwriting nothing useful. The hourly job self-heals these on a later run when quota returns.
  let quotaExhausted = false
  // Retry thrown calls with exponential backoff so a transiently-throttled call waits its turn.
  const callAgent = async (chunk: StoryCluster[], attempt = 0): Promise<string | null> => {
    try {
      const response = await sdk.agents.chatStreamText(resolvedAgentId, {
        message: buildNarrativePrompt(chunk),
        new_conversation: true,
      })
      return String(response.content || "")
    } catch {
      if (attempt >= 4) return null
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1) * (attempt + 1)))
      return callAgent(chunk, attempt + 1)
    }
  }
  const runChunk = async (chunk: StoryCluster[]): Promise<void> => {
    if (quotaExhausted) return
    const content = await callAgent(chunk)
    if (content && AGENT_LIMIT_SENTINEL.test(content)) {
      quotaExhausted = true
      return
    }
    if (content) parseNarrativeRows(content, byId)
    // Any story the chunk didn't yield (truncated/invalid JSON) gets a single-story retry — small
    // enough that the body can't overflow the output budget.
    const missing = chunk.filter((story) => !byId.has(story.uri))
    if (missing.length && chunk.length > 1 && !quotaExhausted) {
      for (const story of missing) {
        if (quotaExhausted) break
        await runChunk([story])
        if (!byId.has(story.uri)) await runChunk([story]) // one extra single-story attempt
      }
    }
  }
  await mapWithConcurrency(chunks, NARRATIVE_CONCURRENCY, (chunk) => runChunk(chunk))

  return stories.map((story) => {
    const gen = byId.get(story.uri)
    // Prefer the model-written body; otherwise synthesize a full, complete article from the event
    // summary + the outlets covering it, so the story never renders as a stub that "cuts off" a few
    // lines in. `bodySource` lets the self-heal step know to upgrade synth → agent when quota returns.
    const agentBody = gen?.body && gen.body.length >= 400 ? gen.body : ""
    return {
      ...story,
      headline: gen?.headline || story.title,
      synopsis: gen?.synopsis || story.summary,
      body: agentBody || buildSynthesizedBody(story, gen?.synopsis),
      bodySource: agentBody ? ("agent" as const) : ("synth" as const),
      imageQuery: gen?.imageQuery || story.concepts.slice(0, 2).join(" "),
    }
  })
}

// Build a complete, neutral synopsis article from data we already have (event summary + the outlets
// covering the story and their headlines) — used when the agent is unavailable (e.g. its daily quota
// is spent). It reads as a real multi-paragraph article, attributes framing to specific named
// outlets (which the detail page linkifies), and always ends cleanly. Self-heal later replaces it.
export function buildSynthesizedBody(story: StoryCluster, leadOverride?: string): string {
  const lead = (leadOverride || story.summary || story.title || "").trim()
  const covering = (story.coveringArticles || []).filter((article) => article.outlet && article.headline)
  const paragraphs: string[] = []

  if (lead) paragraphs.push(lead)

  if (covering.length) {
    const count = story.articleCount || covering.length
    paragraphs.push(
      `The story is being covered by ${count.toLocaleString()} outlet${count === 1 ? "" : "s"} across the spectrum. ` +
        `${covering[0].outlet} reported “${trimHeadline(covering[0].headline)}.”` +
        (covering[1] ? ` ${covering[1].outlet} framed it as “${trimHeadline(covering[1].headline)}.”` : ""),
    )

    // Weave the remaining outlets' framings, a few per paragraph, varying the verbs.
    const verbs = ["reported", "noted", "described it as", "led with", "highlighted", "characterized it as"]
    const rest = covering.slice(2, 12)
    for (let index = 0; index < rest.length; index += 2) {
      const pair = rest.slice(index, index + 2)
      const sentence = pair
        .map((article, offset) => {
          const verb = verbs[(index + offset) % verbs.length]
          return `${article.outlet} ${verb} “${trimHeadline(article.headline)}.”`
        })
        .join(" ")
      paragraphs.push(sentence)
    }

    const topics = story.concepts.slice(0, 4).join(", ")
    paragraphs.push(
      `Coverage spans ${count.toLocaleString()} outlet${count === 1 ? "" : "s"}${topics ? `, touching on ${topics}` : ""}. ` +
        `Reporting continues to develop; this summary draws on how the participating outlets are currently framing the story.`,
    )
  } else if (story.concepts.length) {
    paragraphs.push(
      `This developing story relates to ${story.concepts.slice(0, 4).join(", ")}. ` +
        `Additional sourced detail is being compiled as more outlets weigh in.`,
    )
  }

  return paragraphs.filter(Boolean).join("\n\n")
}

function trimHeadline(headline: string): string {
  const clean = headline.replace(/\s+/g, " ").replace(/["“”]+/g, "").trim()
  return clean.length > 160 ? `${clean.slice(0, 157).trim()}…` : clean
}

type TopStoriesRow = { items?: unknown }

// ── Read (for /news rendering) ─────────────────────────────────────────────────────────────────
async function fetchStorySnapshot(source: string, limit: number): Promise<StoryCluster[]> {
  const rows = await queryInvertedWorldDatabase<TopStoriesRow>(
    `SELECT items FROM coverage_snapshots
     WHERE source = $1
     ORDER BY captured_at DESC, created_at DESC
     LIMIT 1`,
    [source],
  )
  const raw = rows?.[0]?.items
  const items = typeof raw === "string" ? safeParseStories(raw) : Array.isArray(raw) ? (raw as StoryCluster[]) : []
  return items.filter((story) => story && story.uri && (story.headline || story.title)).slice(0, limit)
}

// Mainstream "What everyone's talking about" set.
export async function fetchRecursivTopStories(options: { limit?: number } = {}): Promise<StoryCluster[]> {
  return fetchStorySnapshot("top-stories", Math.max(1, Math.min(options.limit ?? 12, 250)))
}

// Under-covered "What nobody's talking about" set.
export async function fetchRecursivFringeStories(options: { limit?: number } = {}): Promise<StoryCluster[]> {
  const stories = await fetchStorySnapshot("fringe-stories", Math.max(1, Math.min(options.limit ?? 24, 120)))
  return stories.map((story) => ({ ...story, lane: "fringe" as const }))
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
// Read a single stored story cluster by its event uri (for the detail page). Checks both the
// mainstream and the fringe sets so every card — from either /news section — has a working page.
export async function fetchRecursivTopStory(id: string): Promise<StoryCluster | null> {
  const [top, fringe] = await Promise.all([
    fetchRecursivTopStories({ limit: 250 }),
    fetchRecursivFringeStories({ limit: 120 }).catch(() => [] as StoryCluster[]),
  ])
  return top.find((story) => story.uri === id) || fringe.find((story) => story.uri === id) || null
}
