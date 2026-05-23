import type { Metadata } from "next"
import type React from "react"
import { ArrowUpRight, FileText, Gauge, Radio } from "lucide-react"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { topics } from "@/data/inverted-world"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import { fetchLiveArticlesByTopic } from "@/lib/live-articles"
import { fetchRecursivClaimDossiers, getLatestRecursivFrontPageEdition, type ClaimDossier, type ClaimSourceLink } from "@/lib/recursiv/content"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 300

export const metadata: Metadata = {
  title: "Breaking Source Board | Inverted World",
  description: "A fast outbound source board for world news, institutional shocks, strange science, crime, war, money, AI, and the Inverted World lanes.",
}

type WorldwireLane = {
  id: string
  title: string
  query: string
}

type NewsBoardItem = {
  id: string
  title: string
  url: string
  source: string
  sectionId: string
  sectionTitle: string
  score: number
  publishedAt?: string
  excerpt?: string
  contextHref?: string
  contextLabel?: string
}

const WORLDWIRE_LANES: WorldwireLane[] = [
  {
    id: "world",
    title: "World",
    query: "breaking world news crisis scandal leak emergency geopolitics",
  },
  {
    id: "war",
    title: "War",
    query: "war military attack border missiles intelligence defense escalation",
  },
  {
    id: "america",
    title: "America",
    query: "US politics courts congress election corruption investigation breaking",
  },
  {
    id: "money",
    title: "Money",
    query: "markets economy banks debt inflation crypto collapse fraud breaking",
  },
  {
    id: "tech-ai",
    title: "Tech / AI",
    query: "artificial intelligence surveillance cyberattack robots chips censorship",
  },
  {
    id: "science-space",
    title: "Science / Space",
    query: "NASA space anomaly asteroid volcano earthquake disease lab discovery",
  },
  {
    id: "crime-culture",
    title: "Crime / Culture",
    query: "crime media scandal culture celebrity police censorship trial",
  },
]

const HOT_WORDS = [
  "alien",
  "anomaly",
  "attack",
  "blackout",
  "classified",
  "collapse",
  "crisis",
  "emergency",
  "explosion",
  "leak",
  "mystery",
  "secret",
  "surveillance",
  "unprecedented",
  "warning",
  "war",
]

function formatScore(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(Math.round(value))
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ")
}

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function readTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? normalizeText(decodeEntities(stripTags(match[1]))) : ""
}

function readSource(item: string) {
  const match = item.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i)
  return {
    name: match ? normalizeText(decodeEntities(stripTags(match[2]))) : "News wire",
    url: match ? decodeEntities(match[1]) : undefined,
  }
}

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function isExternalUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value))
}

function isGoogleNewsUrl(value: string) {
  return hostName(value) === "news.google.com"
}

function isNewsBoardItem(item: NewsBoardItem | null): item is NewsBoardItem {
  return Boolean(item)
}

function scoreTitle(title: string, baseScore: number, index: number) {
  const lower = title.toLowerCase()
  const heat = HOT_WORDS.reduce((total, word) => total + (lower.includes(word) ? 11 : 0), 0)
  const punctuation = /[?!]/.test(title) ? 6 : 0
  return baseScore + heat + punctuation - index * 3
}

function sourceItemFromDossier(dossier: ClaimDossier, source: ClaimSourceLink, index: number): NewsBoardItem | null {
  if (!isExternalUrl(source.url) || isGoogleNewsUrl(source.url)) return null
  const outlet = source.outlet || hostName(source.url) || "source"
  return {
    id: `dossier-${dossier.slug}-${index}`,
    title: source.title || dossier.title,
    url: source.url,
    source: outlet,
    sectionId: "inverted-desk",
    sectionTitle: "Inverted World",
    score: scoreTitle(source.title || dossier.title, dossier.confidenceScore + Math.min(dossier.xVelocityScore / 20, 70), index),
    publishedAt: source.publishedAt || dossier.publishedAt,
    excerpt: source.excerpt || dossier.summary,
    contextHref: `/news/${dossier.slug}`,
    contextLabel: "IW context",
  }
}

