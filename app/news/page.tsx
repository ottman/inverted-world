import type { Metadata } from "next"
import { ArrowUpRight, FileText } from "lucide-react"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { topics } from "@/data/inverted-world"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import { fetchLiveArticlesByTopic } from "@/lib/live-articles"
import {
  fetchRecursivClaimDossiers,
  fetchRecursivWorldwireItems,
  getLatestRecursivFrontPageEdition,
  type ClaimDossier,
  type ClaimSourceLink,
} from "@/lib/recursiv/content"
import { cn } from "@/lib/utils"
import { WORLDWIRE_LANES, isExternalUrl, isGoogleNewsUrl, scoreWorldwireTitle, sourceLabel, type WorldwireItem } from "@/lib/worldwire"

export const dynamic = "force-dynamic"
export const revalidate = 300

export const metadata: Metadata = {
  title: "Worldwire | Inverted World",
  description:
    "A dense outbound source board for breaking world news, institutional shocks, war, money, AI, science, crime, culture, official files, and strange events.",
}

type NewsBoardItem = WorldwireItem & {
  contextHref?: string
  contextLabel?: string
}

function formatScore(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(Math.round(value))
}

function isNewsBoardItem(item: NewsBoardItem | null): item is NewsBoardItem {
  return Boolean(item)
}

function sourceItemFromDossier(dossier: ClaimDossier, source: ClaimSourceLink, index: number): NewsBoardItem | null {
  if (!isExternalUrl(source.url) || isGoogleNewsUrl(source.url)) return null
  const outlet = sourceLabel(source.outlet, source.url)
  return {
    id: `dossier-${dossier.slug}-${index}`,
    title: source.title || dossier.title,
    url: source.url,
    source: outlet,
    sectionId: "inverted-desk",
    sectionTitle: "Inverted World",
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
  if (!isExternalUrl(article.sourceUrl) || isGoogleNewsUrl(article.sourceUrl)) return null
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
    const key = `${item.url.replace(/\/$/, "")}:${item.title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ ...item, source: sourceLabel(item.source, item.url) })
  }
  return unique
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

function hostKey(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
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

export default async function NewsPage() {
  const [edition, dossiers, topicFeeds, worldwire] = await Promise.all([
    getLatestRecursivFrontPageEdition(),
    fetchRecursivClaimDossiers({ limit: 32 }).then((items) => items || []),
    fetchLiveArticlesByTopic({ allowProviderFallbacks: false, limitPerTopic: 8 }).catch(() => ({})),
    fetchRecursivWorldwireItems({ limitPerLane: 8 }).then((items) => items || []),
  ])

  const dossierItems = dossiers.flatMap((dossier) =>
    dossier.sourceLinks.slice(0, 6).map((source, index) => sourceItemFromDossier(dossier, source, index)).filter(isNewsBoardItem),
  )
  const topicItems = Object.values(topicFeeds)
    .flat()
    .map((article, index) => sourceItemFromArticle(article, index))
    .filter(isNewsBoardItem)
  const allItems = uniqueItems([...dossierItems, ...topicItems, ...worldwire]).sort((left, right) => right.score - left.score)
  const lead = allItems.find((item) => item.sectionId === "front-page") || allItems.find((item) => item.sectionId !== "inverted-desk") || allItems[0]
  const flashItems = balancedItems(
    allItems.filter((item) => item !== lead),
    { limit: 18, maxPerSection: 2, maxPerHost: 2 },
  )
  const sections = groupedSections(allItems)

  const breakingItems: BreakingItem[] = balancedItems(allItems, { limit: 24, maxPerSection: 3, maxPerHost: 2 }).map((item) => ({
    title: item.title,
    href: item.url,
    source: item.source,
  }))

  return (
    <InvertedPageShell
      eyebrow="Worldwire"
      title="Worldwire"
      breakingItems={breakingItems}
      heroTitle="Worldwire"
      heroDescription="The highest-heat source links our crawlers can find right now: war, politics, money, tech, disasters, crime, science, strange files, and the Inverted World beat."
    >
      {lead ? (
        <section className={cn("grid gap-3 p-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.68fr)_minmax(260px,0.68fr)]", archiveSurface)}>
          <ExternalHeadline item={lead} size="lead" />
          <NewsRail title="Above the fold" count={`${allItems.length} links`} items={flashItems.slice(0, 8)} />
          <NewsRail title="Outliers" count="high heat" items={flashItems.slice(8, 16)} />
          {edition ? (
            <div className="grid gap-2 bg-black/18 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center xl:col-span-3">
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
          <p>Fresh crawler output is still warming up. The archive and media library remain available.</p>
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
        <section className={cn("mt-5 grid gap-3 p-3", archiveSurface)}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f4efe2]/10 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Inverted World files</p>
              <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">Context for the stranger stories</h2>
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
                  <FileText className="h-3.5 w-3.5" />
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

function NewsRail({ title, count, items }: { title: string; count: string; items: NewsBoardItem[] }) {
  return (
    <div className="grid gap-2 bg-black/22 p-3">
      <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
        <span>{title}</span>
        <span>{count}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {items.map((item) => (
          <ExternalHeadline key={item.id} item={item} size="compact" />
        ))}
      </div>
    </div>
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
      <a href={item.url} target="_blank" rel="noreferrer" className="block" aria-label={`Open source: ${item.title}`}>
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

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
