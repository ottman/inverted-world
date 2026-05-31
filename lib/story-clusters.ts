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

// An embedded video (a YouTube clip validated via keyless oEmbed) shown inside a tale article.
export type StoryVideo = {
  id: string // YouTube video id
  title?: string // from oEmbed
  author?: string // channel name, from oEmbed
  thumbnail?: string // from oEmbed
  query?: string // the search that surfaces this clip (fallback "watch on YouTube" link)
}

export type StoryCluster = {
  uri: string
  title: string
  summary: string
  articleCount: number
  socialScore?: number // Event Registry social-share weight — the "viral" signal (0 when unknown)
  concepts: string[]
  category?: string // top news category (e.g. "Politics", "World", "Sports") from Event Registry
  eventDate?: string
  imageUrl?: string
  // Enriched by the agent step (lib/story-clusters generation):
  headline?: string
  synopsis?: string // short, for cards
  body?: string // full neutral synopsis article, for the detail page
  bodySource?: "agent" | "synth" // "agent" = model-written; "synth" = built from coverage (interim)
  narrativeVersion?: number // which agent-prompt version wrote the body (for rolling out rewrites)
  imageQuery?: string // AI-crafted visual search terms for a rights-cleared image
  image?: RightsClearedImage // rights-cleared (CC/PD) image via Openverse
  imageChecked?: boolean // a relevance-scored image lookup has been attempted (don't retry forever)
  // The actual outlets + their headlines covering this story (newsapi.ai event articles).
  // For tales (lane === "tales") this holds the primary-source / proof links instead.
  coveringArticles?: CoveringArticle[]
  // Which themed set this story belongs to (mainstream, fringe, weird, comedy, pop, viral, tales).
  lane?: StoryLane
  // Evergreen "tales" extras (lane === "tales"): an embedded viral video, evergreen flag.
  video?: StoryVideo
  evergreen?: boolean // true for tales — an evergreen piece, not a rolling news cluster
}

export type StoryLane = "top" | "fringe" | "weird" | "comedy" | "pop" | "viral" | "tales"

type RawEvent = {
  uri?: string
  title?: Record<string, string> | string
  summary?: Record<string, string> | string
  totalArticleCount?: number
  socialScore?: number
  wgt?: number
  eventDate?: string
  images?: string[]
  concepts?: Array<{ label?: Record<string, string> }>
  categories?: Array<{ label?: string; wgt?: number }>
}

// Map Event Registry's verbose dmoz top-levels to clean news labels; news/* labels are already clean.
const CATEGORY_LABEL_MAP: Record<string, string> = {
  society: "World",
  business: "Business",
  science: "Science",
  sports: "Sports",
  arts: "Culture",
  health: "Health",
  recreation: "Lifestyle",
  computers: "Technology",
  shopping: "Business",
  home: "Lifestyle",
}

// Pick the single best human-readable category for a story. Prefer the highest-weight `news/*`
// label (Politics/Sports/Technology/…), else map the heaviest dmoz top-level to a clean name.
export function tidyCategoryLabel(label: string): string {
  const cleaned = label
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(And|Of|The|For|In|On)\b/g, (w) => w.toLowerCase())
  // Shorten a couple of long Event Registry leaves to crisp badge labels.
  if (/arts and entertainment/i.test(cleaned)) return "Entertainment"
  if (/^environment\b/i.test(cleaned)) return "Environment"
  return cleaned
}

