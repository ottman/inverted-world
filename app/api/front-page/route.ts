import { NextResponse } from "next/server"
import {
  getLatestRecursivFrontPageEditionWithSource,
  getLatestRecursivPipelineRun,
  type FrontPageEdition,
} from "@/lib/recursiv/content"
import { maybeStartNewsRefresh } from "@/lib/recursiv/news-refresh"
import {
  fetchRecursivTopStories,
  fetchRecursivTalesStories,
  sortByRecency,
  tidyCategoryLabel,
  type StoryCluster,
} from "@/lib/story-clusters"
import { xPostInternalHref } from "@/lib/x-links"

export const dynamic = "force-dynamic"

// Per-instance 60s cache for the ticker items: the client polls every minute, and without this each
// poll would re-read the ~1.5MB top-stories snapshot + the tale rows. Bounds it to one read/minute.
let tickerCache: { at: number; items: Array<{ title: string; href: string; source?: string }> } | null = null

type FrontPageSectionItem = {
  id?: unknown
  href?: unknown
  title?: unknown
  text?: unknown
  source?: unknown
  username?: unknown
  topicId?: unknown
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function sectionItems(value: unknown): FrontPageSectionItem[] {
  return Array.isArray(value) ? value.filter((item): item is FrontPageSectionItem => Boolean(item && typeof item === "object")) : []
}

function directItem(item: FrontPageSectionItem, fallbackSource: string) {
  const title = textField(item.title || item.text)
  const href = textField(item.href)
  if (!title || !href) return null
  return {
    title,
    href,
    source: textField(item.source) || fallbackSource,
  }
}

function xSignalItem(item: FrontPageSectionItem) {
  const title = textField(item.text || item.title)
  const topicId = textField(item.topicId) || "uap-disclosure"
  if (!title) return null
  return {
    title,
    href: xPostInternalHref(
      {
        id: textField(item.id),
        topicId,
        url: textField(item.href),
      },
      topicId,
    ),
    source: textField(item.username) ? `@${textField(item.username)}` : "X",
  }
}

function dedupeBreakingItems(items: Array<{ title: string; href: string; source?: string } | null>) {
  const seen = new Set<string>()
  const result: Array<{ title: string; href: string; source?: string }> = []

  for (const item of items) {
    if (!item) continue
    const key = `${item.href}:${item.title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result.slice(0, 32)
}

function storyTickerItem(story: StoryCluster, fallbackSource: string) {
  const title = (story.headline || story.title || "").trim()
  if (!title || !story.uri) return null
  return {
    title,
    href: `/news/story/${encodeURIComponent(story.uri)}`,
    source: (story.category ? tidyCategoryLabel(story.category) : "") || fallbackSource,
  }
}

// The ticker = current breaking-news clusters (recency-ordered) interleaved with a rotating set of
// evergreen tales, so it reflects exactly what's on /news. The tale window rotates by the hour so the
// ticker varies through the day instead of always showing the same handful.
async function breakingItemsFromStories() {
  if (tickerCache && Date.now() - tickerCache.at < 60_000) return tickerCache.items
  const [topRaw, talesRaw] = await Promise.all([
    fetchRecursivTopStories({ limit: 60 }).catch(() => [] as StoryCluster[]),
    fetchRecursivTalesStories({ limit: 90 }).catch(() => [] as StoryCluster[]),
  ])
  const news = sortByRecency(topRaw)
    .slice(0, 22)
    .map((story) => storyTickerItem(story, "Breaking News"))
    .filter(Boolean)
  const tales = talesRaw.filter((story) => story.headline || story.title)
  const start = tales.length ? (new Date().getUTCHours() * 7) % tales.length : 0
  const rotatedTales = [...tales.slice(start), ...tales.slice(0, start)]
    .slice(0, 10)
    .map((story) => storyTickerItem(story, "Tales"))
    .filter(Boolean)
  // Interleave 2 news : 1 tale so both are visible as the marquee scrolls.
  const mixed: Array<{ title: string; href: string; source?: string } | null> = []
  let ni = 0
  let ti = 0
  while (ni < news.length || ti < rotatedTales.length) {
    if (ni < news.length) mixed.push(news[ni++])
    if (ni < news.length) mixed.push(news[ni++])
    if (ti < rotatedTales.length) mixed.push(rotatedTales[ti++])
  }
  const items = dedupeBreakingItems(mixed)
  if (items.length) tickerCache = { at: Date.now(), items }
  return items
}

function breakingItemsFromEdition(edition: FrontPageEdition | null | undefined) {
  const sections = edition?.sections || {}
  const leadWorldwire = directItem((sections.leadWorldwire || {}) as FrontPageSectionItem, "Source")
  const worldwire = sectionItems(sections.worldwire).map((item) => directItem(item, textField(item.source) || "Source"))
  const leadArticle = directItem((sections.leadArticle || {}) as FrontPageSectionItem, "Story")
  const leadDossier = directItem((sections.leadDossier || {}) as FrontPageSectionItem, "Dossier")
  const articles = sectionItems(sections.articles).map((item) => directItem(item, textField(item.source) || "Story"))
  const dossiers = sectionItems(sections.dossiers).map((item) => directItem(item, "Dossier"))
  const xSignals = sectionItems(sections.xSignals).map(xSignalItem)
  const archiveVideos = sectionItems(sections.archiveVideos).map((item) => directItem(item, "Archive"))

  return dedupeBreakingItems([leadWorldwire, ...worldwire, leadArticle, leadDossier, ...articles, ...dossiers, ...xSignals, ...archiveVideos])
}

export async function GET() {
  const refreshKickoff = maybeStartNewsRefresh("front-page-api").catch(() => null)
  const [frontPage, pipeline, storyItems] = await Promise.all([
    getLatestRecursivFrontPageEditionWithSource(),
    getLatestRecursivPipelineRun(),
    breakingItemsFromStories(),
  ])
  void refreshKickoff
  const edition = frontPage?.edition ?? null
  // The ticker is breaking-news clusters + tales; fall back to the legacy edition only if those are empty.
  const breakingItems = storyItems.length ? storyItems : breakingItemsFromEdition(edition)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode: frontPage?.sourceMode ?? "unavailable",
    edition,
    breakingItems,
    pipeline,
  })
}
