/* eslint-disable @next/next/no-img-element -- Worldwire and YouTube thumbnails are external editorial assets. */
import type { Metadata } from "next"
import { ArrowUpRight, FileText, Flame, Play, RadioTower, Youtube } from "lucide-react"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { channelProfile, topics, type ChannelVideo } from "@/data/inverted-world"
import { getDeepArchive } from "@/lib/deep-archive"
import {
  fetchRecursivClaimDossiers,
  fetchRecursivWorldwireItems,
  getLatestRecursivFrontPageEditionWithSource,
  type ClaimDossier,
  type FrontPageEdition,
} from "@/lib/recursiv/content"
import { cn } from "@/lib/utils"
import { WORLDWIRE_LANES, sourceLabel, type WorldwireItem } from "@/lib/worldwire"

export const dynamic = "force-dynamic"
export const revalidate = 120

export const metadata: Metadata = {
  title: "Inverted World",
  description: "Breaking source board, Inverted World dossiers, X velocity, and the latest Tales archive.",
  openGraph: {
    title: "Inverted World",
    description: "Breaking source board, Inverted World dossiers, X velocity, and the latest Tales archive.",
    url: "https://www.inverted.world",
    siteName: "Inverted World",
    images: ["/images/inverted-world-logo.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inverted World",
    description: "Breaking source board, Inverted World dossiers, X velocity, and the latest Tales archive.",
    images: ["/images/inverted-world-logo.jpg"],
  },
}

type EditionItem = {
  id?: string
  title: string
  href: string
  source?: string
  topicId?: string
  publishedAt?: string
  score?: number
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function editionItems(edition: FrontPageEdition | null | undefined, key: string): EditionItem[] {
  return recordArray(edition?.sections?.[key])
    .map<EditionItem | null>((item, index) => {
      const title = textValue(item.title || item.text)
      const href = textValue(item.href)
      if (!title || !href) return null
      return {
        id: textValue(item.id) || `${key}-${index}`,
        title,
        href,
        source: textValue(item.source || item.username),
        topicId: textValue(item.topicId),
        publishedAt: textValue(item.publishedAt || item.postedAt),
        score: numberValue(item.heat || item.score || item.xVelocityScore),
      }
    })
    .filter((item): item is EditionItem => Boolean(item))
}

function hostName(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

function itemTime(value?: string) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

function isToday(value?: string) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && dayKey(date) === dayKey(new Date())
}

function byHeatThenTime(left: WorldwireItem, right: WorldwireItem) {
  const heat = right.score - left.score
  if (heat) return heat
  return itemTime(right.publishedAt) - itemTime(left.publishedAt)
}

function uniqueWorldwireItems(items: WorldwireItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${hostName(item.url)}:${item.title.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isShortVideo(video: ChannelVideo) {
  const title = video.title.toLowerCase()
  return video.kind === "short" || title.includes("#shorts") || video.href.includes("/shorts/")
}

function videoEmbedUrl(video?: ChannelVideo) {
  if (!video) return channelProfile.youtubeUploadsEmbedUrl
  if (video.embedUrl) return video.embedUrl
  if (video.videoId) return `https://www.youtube.com/embed/${video.videoId}?rel=0`
  return channelProfile.youtubeUploadsEmbedUrl
}

function formatDate(value?: string) {
  if (!value) return "live"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  if (dayKey(date) === dayKey(new Date())) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatScore(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(Math.max(1, Math.round(value)))
}

function topicTitle(topicId?: string) {
  return topics.find((topic) => topic.id === topicId)?.title || "Inverted World"
}

function breakingItems(wires: WorldwireItem[], edition: FrontPageEdition | null | undefined, videos: ChannelVideo[]): BreakingItem[] {
  const editionLinks = [
    ...editionItems(edition, "articles"),
    ...editionItems(edition, "dossiers"),
    ...editionItems(edition, "xSignals"),
  ].map((item) => ({
    title: item.title,
    href: item.href,
    source: item.source || topicTitle(item.topicId),
  }))
  const wireLinks = wires.slice(0, 18).map((item) => ({
    title: item.title,
    href: item.url,
    source: sourceLabel(item.source, item.url),
  }))
  const videoLinks = videos.slice(0, 6).map((video) => ({
    title: video.title,
    href: video.videoId ? `/archive/${video.videoId}` : video.href,
    source: "Archive",
  }))

  const seen = new Set<string>()
  return [...wireLinks, ...editionLinks, ...videoLinks].filter((item) => {
    const key = `${item.href}:${item.title.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 32)
}

export default async function HomePage() {
  const [frontPageResult, worldwireItems, archive, dossiers] = await Promise.all([
    getLatestRecursivFrontPageEditionWithSource().catch(() => null),
    fetchRecursivWorldwireItems({ limitPerLane: 18 }).then((items) => items || []).catch(() => []),
    getDeepArchive({ limit: 36, maxLimit: 36, allowProviderFallbacks: false }),
    fetchRecursivClaimDossiers({ limit: 18 }).then((items) => items || []).catch(() => []),
  ])

  const edition = frontPageResult?.edition ?? null
  const wires = uniqueWorldwireItems(worldwireItems).sort(byHeatThenTime)
  const todayWires = wires.filter((item) => isToday(item.publishedAt))
  const leadWire = todayWires.find((item) => item.sectionId === "front-page") || todayWires[0] || wires[0]
  const wireRails = wires.filter((item) => item !== leadWire).slice(0, 18)
  const videos = archive.videos || []
  const leadVideo = videos.find((video) => !isShortVideo(video)) || videos[0]
  const editionDossiers = editionItems(edition, "dossiers")
  const editionSignals = editionItems(edition, "xSignals")
  const topDossiers = dossiers.length ? dossiers : []

  return (
    <InvertedPageShell
      eyebrow={frontPageResult?.sourceMode === "recursiv-database" ? "Live front page" : "Front page"}
      title="Inverted World"
      breakingItems={breakingItems(wires, edition, videos)}
      heroTitle="inverted.world"
      heroDescription=""
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.72fr)]">
        {leadWire ? <LeadWire item={leadWire} todayCount={todayWires.length || wires.length} /> : <EmptyLead />}
        <ShowModule video={leadVideo} archiveCount={archive.totalCount || videos.length} />
      </section>

      <section className={cn("mt-4 grid gap-3 p-3", archiveSurface)}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f4efe2]/10 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Wires</p>
            <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">Today&apos;s board</h2>
          </div>
          <a href="/news" className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/54 transition hover:text-[#fff8e6]">
            News
            <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
          </a>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {wireRails.slice(0, 12).map((item, index) => (
            <WireCard key={item.id} item={item} size={index < 3 ? "major" : "standard"} />
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <EditionModule edition={edition} dossiers={editionDossiers} signals={editionSignals} />
        <ArchiveModule videos={videos} />
      </section>

      <section className={cn("mt-4 grid gap-3 p-3", archiveSurface)}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f4efe2]/10 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Topics</p>
            <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">Inverted index</h2>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/46">
            {topics.length} desks
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => (
            <TopicBlock
              key={topic.id}
              topicId={topic.id}
              wires={wires.filter((item) => item.sectionId === topic.id || item.sectionId === `topic-${topic.id}`).slice(0, 2)}
              videos={videos.filter((video) => video.topicId === topic.id).slice(0, 2)}
              dossier={topDossiers.find((dossier) => dossier.topicId === topic.id)}
            />
          ))}
        </div>
      </section>
    </InvertedPageShell>
  )
}

function LeadWire({ item, todayCount }: { item: WorldwireItem; todayCount: number }) {
  return (
    <section className={cn("grid min-w-0 gap-4 p-3 sm:p-5", archiveSurface)}>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="group grid min-w-0 gap-4">
        {item.imageUrl ? (
          <span className="relative block aspect-[16/9] overflow-hidden bg-black/42">
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover opacity-88 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100" />
          </span>
        ) : null}
        <span className="grid min-w-0 gap-3">
          <span className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#df2f2f]">
            <RadioTower className="h-4 w-4" />
            <span>{sourceLabel(item.source, item.url)}</span>
            <span>{formatDate(item.publishedAt)}</span>
            <span>{todayCount} live links</span>
          </span>
          <span className="iw-serif block break-words text-5xl font-semibold leading-[0.9] text-[#fff8e6] group-hover:text-[#df2f2f] sm:text-7xl">
            {item.title}
          </span>
          {item.excerpt ? <span className="max-w-3xl text-base leading-7 text-[#f4efe2]/68">{item.excerpt}</span> : null}
          <span className="inline-flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/54 transition group-hover:text-[#fff8e6]">
            Source
            <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
          </span>
        </span>
      </a>
    </section>
  )
}

function EmptyLead() {
  return (
    <section className={cn("grid gap-3 p-5", archiveSurface)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Front page</p>
      <h2 className="iw-serif text-5xl leading-none text-[#fff8e6]">The board is loading.</h2>
      <a href="/news" className="inline-flex w-fit items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/62 transition hover:text-[#fff8e6]">
        News
        <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
      </a>
    </section>
  )
}

function ShowModule({ video, archiveCount }: { video?: ChannelVideo; archiveCount: number }) {
  const href = video?.videoId ? `/archive/${video.videoId}` : "/archive"
  return (
    <section className={cn("grid content-between gap-4 p-3 sm:p-4", archiveSurface)}>
      <div className="relative aspect-video overflow-hidden bg-black/54">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={videoEmbedUrl(video)}
          title={video?.title || "Tales From the Inverted World"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <div className="grid gap-3">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#df2f2f]">
          <Youtube className="h-4 w-4" />
          Latest from the show
        </span>
        <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">{video?.title || channelProfile.name}</h2>
        <div className="flex flex-wrap gap-2">
          <a href={href} className="inline-flex h-10 items-center gap-2 bg-[#df2f2f]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/20">
            <Play className="h-4 w-4" />
            Watch
          </a>
          <a href="/archive" className="inline-flex h-10 items-center gap-2 bg-black/28 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/70 transition hover:bg-black/56 hover:text-[#fff8e6]">
            {archiveCount} videos
            <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
          </a>
        </div>
      </div>
    </section>
  )
}

function WireCard({ item, size }: { item: WorldwireItem; size: "major" | "standard" }) {
  return (
    <article className={cn("group min-w-0 bg-[#050504]/38 p-3 transition hover:bg-black/70", size === "major" && "ring-1 ring-[#df2f2f]/22")}>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="grid min-w-0 gap-2">
        {item.imageUrl ? (
          <span className="relative block aspect-[16/9] overflow-hidden bg-black/36">
            <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-84 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100" />
          </span>
        ) : null}
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#df2f2f]">
          <span className="min-w-0 break-words">{sourceLabel(item.source, item.url)}</span>
          <span>{formatScore(item.score)}</span>
          <span>{formatDate(item.publishedAt)}</span>
        </span>
        <span className={cn("block min-w-0 break-words font-bold leading-[1.08] text-[#fff8e6] group-hover:text-[#df2f2f]", size === "major" ? "text-xl sm:text-2xl" : "text-base")}>
          {item.title}
        </span>
      </a>
    </article>
  )
}

function EditionModule({ edition, dossiers, signals }: { edition?: FrontPageEdition | null; dossiers: EditionItem[]; signals: EditionItem[] }) {
  return (
    <section className={cn("grid gap-3 p-3", archiveSurface)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f4efe2]/10 pb-3">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
          <FileText className="h-4 w-4" />
          Inverted edition
        </span>
        {edition?.publishedAt ? <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/46">{formatDate(edition.publishedAt)}</span> : null}
      </div>
      <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">{edition?.headline || "Latest dossiers"}</h2>
      {edition?.deck ? <p className="text-sm leading-6 text-[#f4efe2]/62">{edition.deck}</p> : null}
      <div className="grid gap-2">
        {[...dossiers.slice(0, 4), ...signals.slice(0, 2)].map((item) => (
          <a key={`${item.href}-${item.title}`} href={item.href} className="group grid gap-1 border-t border-[#f4efe2]/10 pt-2 first:border-t-0 first:pt-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">{item.source || topicTitle(item.topicId)}</span>
            <span className="text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#df2f2f]">{item.title}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function ArchiveModule({ videos }: { videos: ChannelVideo[] }) {
  return (
    <section className={cn("grid gap-3 p-3", archiveSurface)}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f4efe2]/10 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Archive</p>
          <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">Newest Tales</h2>
        </div>
        <a href="/archive" className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/54 transition hover:text-[#fff8e6]">
          Archive
          <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
        </a>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {videos.slice(0, 8).map((video) => (
          <a key={video.videoId || video.href} href={video.videoId ? `/archive/${video.videoId}` : video.href} className="group grid grid-cols-[86px_minmax(0,1fr)] gap-3 bg-[#050504]/34 p-2 transition hover:bg-black/68">
            <span className="relative block aspect-video overflow-hidden bg-black/42">
              {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover opacity-86 group-hover:opacity-100" /> : null}
            </span>
            <span className="grid min-w-0 content-center gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">{video.date || "latest"}</span>
              <span className="min-w-0 break-words text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#df2f2f]">{video.title}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

function TopicBlock({ topicId, wires, videos, dossier }: { topicId: string; wires: WorldwireItem[]; videos: ChannelVideo[]; dossier?: ClaimDossier }) {
  const topic = topics.find((item) => item.id === topicId)
  const primaryWire = wires[0]
  const primaryVideo = videos[0]
  return (
    <section id={`topic-${topicId}`} className="scroll-mt-36 bg-[#050504]/34 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#f4efe2]/10 pb-2">
        <h3 className="iw-serif text-3xl leading-none text-[#fff8e6]">{topic?.title || topicId}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">{wires.length + videos.length + (dossier ? 1 : 0)}</span>
      </div>
      <div className="grid gap-2">
        {primaryWire ? (
          <a href={primaryWire.url} target="_blank" rel="noopener noreferrer" className="group grid gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">{sourceLabel(primaryWire.source, primaryWire.url)}</span>
            <span className="text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#df2f2f]">{primaryWire.title}</span>
          </a>
        ) : null}
        {dossier ? (
          <a href={`/news/${dossier.slug}`} className="group grid gap-1 border-t border-[#f4efe2]/10 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">{dossier.sourceCount} sources</span>
            <span className="text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#df2f2f]">{dossier.title}</span>
          </a>
        ) : null}
        {primaryVideo ? (
          <a href={primaryVideo.videoId ? `/archive/${primaryVideo.videoId}` : primaryVideo.href} className="group grid gap-1 border-t border-[#f4efe2]/10 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">Tales archive</span>
            <span className="text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#df2f2f]">{primaryVideo.title}</span>
          </a>
        ) : null}
      </div>
    </section>
  )
}