function sourceItemFromArticle(article: IntelligenceArticle, index: number): NewsBoardItem | null {
  if (!isExternalUrl(article.sourceUrl) || isGoogleNewsUrl(article.sourceUrl)) return null
  return {
    id: `topic-${article.id}`,
    title: article.title,
    url: article.sourceUrl,
    source: article.source || hostName(article.sourceUrl) || "source",
    sectionId: `topic-${article.topicId}`,
    sectionTitle: topics.find((topic) => topic.id === article.topicId)?.title || article.topic,
    score: scoreTitle(article.title, article.heat || 80, index),
    publishedAt: article.publishedAt,
    excerpt: article.deck,
  }
}

function uniqueItems(items: NewsBoardItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.url.replace(/\/$/, "")}:${item.title.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function fetchExaLane(lane: WorldwireLane): Promise<NewsBoardItem[]> {
  const apiKey = process.env.EXA_API_KEY || process.env.EXA_SEARCH_API_KEY
  if (!apiKey) return []

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(4500),
    headers: {
      "content-type": "application/json",
      "user-agent": "InvertedWorldWorldwire/1.0",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: `${lane.query} latest high consequence source reporting`,
      type: "auto",
      numResults: 10,
      contents: {
        highlights: true,
      },
    }),
  })

  if (!response.ok) return []
  const data = (await response.json()) as {
    results?: Array<{
      id?: string
      title?: string
      url?: string
      author?: string
      publishedDate?: string
      highlights?: string[]
    }>
  }

  return (data.results || [])
    .filter((result) => result.title && result.url)
    .map((result, index) => {
      const url = result.url || ""
      const title = normalizeText(result.title || "Untitled source")
      return {
        id: `exa-${lane.id}-${result.id || index}`,
        title,
        url,
        source: result.author || hostName(url) || lane.title,
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreTitle(title, 118, index),
        publishedAt: result.publishedDate,
        excerpt: result.highlights?.find(Boolean),
      } satisfies NewsBoardItem
    })
}

async function fetchBraveLane(lane: WorldwireLane): Promise<NewsBoardItem[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_KEY
  if (!token) return []

  const url = new URL("https://api.search.brave.com/res/v1/web/search")
  url.searchParams.set("q", `${lane.query} latest`)
  url.searchParams.set("count", "10")
  url.searchParams.set("freshness", "pd")
  url.searchParams.set("safesearch", "moderate")

  const response = await fetch(url, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(4500),
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip",
      "user-agent": "InvertedWorldWorldwire/1.0",
      "x-subscription-token": token,
    },
  })
  if (!response.ok) return []

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string
        url?: string
        description?: string
        age?: string
        profile?: {
          name?: string
        }
      }>
    }
  }

  return (data.web?.results || [])
    .filter((result) => result.title && result.url && isExternalUrl(result.url) && !hostName(result.url || "").includes("google."))
    .map((result, index) => {
      const url = result.url || ""
      const title = normalizeText(stripTags(result.title || "Untitled source"))
      return {
        id: `brave-${lane.id}-${index}`,
        title,
        url,
        source: result.profile?.name || hostName(url) || lane.title,
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreTitle(title, 108, index),
        publishedAt: result.age,
        excerpt: result.description ? normalizeText(stripTags(result.description)) : undefined,
      } satisfies NewsBoardItem
    })
}

async function fetchGoogleLane(lane: WorldwireLane): Promise<NewsBoardItem[]> {
  const url = new URL("https://news.google.com/rss/search")
  url.searchParams.set("q", `${lane.query} when:1d`)
  url.searchParams.set("hl", "en-US")
  url.searchParams.set("gl", "US")
  url.searchParams.set("ceid", "US:en")

  const response = await fetch(url, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(4500),
    headers: {
      "user-agent": "InvertedWorldWorldwire/1.0",
    },
  })
  if (!response.ok) return []

  const xml = await response.text()
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10).map((match, index) => {
    const item = match[1]
    const title = readTag(item, "title")
    const link = decodeEntities(readTag(item, "link"))
    const source = readSource(item)
    return {
      id: `google-${lane.id}-${index}`,
      title,
      url: link || source.url || "https://news.google.com/",
      source: source.name || hostName(link) || lane.title,
      sectionId: lane.id,
      sectionTitle: lane.title,
      score: scoreTitle(title, 92, index),
      publishedAt: readTag(item, "pubDate"),
      excerpt: readTag(item, "description"),
    } satisfies NewsBoardItem
  }).filter((item) => !isGoogleNewsUrl(item.url))
}

