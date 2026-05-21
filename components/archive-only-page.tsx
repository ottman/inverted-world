"use client"

import { useMemo, useState } from "react"
import { ArrowUpRight, Play, RefreshCw, Youtube } from "lucide-react"
import { archiveSurface, ExternalAction, InvertedPageShell } from "@/components/inverted-page-shell"
import { channelProfile, topics, type ChannelVideo } from "@/data/inverted-world"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import { cn } from "@/lib/utils"
import type { DeepArchiveResponse } from "@/lib/deep-archive"

type ArchiveResponse = {
  sourceMode?: DeepArchiveResponse["sourceMode"]
  videos?: ChannelVideo[]
  totalCount?: number
  offset?: number
  limit?: number
  hasMore?: boolean
  warnings?: string[]
}

type TopicFeeds = Record<string, IntelligenceArticle[]>

const PAGE_SIZE = 120

function videoKey(video: ChannelVideo) {
  return video.videoId || video.href
}

function mergeVideos(current: ChannelVideo[], incoming: ChannelVideo[]) {
  const seen = new Set<string>()
  return [...current, ...incoming].filter((video) => {
    const key = videoKey(video)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatSourceMode(mode: DeepArchiveResponse["sourceMode"]) {
  if (mode === "youtube-data-api") return "YouTube API"
  if (mode === "rss-plus-seed") return "YouTube RSS"
  return "seed archive"
}

function normalizeDate(value?: string) {
  if (!value) return "live"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function ArchiveOnlyPage({
  initialArchive,
  initialTopicFeeds,
}: {
  initialArchive?: DeepArchiveResponse
  initialTopicFeeds?: TopicFeeds
}) {
  const initialVideos = initialArchive?.videos ?? []
  const [videos, setVideos] = useState<ChannelVideo[]>(initialVideos)
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | undefined>(initialVideos[0])
  const [mode, setMode] = useState<DeepArchiveResponse["sourceMode"]>(initialArchive?.sourceMode || "seed")
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(initialArchive?.totalCount ?? initialVideos.length)
  const [nextOffset, setNextOffset] = useState((initialArchive?.offset ?? 0) + (initialArchive?.limit ?? initialVideos.length))
  const [hasMore, setHasMore] = useState(Boolean(initialArchive?.hasMore))

  const videosByTopic = useMemo(() => {
    const map = new Map<string, ChannelVideo[]>()
    for (const topic of topics) map.set(topic.id, [])
    for (const video of videos) {
      const key = map.has(video.topicId) ? video.topicId : "secret-programs"
      map.get(key)?.push(video)
    }
    return map
  }, [videos])

  const leadVideo = selectedVideo || videos[0]
  const selectedTopic = topics.find((topic) => topic.id === leadVideo?.topicId) || topics[0]

  async function loadMore() {
    if (loading) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      })
      const response = await fetch(`/api/archive?${params.toString()}`)
      if (!response.ok) throw new Error(`Archive returned ${response.status}`)
      const data = (await response.json()) as ArchiveResponse
      const incoming = data.videos ?? []
      const nextVideos = mergeVideos(videos, incoming)

      setVideos(nextVideos)
      setSelectedVideo((current) =>
        current && nextVideos.some((video) => videoKey(video) === videoKey(current)) ? current : nextVideos[0],
      )
      setMode(data.sourceMode || mode)
      setTotalCount(data.totalCount ?? nextVideos.length)
      setNextOffset((data.offset ?? nextOffset) + (data.limit ?? incoming.length))
      setHasMore(Boolean(data.hasMore))
    } catch (error) {
      console.warn(error instanceof Error ? error.message : "Archive load failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <InvertedPageShell
      eyebrow={`${totalCount || videos.length} uploads / ${formatSourceMode(mode)} / hourly feeds`}
      title="Archive"
      action={<ExternalAction href="https://www.youtube.com/@TalesfromtheInvertedWorld/videos">YouTube</ExternalAction>}
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <div className={cn("p-2 sm:p-3", archiveSurface)}>
          <div className="relative aspect-video overflow-hidden border border-[#f4efe2]/10 bg-[#050504]/60">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={leadVideo?.embedUrl || channelProfile.youtubeUploadsEmbedUrl}
              title={leadVideo?.title || "Tales From the Inverted World uploads"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <aside className={cn("flex flex-col justify-between gap-6 p-4 sm:p-5", archiveSurface)}>
          <div>
            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">
              <span>{selectedTopic.title}</span>
              <Youtube className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold leading-tight text-[#fff8e6]">{leadVideo?.title || "Live uploads"}</h2>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/48">{leadVideo?.date || "latest upload"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {leadVideo?.videoId && (
              <a
                href={`/archive/${leadVideo.videoId}`}
                className="inline-flex h-10 items-center gap-2 border border-[#e8b45c]/45 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#e8b45c]/12"
              >
                Video page
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="inline-flex h-10 items-center gap-2 border border-[#7dd3fc]/35 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:bg-[#7dd3fc]/12 disabled:cursor-wait disabled:opacity-60"
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                More
              </button>
            )}
          </div>
        </aside>
      </section>

      <div className="mt-8 grid gap-8">
        {topics.map((topic) => {
          const topicVideos = videosByTopic.get(topic.id) ?? []
          const feed = initialTopicFeeds?.[topic.id] ?? []
          return (
            <section id={`topic-${topic.id}`} key={topic.id} className={cn("scroll-mt-28 p-4 sm:p-5", archiveSurface)}>
              <div className="flex flex-col gap-3 border-b border-[#f4efe2]/10 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">{topic.signal}</p>
                  <h2 className="mt-2 text-3xl font-semibold leading-none text-[#fff8e6] sm:text-4xl">{topic.title}</h2>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/48">
                  {topicVideos.length} videos / {feed.length} live links
                </p>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
                <LiveFeed topicTitle={topic.title} articles={feed} />
                <VideoGrid videos={topicVideos} selectedVideo={leadVideo} onSelect={setSelectedVideo} />
              </div>
            </section>
          )
        })}
      </div>
    </InvertedPageShell>
  )
}

function LiveFeed({ topicTitle, articles }: { topicTitle: string; articles: IntelligenceArticle[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Hourly feed</h3>
        <span className="text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">{topicTitle}</span>
      </div>
      <div className="grid gap-3">
        {articles.slice(0, 5).map((article) => (
          <a
            key={article.id}
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="group block border border-[#f4efe2]/10 bg-[#050504]/36 p-3 transition hover:border-[#e8b45c]/45 hover:bg-[#070706]/58"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#e8b45c]">{article.title}</span>
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#f4efe2]/38 group-hover:text-[#e8b45c]" />
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#f4efe2]/42">
              <span>{article.source}</span>
              <span>/</span>
              <span>{normalizeDate(article.publishedAt)}</span>
            </span>
          </a>
        ))}
        {!articles.length && (
          <div className="border border-[#f4efe2]/10 bg-[#050504]/24 p-3 text-sm text-[#f4efe2]/56">
            Feed unavailable right now.
          </div>
        )}
      </div>
    </div>
  )
}

function VideoGrid({
  videos,
  selectedVideo,
  onSelect,
}: {
  videos: ChannelVideo[]
  selectedVideo?: ChannelVideo
  onSelect: (video: ChannelVideo) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {videos.map((video) => {
        const active = videoKey(video) === videoKey(selectedVideo || video)
        return (
          <article
            key={videoKey(video)}
            className={cn(
              "group overflow-hidden border bg-[#050504]/36 transition hover:border-[#e8b45c]/45",
              active ? "border-[#e8b45c]/70" : "border-[#f4efe2]/10",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(video)}
              className="relative block aspect-video w-full bg-[#050504]/70 text-left"
              aria-label={`Play ${video.title}`}
            >
              {video.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-[#070706]/24 transition group-hover:bg-[#070706]/8">
                <Play className="h-7 w-7 fill-[#fff8e6] text-[#fff8e6]" />
              </span>
            </button>
            <div className="flex min-h-[126px] flex-col justify-between p-3">
              <h3 className="line-clamp-3 text-sm font-semibold leading-5 text-[#fff8e6]">{video.title}</h3>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.12em] text-[#f4efe2]/42">{video.date || "upload"}</span>
                {video.videoId && (
                  <a
                    href={`/archive/${video.videoId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#dff7ff] transition hover:text-[#e8b45c]"
                  >
                    Page
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </article>
        )
      })}
      {!videos.length && (
        <div className="border border-[#f4efe2]/10 bg-[#050504]/24 p-3 text-sm text-[#f4efe2]/56">
          No archive videos classified here yet.
        </div>
      )}
    </div>
  )
}