function extractEventCategory(categories?: Array<{ label?: string; wgt?: number }>): string | undefined {
  if (!categories?.length) return undefined
  const byWeight = [...categories].sort((a, b) => (b.wgt || 0) - (a.wgt || 0))
  const news = byWeight.find((category) => /^news\//i.test(category.label || ""))
  if (news?.label) {
    const leaf = news.label.split("/").filter(Boolean).pop() || ""
    if (leaf) return tidyCategoryLabel(leaf)
  }
  const topLevel = (byWeight[0]?.label || "").split("/").filter(Boolean)[1]?.toLowerCase()
  if (topLevel) return CATEGORY_LABEL_MAP[topLevel] || tidyCategoryLabel(topLevel)
  return undefined
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
          includeEventCategories: true,
          includeEventSocialScore: true, // the "viral" signal used for strategic selection
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
        socialScore: typeof event.socialScore === "number" ? event.socialScore : undefined,
        concepts,
        category: extractEventCategory(event.categories),
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

// ── Strategic selection: spend the agent's (token-costly) body-writing on the stories that matter ──
// most to Inverted World — the most VIRAL and most ON-BRAND — instead of the first N by recency.
// Scoring is FREE: it only reads signals already on each event (social-share weight, coverage, and a
// keyword/concept match against the IW beat lexicon). No agent tokens are spent ranking.
const IW_RELEVANCE_PATTERN = new RegExp(FRINGE_TITLE_PATTERN.source, "gi")
const STRATEGIC_RELEVANCE_WEIGHT = Math.max(
  0,
  Math.min(Number(process.env.STRATEGIC_RELEVANCE_WEIGHT) || 0.55, 1),
)

// 0..1 — how on-brand a story is for Inverted World (distinct beat-term hits in title/summary/concepts).
export function scoreInvertedWorldRelevance(story: Pick<StoryCluster, "title" | "summary" | "concepts">): number {
  const hay = `${story.title || ""} ${story.summary || ""} ${(story.concepts || []).join(" ")}`.toLowerCase()
  const matches = hay.match(IW_RELEVANCE_PATTERN)
  const distinct = matches ? new Set(matches.map((m) => m.replace(/[\s.-]/g, ""))).size : 0
  return Math.min(1, distinct / 3) // 3+ distinct beat terms ⇒ fully on-brand
}

// 0..1 — viral footprint. Prefer social-share weight; fall back to coverage breadth (log-scaled so a
// handful of huge stories don't dwarf everything).
export function scoreVirality(story: Pick<StoryCluster, "socialScore" | "articleCount">): number {
  const social = story.socialScore || 0
  const coverage = story.articleCount || 0
  const s = social > 0 ? Math.min(1, Math.log10(social + 1) / 4) : 0 // ~10k social weight ⇒ 1.0
  const c = Math.min(1, Math.log10(coverage + 1) / 2.7) // ~500 articles ⇒ ~1.0
  return Math.max(s, c * 0.85)
}

// Combined priority: viral × on-brand. Higher = more deserving of the agent's body-writing this run.
export function scoreStrategicValue(story: StoryCluster): number {
  const relevance = scoreInvertedWorldRelevance(story)
  const virality = scoreVirality(story)
  return STRATEGIC_RELEVANCE_WEIGHT * relevance + (1 - STRATEGIC_RELEVANCE_WEIGHT) * virality
}

// Bias the top-stories candidate POOL toward Inverted World by pulling currently-clustered events that
// match the IW beat concepts, sorted by social engagement (the viral ones). Unlike the fringe lane,
// this does NOT require mainstream-absence — an on-brand story that IS getting coverage still belongs
// in the main feed. One extra getEvents call per run; merged into the broad pull, then ranked.
export async function fetchInvertedWorldRelevantEvents(options: { limit?: number; sinceDays?: number } = {}): Promise<StoryCluster[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY
  if (!apiKey) return []
  const limit = Math.max(1, Math.min(options.limit ?? 40, 80))
  const sinceDays = Math.max(1, Math.min(options.sinceDays ?? 3, 14))
  const dateStart = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const stories: StoryCluster[] = []
  const seen = new Set<string>()
  for (let page = 1; page <= 2 && stories.length < limit; page += 1) {
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
          eventsSortBy: "socialScore",
          eventsCount: NEWSAPI_EVENTS_PAGE_SIZE,
          eventsPage: page,
          lang: "eng",
          dateStart,
          minArticlesInEvent: 5,
          includeEventConcepts: true,
          includeEventSummary: true,
          includeEventCategories: true,
          includeEventSocialScore: true,
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
      const concepts = (event.concepts || []).map((concept) => engText(concept.label)).filter(Boolean).slice(0, 6)
      if (!event.uri || seen.has(event.uri) || !isQualityStory(title, summary, concepts)) continue
      if (FRINGE_EXCLUDE_PATTERN.test(`${title} ${summary}`)) continue
      seen.add(event.uri)
      stories.push({
        uri: event.uri,
        title,
        summary,
        articleCount: event.totalArticleCount || 0,
        socialScore: typeof event.socialScore === "number" ? event.socialScore : undefined,
        concepts,
        category: extractEventCategory(event.categories),
        eventDate: event.eventDate,
        imageUrl: Array.isArray(event.images) ? event.images[0] : undefined,
      })
    }
    if (events.length < NEWSAPI_EVENTS_PAGE_SIZE) break
  }
  return stories
}

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
          includeEventCategories: true,
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
        category: extractEventCategory(event.categories),
        eventDate: event.eventDate,
        imageUrl: Array.isArray(event.images) ? event.images[0] : undefined,
        lane: "fringe",
      })
    }
    if (events.length < NEWSAPI_EVENTS_PAGE_SIZE) break
  }
  return stories
}