async function fetchWorldwireItems() {
  const results = await Promise.allSettled(
    WORLDWIRE_LANES.map(async (lane) => {
      const exaItems = await fetchExaLane(lane).catch(() => [])
      if (exaItems.length) return exaItems
      const braveItems = await fetchBraveLane(lane).catch(() => [])
      return braveItems.length ? braveItems : fetchGoogleLane(lane).catch(() => [])
    }),
  )

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
}

function groupedSections(items: NewsBoardItem[]) {
  const sections = new Map<string, { id: string; title: string; items: NewsBoardItem[] }>()
  for (const item of items) {
    const current = sections.get(item.sectionId) || { id: item.sectionId, title: item.sectionTitle, items: [] }
    current.items.push(item)
    sections.set(item.sectionId, current)
  }

  return [
    ...WORLDWIRE_LANES.map((lane) => sections.get(lane.id)).filter(Boolean),
    ...topics.map((topic) => sections.get(`topic-${topic.id}`)).filter(Boolean),
    sections.get("inverted-desk"),
  ]
    .filter((section): section is { id: string; title: string; items: NewsBoardItem[] } => Boolean(section?.items.length))
    .map((section) => ({
      ...section,
      items: section.items.sort((left, right) => right.score - left.score).slice(0, 12),
    }))
}

