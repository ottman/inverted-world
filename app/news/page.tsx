import type { Metadata } from "next"
import type { ReactNode } from "react"
import { ArrowUpRight, Flame, RadioTower } from "lucide-react"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { topics } from "@/data/inverted-world"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import { fetchLiveArticlesByTopic } from "@/lib/live-articles"
import {
  fetchRecursivClaimDossiers,
  fetchRecursivWorldwireItems,
  type ClaimDossier,
  type ClaimSourceLink,
} from "@/lib/recursiv/content"
import { maybeStartNewsRefresh } from "@/lib/recursiv/news-refresh"
import {
  fetchRecursivTopStories,
  fetchRecursivFringeStories,
  fetchRecursivThemedStories,
  dedupeNearDuplicateStories,
  tidyCategoryLabel,
  type StoryCluster,
} from "@/lib/story-clusters"
import { StoryCategoryBoard, type StoryCardData } from "@/components/story-category-board"
import { cn } from "@/lib/utils"
import {
  WORLDWIRE_LANES,
  isExternalUrl,
  isGoogleNewsUrl,
  isUsefulWorldwireTitle,
  looksLikeArticleUrl,
  normalizeWorldwireText,
  scoreWorldwireTitle,
  sourceLabel,
  type WorldwireItem,
} from "@/lib/worldwire"

export const dynamic = "force-dynamic"
export const revalidate = 300

export const metadata: Metadata = {
  title: "News | Inverted World",
  description:
    "A dense source board for breaking world news, institutional shocks, war, money, AI, science, crime, culture, official files, and strange events.",
}

type NewsBoardItem = WorldwireItem & {
  contextHref?: string
  contextLabel?: string
}

const NEWS_DAY_TIME_ZONE = "America/New_York"
const NEWS_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: NEWS_DAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function formatScore(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(Math.round(value))
}

function isNewsBoardItem(item: NewsBoardItem | null): item is NewsBoardItem {
  return Boolean(item)
}

function sourceItemFromDossier(dossier: ClaimDossier, source: ClaimSourceLink, index: number): NewsBoardItem | null {
  if (!isExternalUrl(source.url) || isGoogleNewsUrl(source.url) || !looksLikeArticleUrl(source.url)) return null
  const outlet = sourceLabel(source.outlet, source.url)
  return {
    id: `dossier-${dossier.slug}-${index}`,
    title: source.title || dossier.title,
    url: source.url,
    source: outlet,
    sectionId: "inverted-files",
    sectionTitle: "Inverted Files",
    score: scoreWorldwireTitle(source.title || dossier.title, dossier.confidenceScore + Math.min(dossier.xVelocityScore / 20, 70), index, {
      source: outlet,
      url: source.url,
    }),
    publishedAt: source.publishedAt || dossier.publishedAt,
    excerpt: source.excerpt || dossier.summary,
    contextHref: `/news/${dossier.slug}`,
    contextLabel: "IW context",
  }
}

function sourceItemFromArticle(article: IntelligenceArticle, index: number): NewsBoardItem | null {
  if (!isExternalUrl(article.sourceUrl) || isGoogleNewsUrl(article.sourceUrl) || !looksLikeArticleUrl(article.sourceUrl)) return null
  const source = sourceLabel(article.source, article.sourceUrl)
  return {
    id: `topic-${article.id}`,
    title: article.title,
    url: article.sourceUrl,
    source,
    sectionId: `topic-${article.topicId}`,
    sectionTitle: topics.find((topic) => topic.id === article.topicId)?.title || article.topic,
    score: scoreWorldwireTitle(article.title, article.heat || 80, index, { source, url: article.sourceUrl }),
    publishedAt: article.publishedAt,
    excerpt: article.deck,
  }
}