// ── De-duplicate story clusters ──────────────────────────────────────────────────────────────
// newsapi.ai often emits SEVERAL event clusters for the same real-world story (different uris, so
// uri-dedup misses them) and the agent writes a different headline for each — so headline-word
// overlap alone is too weak. We combine three signals: identical headline, near-identical concept
// sets, and shared key concepts + some headline overlap. Keeps the first (newest) of each group.
const STORY_TITLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "from", "that", "this", "into", "over",
  "after", "before", "amid", "as", "at", "by", "in", "of", "on", "to", "up", "out", "off",
  "opinion", "watch", "live", "new", "first", "last", "rare", "set", "rises", "peaks", "is", "are",
  "his", "her", "its", "their", "they", "it", "he", "she", "will", "may", "says", "said",
])

function normalizedHeadline(story: StoryCluster): string {
  return (story.headline || story.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function titleSignatureWords(story: StoryCluster): Set<string> {
  const words = new Set<string>()
  for (const word of normalizedHeadline(story).split(/\s+/)) {
    if (word.length > 2 && !STORY_TITLE_STOPWORDS.has(word)) words.add(word)
  }
  return words
}

function conceptSet(story: StoryCluster): Set<string> {
  return new Set((story.concepts || []).map((concept) => concept.toLowerCase().trim()).filter(Boolean))
}

export function areSameStoryCluster(a: StoryCluster, b: StoryCluster): boolean {
  const ha = normalizedHeadline(a)
  const hb = normalizedHeadline(b)
  if (ha.length > 8 && ha === hb) return true // same headline (e.g. a syndicated op-ed)

  // Need ≥2 shared key entities AND meaningful headline overlap — concept overlap alone falsely
  // merges distinct stories that share small identical concept sets (e.g. two unrelated earnings
  // reports both tagged the same generic entities). Validated against live data: catches every real
  // duplicate (McGregor/Micromoon/syndicated op-eds/language-variant clusters) with no false merges.
  const ca = conceptSet(a)
  const cb = conceptSet(b)
  if (ca.size >= 2 && cb.size) {
    const shared = [...ca].filter((concept) => cb.has(concept)).length
    if (shared >= 2) {
      const union = new Set([...ca, ...cb]).size
      const jaccard = union ? shared / union : 0
      const wa = titleSignatureWords(a)
      const wb = titleSignatureWords(b)
      const wShared = [...wa].filter((word) => wb.has(word)).length
      const wRatio = Math.min(wa.size, wb.size) ? wShared / Math.min(wa.size, wb.size) : 0
      if (wRatio >= 0.4) return true // shared entities + strong headline overlap → same story
      if (jaccard >= 0.85 && wShared >= 2) return true // identical entity set + overlapping headline
    }
  }
  return false
}

export function dedupeNearDuplicateStories(stories: StoryCluster[], against: StoryCluster[] = []): StoryCluster[] {
  const kept: StoryCluster[] = [...against]
  const out: StoryCluster[] = []
  for (const story of stories) {
    if (!story?.uri) continue
    if (kept.some((other) => other.uri !== story.uri && areSameStoryCluster(other, story))) continue
    kept.push(story)
    out.push(story)
  }
  return out
}

// ── Themed sections: Weird / Comedy / Pop & Music / Viral ────────────────────────────────────────
// Each is a newsapi.ai query anchored on concept URIs (≤10 per the plan tier) and gated on a
// theme term in the TITLE/SUMMARY so a stray concept tag doesn't pull in off-topic news. Viral is
// the exception: it's broad and sorted by social engagement (what's actually being shared).
type ThemedConfig = {
  lane: StoryLane
  conceptUris?: string[]
  titlePattern?: RegExp
  excludePattern?: RegExp
  sortBy?: "date" | "socialScore" | "size"
  sinceDays?: number
  minArticles?: number
}

const WEIRD_CONFIG: ThemedConfig = {
  lane: "weird",
  conceptUris: [
    "http://en.wikipedia.org/wiki/Unidentified_flying_object",
    "http://en.wikipedia.org/wiki/Paranormal",
    "http://en.wikipedia.org/wiki/Ghost",
    "http://en.wikipedia.org/wiki/Bigfoot",
    "http://en.wikipedia.org/wiki/Loch_Ness_Monster",
    "http://en.wikipedia.org/wiki/Cryptozoology",
    "http://en.wikipedia.org/wiki/Extraterrestrial_life",
    "http://en.wikipedia.org/wiki/Supernatural",
  ],
  titlePattern:
    /\b(weird|bizarre|strange|mysterious|unexplained|oddity|odd|freak|uncanny|paranormal|ufo|uap|alien|extraterrestrial|cryptid|bigfoot|sasquatch|loch ness|ghost|haunt(?:ed|ing)|poltergeist|supernatural|inexplicable|baffl(?:e|ing)|eerie|creepy|anomaly)\b/i,
  sortBy: "date",
  sinceDays: 14,
}

const COMEDY_CONFIG: ThemedConfig = {
  lane: "comedy",
  conceptUris: [
    "http://en.wikipedia.org/wiki/Comedian",
    "http://en.wikipedia.org/wiki/Stand-up_comedy",
    "http://en.wikipedia.org/wiki/Comedy",
    "http://en.wikipedia.org/wiki/Satire",
    "http://en.wikipedia.org/wiki/Saturday_Night_Live",
    "http://en.wikipedia.org/wiki/Sitcom",
    "http://en.wikipedia.org/wiki/Sketch_comedy",
  ],
  titlePattern:
    /\b(comedy|comedian|comedic|stand-?up|satire|satirical|sketch|sitcom|snl|saturday night live|late-?night|roast|parody|jokes?|humou?r|improv|netflix special|funny)\b/i,
  sortBy: "date",
  sinceDays: 14,
}

const POP_CONFIG: ThemedConfig = {
  lane: "pop",
  conceptUris: [
    "http://en.wikipedia.org/wiki/Pop_music",
    "http://en.wikipedia.org/wiki/Music",
    "http://en.wikipedia.org/wiki/Album",
    "http://en.wikipedia.org/wiki/Concert",
    "http://en.wikipedia.org/wiki/Hip_hop_music",
    "http://en.wikipedia.org/wiki/Singing",
    "http://en.wikipedia.org/wiki/Music_industry",
    "http://en.wikipedia.org/wiki/Music_festival",
  ],
  titlePattern:
    /\b(music|musician|song|album|single|ep|mixtape|concert|tour|setlist|singer|band|rapper|pop star|chart|billboard|grammy|spotify|festival|headlin(?:e|er)|debut|track ?list|residency)\b/i,
  sortBy: "size",
  sinceDays: 12,
}

async function fetchThemedEvents(config: ThemedConfig, options: { limit?: number; sinceDays?: number } = {}): Promise<StoryCluster[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY
  if (!apiKey) return []
  const limit = Math.max(1, Math.min(options.limit ?? 24, 80))
  const sinceDays = Math.max(1, Math.min(options.sinceDays ?? config.sinceDays ?? 7, 30))
  const minArticles = Math.max(3, config.minArticles ?? 4)
  const dateStart = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const stories: StoryCluster[] = []
  const seen = new Set<string>()
  for (let page = 1; page <= 4 && stories.length < limit * 2; page += 1) {
    let response: Response
    try {
      response = await fetch(NEWSAPI_AI_EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "getEvents",
          resultType: "events",
          ...(config.conceptUris?.length ? { conceptUri: config.conceptUris, conceptOper: "or" } : {}),
          eventsSortBy: config.sortBy ?? "date",
          eventsCount: NEWSAPI_EVENTS_PAGE_SIZE,
          eventsPage: page,
          lang: "eng",
          dateStart,
          minArticlesInEvent: minArticles,
          includeEventConcepts: true,
          includeEventSummary: true,
          includeEventCategories: true,
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
      if (config.titlePattern && !config.titlePattern.test(`${title} ${summary}`)) continue
      if (config.excludePattern && config.excludePattern.test(title)) continue
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
        category: extractEventCategory(event.categories),
        eventDate: event.eventDate,
        imageUrl: Array.isArray(event.images) ? event.images[0] : undefined,
        lane: config.lane,
      })
    }
    if (events.length < NEWSAPI_EVENTS_PAGE_SIZE) break
  }
  return stories
}

export const fetchWeirdEvents = (options: { limit?: number; sinceDays?: number } = {}) => fetchThemedEvents(WEIRD_CONFIG, options)
export const fetchComedyEvents = (options: { limit?: number; sinceDays?: number } = {}) => fetchThemedEvents(COMEDY_CONFIG, options)
export const fetchPopMusicEvents = (options: { limit?: number; sinceDays?: number } = {}) => fetchThemedEvents(POP_CONFIG, options)
// Viral: broad, sorted by social engagement, recent — what's actually being shared right now.
export const fetchViralEvents = (options: { limit?: number; sinceDays?: number } = {}) =>
  fetchThemedEvents({ lane: "viral", sortBy: "socialScore", sinceDays: 4, minArticles: 5 }, options)

// Per-lane HEADLINE gate — stricter than the fetch-time title+summary gate (which let in stories
// that only mentioned the theme in their summary, e.g. a crash report tagged to a comedian). Applied
// at read so the displayed set is clean without re-fetching. Viral is intentionally unfiltered.
const THEME_HEADLINE_PATTERN: Record<ThemedLane, RegExp | null> = {
  weird: WEIRD_CONFIG.titlePattern ?? null,
  comedy: COMEDY_CONFIG.titlePattern ?? null,
  pop: POP_CONFIG.titlePattern ?? null,
  viral: null,
}

// Comedy headlines rarely contain a literal comedy word (they're comedian/show names), so for that
// lane we also accept a strong comedy CONCEPT tag — the real signal — not just the headline.
const COMEDY_CONCEPT_PATTERN = /\b(comedy|comedian|stand-?up|satire|saturday night live|sketch comedy|sitcom|humou?r)\b/i

export function keepThemedStory(lane: ThemedLane, story: StoryCluster): boolean {
  if (lane === "viral") return true
  const headline = `${story.headline || story.title}`
  const pattern = THEME_HEADLINE_PATTERN[lane]
  if (pattern && pattern.test(headline)) return true
  if (lane === "comedy") return (story.concepts || []).some((concept) => COMEDY_CONCEPT_PATTERN.test(concept))
  return false
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
// Bump when the agent prompt/voice changes so stored bodies written by an older prompt are treated
// as stale and re-written by the self-heal pass. v2 = original-journalism voice, no outlet citations.
export const NARRATIVE_VERSION = 2
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
    "You are a staff writer for Inverted World — an independent newsroom that reports straight but with an edge: skeptical of official narratives and press-release spin, willing to say plainly what the establishment press dances around, while staying rigorously factual.",
    "For EACH story below, write four things and return them as JSON:",
    '1) "headline": a sharp, compelling, factual headline with a point of view — never clickbait-false, never both-sides mush. Max ~90 characters.',
    '2) "synopsis": a punchy 2-sentence standfirst (deck) that makes the reader want in.',
    '3) "body": an ORIGINAL news article of 6 to 9 substantial paragraphs (~600-900 words), paragraphs separated by a blank line. Write it as your OWN reporting — a real article with a strong lead, narrative drive, and a distinct voice with an edge. Lead with what actually matters. Give the context the daily churn skips, name the tension or the thing nobody in power wants said, and be clear-eyed about what is confirmed versus alleged versus spin. Factual at all times — never invent quotes, numbers, or events.',
    "   CRITICAL on attribution: do NOT write like a wire aggregator. Do NOT cite news outlets by name, do NOT string together other outlets' headlines, and do NOT write phrases like \"Reuters reported\" or \"according to The Guardian.\" Write it as original prose. When you reference a source IN the body, reference only PRIMARY sources — the actual document, agency, official, court filing, dataset, or on-the-record statement — not secondary news coverage.",
    '4) "imageQuery": 2-4 concise, CONCRETE visual keywords for a relevant stock/public-domain photo (depict the subject, place, or object — NOT names of private individuals). E.g. "romanian apartment building", "military drone".',
    'Return ONLY a raw JSON array (no prose, no markdown fences): [{"id":"<id>","headline":"...","synopsis":"...","body":"...","imageQuery":"..."}]',
    "Stories:",
    stories
      .map((story) => {
        // Pass the existing coverage purely as background so the writer gets the facts right — it is
        // NOT to be cited or named in the article.
        const coverage = (story.coveringArticles || [])
          .slice(0, 12)
          .map((article) => `- ${article.headline}`)
          .join("\n")
        return `[${story.uri}]\nTITLE: ${story.title}\nSUMMARY: ${story.summary}\nTOPICS: ${story.concepts.join(", ")}${
          coverage ? `\nWHAT'S BEEN REPORTED (background only — get the facts from here, do NOT name or cite these sources):\n${coverage}` : ""
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
      narrativeVersion: agentBody ? NARRATIVE_VERSION : undefined,
      imageQuery: gen?.imageQuery || story.concepts.slice(0, 2).join(" "),
    }
  })
}