export default async function NewsPage() {
  const [edition, dossiers, topicFeeds, worldwire] = await Promise.all([
    getLatestRecursivFrontPageEdition(),
    fetchRecursivClaimDossiers({ limit: 32 }).then((items) => items || []),
    fetchLiveArticlesByTopic({ allowProviderFallbacks: true, limitPerTopic: 8 }).catch(() => ({})),
    fetchWorldwireItems(),
  ])

  const dossierItems = dossiers.flatMap((dossier) =>
    dossier.sourceLinks.slice(0, 6).map((source, index) => sourceItemFromDossier(dossier, source, index)).filter(isNewsBoardItem),
  )
  const topicItems = Object.values(topicFeeds)
    .flat()
    .map((article, index) => sourceItemFromArticle(article, index))
    .filter(isNewsBoardItem)
  const allItems = uniqueItems([...dossierItems, ...topicItems, ...worldwire]).sort((left, right) => right.score - left.score)
  const lead = allItems[0]
  const flashItems = allItems.slice(1, 17)
  const sections = groupedSections(allItems)

  const breakingItems: BreakingItem[] = allItems.slice(0, 24).map((item) => ({
    title: item.title,
    href: item.url,
    source: item.source,
  }))

  return (
    <InvertedPageShell
      eyebrow="Worldwire"
      title="Breaking Source Board"
      breakingItems={breakingItems}
      heroTitle="Breaking Source Board"
      heroDescription="A fast outbound board of strange, high-consequence news: war, power, money, tech, science, crime, culture, and the Inverted World lanes."
    >
      {lead ? (
        <section className={cn("grid gap-4 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]", archiveSurface)}>
          <ExternalHeadline item={lead} size="lead" />
          <div className="grid gap-2 bg-black/22 p-3">
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
              <span>Flash hits</span>
              <span>{allItems.length} crawled links</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {flashItems.map((item) => (
                <ExternalHeadline key={item.id} item={item} size="compact" />
              ))}
            </div>
          </div>
          {edition ? (
            <div className="lg:col-span-2 grid gap-2 bg-black/18 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
                  {edition.editionDate} / {Number(edition.metrics.articleCount || 0)} story files / {Number(edition.metrics.xSignalCount || 0)} X signals
                </p>
                <p className="iw-serif mt-1 text-2xl leading-none text-[#fff8e6]">{edition.headline}</p>
              </div>
              {edition.leadDossierSlug ? (
                <a
                  href={`/news/${edition.leadDossierSlug}`}
                  className="inline-flex h-10 items-center justify-center gap-2 bg-black/34 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/58"
                >
                  IW file
                  <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section className={cn("grid gap-4 p-6 text-sm leading-6 text-[#f4efe2]/62", archiveSurface)}>
          <p>The source board is waiting for fresh crawler output. The archive and media library remain available.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/archive" className="bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54">
              Archive
            </a>
            <a href="/media" className="bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54">
              Media
            </a>
          </div>
        </section>
      )}

      <section className="mt-5 columns-1 gap-4 md:columns-2 xl:columns-3">
        {sections.map((section) => (
          <div key={section.id} className={cn("mb-4 break-inside-avoid p-3", archiveSurface)}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#f4efe2]/10 pb-2">
              <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">{section.title}</h2>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">{section.items.length}</span>
            </div>
            <div className="grid gap-2">
              {section.items.map((item, index) => (
                <ExternalHeadline key={`${section.id}-${item.id}-${index}`} item={item} size={index === 0 ? "major" : "list"} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {dossiers.length ? (
        <section className={cn("mt-5 grid gap-3 p-3 md:grid-cols-3", archiveSurface)}>
          <DeskMetric icon={<Gauge className="h-4 w-4" />} label="Top heat" value={formatScore(dossiers[0].xVelocityScore)} />
          <DeskMetric icon={<FileText className="h-4 w-4" />} label="Source files" value={String(dossiers.reduce((sum, dossier) => sum + dossier.sourceCount, 0))} />
          <DeskMetric icon={<Radio className="h-4 w-4" />} label="X signals" value={String(dossiers.reduce((sum, dossier) => sum + dossier.xSignalCount, 0))} />
        </section>
      ) : null}
    </InvertedPageShell>
  )
}

function ExternalHeadline({ item, size }: { item: NewsBoardItem; size: "lead" | "major" | "compact" | "list" }) {
  const headlineClass =
    size === "lead"
      ? "iw-serif text-5xl leading-[0.88] text-[#fff8e6] sm:text-7xl"
      : size === "major"
        ? "iw-serif text-3xl leading-none text-[#fff8e6]"
        : size === "compact"
          ? "text-sm font-semibold leading-5 text-[#fff8e6]"
          : "text-sm leading-5 text-[#fff8e6]"

  return (
    <article className={cn("group bg-[#050504]/42 transition hover:bg-black/70", size === "lead" ? "grid content-between gap-10 p-5" : "p-3")}>
      <a href={item.url} target="_blank" rel="noreferrer" className="block">
        <span className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#df2f2f]">
          <span>{item.source}</span>
          <span>{Math.max(1, Math.round(item.score))}</span>
          {item.publishedAt ? <span>{formatDate(item.publishedAt)}</span> : null}
        </span>
        <span className={cn("block group-hover:text-[#df2f2f]", headlineClass)}>{item.title}</span>
        {size === "lead" && item.excerpt ? (
          <span className="mt-5 block max-w-3xl text-base leading-7 text-[#f4efe2]/68">{item.excerpt}</span>
        ) : null}
        <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/48 group-hover:text-[#fff8e6]">
          Open source
          <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
        </span>
      </a>
      {item.contextHref ? (
        <a
          href={item.contextHref}
          className="mt-3 inline-flex w-fit items-center gap-1 bg-black/28 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/48 transition hover:bg-black/58 hover:text-[#fff8e6]"
        >
          {item.contextLabel || "Context"}
          <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
        </a>
      ) : null}
    </article>
  )
}

function DeskMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-black/30 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/48">
        {icon}
        {label}
      </div>
      <span className="iw-serif text-3xl leading-none text-[#fff8e6]">{value}</span>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