function uniqueItems(items: NewsBoardItem[]) {
  const seen = new Set<string>()
  const unique: NewsBoardItem[] = []
  for (const item of items) {
    const title = normalizeWorldwireText(item.title)
    if (!title || !isUsefulWorldwireTitle(title)) continue
    if (isGoogleNewsUrl(item.url) || !looksLikeArticleUrl(item.url)) continue
    const key = `${item.sectionId}:${item.url.replace(/\/$/, "")}:${title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ ...item, title, source: sourceLabel(item.source, item.url) })
  }
  return unique
}

function hostKey(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

function dayKey(value: Date) {
  const parts = NEWS_DAY_FORMATTER.formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value || String(value.getFullYear())
  const month = parts.find((part) => part.type === "month")?.value || String(value.getMonth() + 1).padStart(2, "0")
  const day = parts.find((part) => part.type === "day")?.value || String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function itemDate(item: NewsBoardItem) {
  const date = item.publishedAt ? new Date(item.publishedAt) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function itemDayKey(item: NewsBoardItem) {
  const raw = item.publishedAt?.trim()
  const dateOnly = raw?.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (dateOnly) return dateOnly[1]
  const date = itemDate(item)
  return date ? dayKey(date) : null
}

function isTodayItem(item: NewsBoardItem, today = dayKey(new Date())) {
  return itemDayKey(item) === today
}

// Breadth: the board shows recent items (within this window), not strictly today, so the long
// tail of independent outlets — which don't all publish today-dated items — still reaches /news.
const NEWS_BOARD_MAX_AGE_MS =
  Math.max(1, Math.min(Math.trunc(Number(process.env.NEWS_BOARD_MAX_AGE_DAYS)) || 2, 14)) * 24 * 60 * 60 * 1000

function isRecentItem(item: NewsBoardItem, maxAgeMs = NEWS_BOARD_MAX_AGE_MS) {
  const date = itemDate(item)
  if (!date) return false
  const age = Date.now() - date.getTime()
  return age <= maxAgeMs && age >= -3_600_000 // up to maxAge old; tolerate 1h clock skew
}

function byHeatThenTime(left: NewsBoardItem, right: NewsBoardItem) {
  const heat = right.score - left.score
  if (heat) return heat
  return (itemDate(right)?.getTime() || 0) - (itemDate(left)?.getTime() || 0)
}

function balancedItems(items: NewsBoardItem[], options: { limit: number; maxPerSection?: number; maxPerHost?: number }) {
  const sectionCounts = new Map<string, number>()
  const hostCounts = new Map<string, number>()
  const balanced: NewsBoardItem[] = []
  const maxPerSection = options.maxPerSection || 2
  const maxPerHost = options.maxPerHost || 2

  for (const item of items) {
    const sectionCount = sectionCounts.get(item.sectionId) || 0
    const host = hostKey(item.url)
    const hostCount = hostCounts.get(host) || 0
    if (sectionCount >= maxPerSection || hostCount >= maxPerHost) continue

    balanced.push(item)
    sectionCounts.set(item.sectionId, sectionCount + 1)
    hostCounts.set(host, hostCount + 1)
    if (balanced.length >= options.limit) return balanced
  }

  for (const item of items) {
    if (balanced.includes(item)) continue
    balanced.push(item)
    if (balanced.length >= options.limit) return balanced
  }

  return balanced
}

// Keep at most `maxPerHost` items per source host (input pre-sorted) so a lane's rendered board
// shows a wide variety of outlets across the spectrum instead of a wall of one mainstream source.
function capByHost(items: NewsBoardItem[], maxPerHost: number) {
  const counts = new Map<string, number>()
  const out: NewsBoardItem[] = []
  for (const item of items) {
    const host = hostKey(item.url)
    const used = counts.get(host) || 0
    if (used >= maxPerHost) continue
    counts.set(host, used + 1)
    out.push(item)
  }
  return out
}

const MAX_PER_HOST_PER_LANE = Math.max(1, Math.min(Math.trunc(Number(process.env.NEWS_MAX_PER_HOST_PER_LANE)) || 2, 6))
// Hard cap on how many articles any single outlet contributes to the whole board ("a couple").
const NEWS_MAX_PER_OUTLET = Math.max(1, Math.min(Math.trunc(Number(process.env.NEWS_MAX_PER_OUTLET)) || 2, 6))

function toCardData(story: StoryCluster): StoryCardData {
  return {
    uri: story.uri,
    headline: story.headline || story.title,
    synopsis: story.synopsis || story.summary,
    // Re-tidy at render so older rows stored before the label cleanup merge with current ones.
    category: story.category ? tidyCategoryLabel(story.category) : undefined,
    articleCount: story.articleCount,
    outletCount: story.coveringArticles?.length || 0,
    concepts: story.concepts.slice(0, 3),
    imageUrl: story.image?.url,
  }
}

export default async function NewsPage() {
  const refreshKickoff = maybeStartNewsRefresh("news-page").catch(() => null)
  const [dossiers, topStoriesRaw, fringeStoriesRaw, weirdRaw, comedyRaw, popRaw, viralRaw] = await Promise.all([
    fetchRecursivClaimDossiers({ limit: 12 }).then((items) => items || []),
    fetchRecursivTopStories({ limit: 160 }).catch(() => [] as StoryCluster[]),
    fetchRecursivFringeStories({ limit: 36 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("weird", { limit: 40 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("comedy", { limit: 40 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("pop", { limit: 40 }).catch(() => [] as StoryCluster[]),
    fetchRecursivThemedStories("viral", { limit: 40 }).catch(() => [] as StoryCluster[]),
  ])
  void refreshKickoff

  // De-dupe within each section AND across sections — a story shows in only the first section it
  // qualifies for, so nothing repeats down the page.
  const topStories = dedupeNearDuplicateStories(topStoriesRaw)
  const seen: StoryCluster[] = [...topStories]
  const claim = (raw: StoryCluster[]) => {
    const deduped = dedupeNearDuplicateStories(raw, seen)
    seen.push(...deduped)
    return deduped
  }
  const fringeStories = claim(fringeStoriesRaw)
  const weirdStories = claim(weirdRaw)
  const comedyStories = claim(comedyRaw)
  const popStories = claim(popRaw)
  const viralStories = claim(viralRaw)

  const breakingItems: BreakingItem[] = topStories.slice(0, 24).map((story) => ({
    title: story.headline || story.title,
    href: `/news/story/${encodeURIComponent(story.uri)}`,
    source: story.category || "Top Stories",
  }))

  return (
    <InvertedPageShell
      eyebrow="News"
      title="News"
      breakingItems={breakingItems}
      heroTitle="News"
      heroDescription=""
    >
      {topStories.length ? (
        <StoryCategoryBoard
          eyebrow="Top Stories"
          title="What everyone's talking about"
          note={`${topStories.length} stories · clustered across the spectrum`}
          cards={topStories.map(toCardData)}
        />
      ) : null}

      {fringeStories.length ? (
        <StoryCategoryBoard
          eyebrow="Mainstream Blackout"
          title="What nobody's talking about"
          note={`${fringeStories.length} stories the major outlets aren't covering`}
          cards={fringeStories.map(toCardData)}
        />
      ) : null}

      {weirdStories.length ? (
        <StoryCategoryBoard
          eyebrow="The Strange"
          title="Weird"
          note={`${weirdStories.length} strange, unexplained & paranormal stories`}
          cards={weirdStories.map(toCardData)}
        />
      ) : null}

      {comedyStories.length ? (
        <StoryCategoryBoard
          eyebrow="Laughs"
          title="Comedy"
          note={`${comedyStories.length} comedy & satire stories`}
          cards={comedyStories.map(toCardData)}
        />
      ) : null}

      {popStories.length ? (
        <StoryCategoryBoard
          eyebrow="Culture"
          title="Pop & Music"
          note={`${popStories.length} pop culture & music stories`}
          cards={popStories.map(toCardData)}
        />
      ) : null}

      {viralStories.length ? (
        <StoryCategoryBoard
          eyebrow="Trending"
          title="Viral"
          note={`${viralStories.length} most-shared stories right now`}
          cards={viralStories.map(toCardData)}
        />
      ) : null}

      {dossiers.length ? (
        <section className={cn("mt-5 grid gap-3 p-3", archiveSurface)}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f4efe2]/10 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Inverted files</p>
              <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">The deeper reads</h2>
            </div>
            <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/46">
              <span>{formatScore(dossiers[0].xVelocityScore)} heat</span>
              <span>{dossiers.reduce((sum, dossier) => sum + dossier.sourceCount, 0)} sources</span>
              <span>{dossiers.reduce((sum, dossier) => sum + dossier.xSignalCount, 0)} X signals</span>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {dossiers.slice(0, 6).map((dossier) => (
              <a key={dossier.slug} href={`/news/${dossier.slug}`} className="group grid gap-2 bg-[#050504]/42 p-3 transition hover:bg-black/70">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#df2f2f]">
                  <RadioTower className="h-3.5 w-3.5" />
                  {dossier.evidenceGrade} / {dossier.sourceCount} sources
                </span>
                <span className="iw-serif text-2xl leading-none text-[#fff8e6] group-hover:text-[#df2f2f]">{dossier.title}</span>
                {dossier.deck ? <span className="text-xs leading-5 text-[#f4efe2]/58">{dossier.deck}</span> : null}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/48 group-hover:text-[#fff8e6]">
                  Open file
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </InvertedPageShell>
  )
}