// Clean fallback used ONLY when the Recursiv agent is unavailable (daily quota spent): a short but
// COMPLETE neutral write-up from the event summary — trimmed to whole sentences so it never ends
// mid-word — plus one line of context. No outlet-headline citations (those read like a link dump and
// truncate badly). The agent's real article replaces this on the next self-heal pass.
export function buildSynthesizedBody(story: StoryCluster, leadOverride?: string): string {
  const lead = cleanToSentences(leadOverride || story.summary || story.title || "")
  const paragraphs: string[] = []
  if (lead) paragraphs.push(lead)
  const topics = story.concepts.slice(0, 4).filter(Boolean)
  const count = story.articleCount || (story.coveringArticles || []).length
  if (topics.length) {
    const scope = count ? ` It has drawn coverage across roughly ${count.toLocaleString()} report${count === 1 ? "" : "s"} so far.` : ""
    paragraphs.push(`The story centers on ${joinList(topics)}.${scope}`)
  }
  return paragraphs.filter(Boolean).join("\n\n")
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] || ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

// Trim text to a whole number of sentences (never mid-word/mid-sentence), so the event-summary lead
// in a fallback body always ends cleanly.
function cleanToSentences(text: string, max = 1100): string {
  let s = (text || "").replace(/\s+/g, " ").trim()
  if (!s) return ""
  if (s.length > max) s = s.slice(0, max)
  const idx = Math.max(s.lastIndexOf(". "), s.lastIndexOf("! "), s.lastIndexOf("? "))
  if (idx > 60) return s.slice(0, idx + 1).trim()
  if (!/[.!?]["”']?$/.test(s)) return s.replace(/\s+\S*$/, "").trim()
  return s.trim()
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

// Themed sets — Weird / Comedy / Pop & Music / Viral.
export const THEMED_STORY_SOURCES = {
  weird: "weird-stories",
  comedy: "comedy-stories",
  pop: "pop-stories",
  viral: "viral-stories",
} as const

export type ThemedLane = keyof typeof THEMED_STORY_SOURCES

export async function fetchRecursivThemedStories(lane: ThemedLane, options: { limit?: number } = {}): Promise<StoryCluster[]> {
  const stories = await fetchStorySnapshot(THEMED_STORY_SOURCES[lane], Math.max(1, Math.min(options.limit ?? 24, 120)))
  return stories.map((story) => ({ ...story, lane })).filter((story) => keepThemedStory(lane, story))
}

// Evergreen "Inverted World tales" set — UAP, cryptids, declassified files, ancient mysteries, etc.
// Generated once (not a rolling news sync), stored in its own source, merged into the /news feed.
export const TALES_STORY_SOURCE = "tales-stories"
export async function fetchRecursivTalesStories(options: { limit?: number } = {}): Promise<StoryCluster[]> {
  const stories = await fetchStorySnapshot(TALES_STORY_SOURCE, Math.max(1, Math.min(options.limit ?? 200, 400)))
  return stories.map((story) => ({ ...story, lane: "tales" as const, evergreen: true }))
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
  const sets = await Promise.all([
    fetchRecursivTopStories({ limit: 250 }),
    fetchRecursivTalesStories({ limit: 400 }).catch(() => [] as StoryCluster[]),
    fetchRecursivFringeStories({ limit: 120 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("weird", { limit: 80 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("comedy", { limit: 80 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("pop", { limit: 80 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("viral", { limit: 80 }).catch(() => [] as StoryCluster[]),
  ])
  for (const set of sets) {
    const found = set.find((story) => story.uri === id)
    if (found) return found
  }
  return null
}
