"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Play, RefreshCw, Youtube } from "lucide-react"
import { archiveSurface, InvertedPageShell, XIcon, type BreakingItem } from "@/components/inverted-page-shell"
import { channelProfile, topics, type ChannelVideo, type ContentTopic } from "@/data/inverted-world"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import { articleHref } from "@/lib/news-links"
import { getTopicXSearchUrl } from "@/lib/x-search"
import { xPostInternalHref } from "@/lib/x-links"
import { cn } from "@/lib/utils"
import type { DeepArchiveResponse } from "@/lib/deep-archive"
import type { ViralXPost } from "@/lib/x-posts"

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
type TopicXPosts = Record<string, ViralXPost[]>

const PAGE_SIZE = 120
const HOMEPAGE_TOPIC_VIDEO_LIMIT = 6

function videoKey(video: ChannelVideo) {
  return video.videoId || video.href
}

function isShortVideo(video: ChannelVideo) {
  const title = video.title.toLowerCase()
  return video.kind === "short" || title.includes("#shorts") || video.href.includes("/shorts/")
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

function normalizeDate(value?: string) {
  if (!value) return "live"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatMetricCount(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  return String(Math.round(value))
}

function postMetricLabel(post: ViralXPost) {
  const likes = formatMetricCount(post.metrics?.likes)
  const reposts = formatMetricCount(post.metrics?.reposts)
  const replies = formatMetricCount(post.metrics?.replies)
  const views = formatMetricCount(post.metrics?.views)
  const parts = [
    likes ? `${likes} likes` : undefined,
    reposts ? `${reposts} reposts` : undefined,
    replies ? `${replies} replies` : undefined,
    views ? `${views} views` : undefined,
  ].filter(Boolean)

  if (parts.length) return parts.slice(0, 3).join(" / ")
  if (typeof post.score === "number" && post.score > 0) return `${formatMetricCount(post.score)} signal`
  return "curated signal"
}

function topicById(topicId?: string) {
  return topics.find((topic) => topic.id === topicId)
}

function openInAppPostSignal(post: ViralXPost, fallbackTopicId: string) {
  window.location.href = xPostInternalHref(post, fallbackTopicId)
}

export function ArchiveOnlyPage({
  initialArchive,
  initialTopicFeeds,
  initialTopicXPosts,
  initialLiveVideo,
}: {
  initialArchive?: DeepArchiveResponse
  initialTopicFeeds?: TopicFeeds
  initialTopicXPosts?: TopicXPosts
  initialLiveVideo?: ChannelVideo
}) {
  const initialVideos = initialArchive?.videos ?? []
  const initialLeadVideo = initialLiveVideo || initialVideos.find((video) => !isShortVideo(video)) || initialVideos[0]
  const [videos, setVideos] = useState<ChannelVideo[]>(initialVideos)
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | undefined>(initialLeadVideo)
  const [autoplayVideoKey, setAutoplayVideoKey] = useState<string | undefined>()
  const [playRequest, setPlayRequest] = useState(0)
  const [pendingScrollKey, setPendingScrollKey] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
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

  const leadVideo = selectedVideo || initialLeadVideo || videos.find((video) => !isShortVideo(video)) || videos[0]
  const leadVideoIsArchiveItem = Boolean(leadVideo && videos.some((video) => videoKey(video) === videoKey(leadVideo)))
  const leadVideoKey = leadVideo ? videoKey(leadVideo) : undefined
  const leadVideoShouldAutoplay = Boolean(leadVideoKey && autoplayVideoKey === leadVideoKey)
  const leadVideoEmbedUrl = videoEmbedUrl(leadVideo, leadVideoShouldAutoplay)
  const selectedTopic = topics.find((topic) => topic.id === leadVideo?.topicId) || topics[0]
  const topicSummaries = useMemo(
    () =>
      topics.map((topic) => ({
        topic,
        videoCount: videosByTopic.get(topic.id)?.length ?? 0,
        liveCount: initialTopicFeeds?.[topic.id]?.length ?? 0,
        xCount: initialTopicXPosts?.[topic.id]?.length ?? 0,
      })),
    [initialTopicFeeds, initialTopicXPosts, videosByTopic],
  )

  useEffect(() => {
    if (!pendingScrollKey || pendingScrollKey !== leadVideoKey) return
    document.getElementById("watch")?.scrollIntoView({ behavior: "smooth", block: "start" })
    setPendingScrollKey(undefined)
  }, [leadVideoKey, pendingScrollKey, playRequest])
  const breakingItems = useMemo<BreakingItem[]>(
    () => {
      const newsItems = Object.values(initialTopicFeeds ?? {})
        .flat()
        .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
        .slice(0, 18)
        .map((article) => ({
          title: article.title,
          href: articleHref(article),
          source: article.source,
        }))

      const xItems = Object.values(initialTopicXPosts ?? {})
        .flat()
        .sort((left, right) => (right.score || 0) - (left.score || 0))
        .slice(0, 18)
        .map((post) => ({
          title: post.text,
          href: xPostInternalHref(post, "uap-disclosure"),
          source: post.username ? `@${post.username}` : "X",
        }))

      return [...xItems.slice(0, 10), ...newsItems.slice(0, 12), ...xItems.slice(10)]
    },
    [initialTopicFeeds, initialTopicXPosts],
  )

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
        current && (current.date === "live" || nextVideos.some((video) => videoKey(video) === videoKey(current)))
          ? current
          : nextVideos.find((video) => !isShortVideo(video)) || nextVideos[0],
      )
      setNextOffset((data.offset ?? nextOffset) + (data.limit ?? incoming.length))
      setHasMore(Boolean(data.hasMore))
    } catch (error) {
      console.warn(error instanceof Error ? error.message : "Archive load failed")
    } finally {
      setLoading(false)
    }
  }

  function selectVideo(video: ChannelVideo) {
    const key = videoKey(video)
    setSelectedVideo(video)
    setAutoplayVideoKey(key)
    setPendingScrollKey(key)
    setPlayRequest((current) => current + 1)
  }

  return (
    <InvertedPageShell
      eyebrow="LIVE Mon - Thurs at 10 p.m. EST"
      title="inverted.world"
      breakingItems={breakingItems}
      heroTitle="Tales From The Inverted World"
      heroDescription=""
    >
      <section id="watch" className="scroll-mt-28 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <div className={cn("p-2 sm:p-3", archiveSurface)}>
          <div className="relative aspect-video overflow-hidden bg-[#050504]/60">
            <iframe
              key={`${leadVideoKey || "uploads"}-${leadVideoShouldAutoplay ? "autoplay" : "idle"}-${playRequest}`}
              className="absolute inset-0 h-full w-full"
              src={leadVideoEmbedUrl}
              title={leadVideo?.title || "Tales From the Inverted World uploads"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <aside className={cn("flex flex-col justify-between gap-6 p-4 sm:p-5", archiveSurface)}>
          <div>
            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
              <span>{selectedTopic.title}</span>
              <Youtube className="h-5 w-5" />
            </div>
            <h2 className="iw-serif mt-4 text-3xl leading-tight text-[#fff8e6]">{leadVideo?.title || "Live uploads"}</h2>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/48">{leadVideo?.date || "latest upload"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {leadVideo?.videoId && (
              <a
                href={leadVideoIsArchiveItem ? `/archive/${leadVideo.videoId}` : leadVideo.href}
                target={leadVideoIsArchiveItem ? undefined : "_blank"}
                rel={leadVideoIsArchiveItem ? undefined : "noopener noreferrer"}
                className="inline-flex h-10 items-center gap-2 bg-[#df2f2f]/10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/18"
              >
                {leadVideoIsArchiveItem ? "Details" : "Watch live"}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="inline-flex h-10 items-center gap-2 bg-[#7dd3fc]/10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:bg-[#7dd3fc]/16 disabled:cursor-wait disabled:opacity-60"
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                More
              </button>
            )}
          </div>
        </aside>
      </section>

      <TopicIndex summaries={topicSummaries} />

      <div className="mt-6 grid gap-6">
        {topics.map((topic) => {
          const topicVideos = videosByTopic.get(topic.id) ?? []
          const visibleTopicVideos = topicVideos.slice(0, HOMEPAGE_TOPIC_VIDEO_LIMIT)
          const feed = initialTopicFeeds?.[topic.id] ?? []
          const xPosts = initialTopicXPosts?.[topic.id] ?? []
          const videoCount =
            topicVideos.length > visibleTopicVideos.length
              ? `${visibleTopicVideos.length} of ${topicVideos.length} videos`
              : `${topicVideos.length} videos`
          return (
            <section id={`topic-${topic.id}`} key={topic.id} className={cn("scroll-mt-36 p-3 sm:p-4", archiveSurface)}>
              <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">{topic.signal}</p>
                  <h2 className="iw-serif mt-2 text-4xl leading-none text-[#fff8e6] sm:text-5xl">{topic.title}</h2>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/48">
                  {videoCount} / {feed.length} live links / {xPosts.length || "live"} X
                </p>
              </div>

              <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
                <div className="grid min-w-0 gap-4">
                  <LiveFeed topicTitle={topic.title} articles={feed} />
                  <XSignalLane topic={topic} posts={xPosts} />
                </div>
                <VideoGrid videos={visibleTopicVideos} activeVideoKey={leadVideoKey} onSelect={selectVideo} />
              </div>
            </section>
          )
        })}
      </div>
    </InvertedPageShell>
  )
}

function videoEmbedUrl(video?: ChannelVideo, autoplay = false) {
  const source = video?.embedUrl || channelProfile.youtubeUploadsEmbedUrl
  if (!source) return source

  try {
    const url = new URL(source)
    url.searchParams.set("rel", "0")
    url.searchParams.set("playsinline", "1")
    if (autoplay) {
      url.searchParams.set("autoplay", "1")
    }
    url.searchParams.set("controls", "1")
    url.searchParams.set("playsinline", "1")
    return url.toString()
  } catch {
    if (!autoplay) return source
    const separator = source.includes("?") ? "&" : "?"
    return `${source}${separator}autoplay=1&playsinline=1`
  }
}

function TopicIndex({
  summaries,
}: {
  summaries: Array<{ topic: ContentTopic; videoCount: number; liveCount: number; xCount: number }>
}) {
  return (
    <section className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {summaries.map(({ topic, videoCount, liveCount, xCount }) => (
        <a
          key={topic.id}
          href={`#topic-${topic.id}`}
          className="group grid min-h-[132px] content-between bg-[#050504]/38 p-3 transition hover:bg-black/62"
        >
          <span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
              {topic.title}
            </span>
            <span className="mt-2 block text-xs leading-5 text-[#f4efe2]/58">{topic.signal}</span>
          </span>
          <span className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#f4efe2]/42 group-hover:text-[#fff8e6]">
            <span>{videoCount} videos</span>
            <span>{liveCount} links</span>
            <span>{xCount ? `${xCount} X` : "X stream"}</span>
          </span>
        </a>
      ))}
    </section>
  )
}

function XSignalLane({ topic, posts }: { topic: ContentTopic; posts: ViralXPost[] }) {
  const signalUrl = `/x/${topic.id}`
  const visiblePosts = posts.slice(0, 3)

  return (
    <section className="bg-[#050504]/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">
          <XIcon className="h-4 w-4 text-[#df2f2f]" />
          X signal
        </h3>
        <a
          href={signalUrl}
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#dff7ff] transition hover:text-[#df2f2f]"
        >
          More X
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <EmbeddedTweetGrid posts={visiblePosts} topicId={topic.id} />
    </section>
  )
}

function EmbeddedTweetGrid({ posts, topicId }: { posts: ViralXPost[]; topicId: string }) {
  if (!posts.length) {
    const topic = topicById(topicId)
    return (
      <a
        href={topic ? getTopicXSearchUrl(topic) : `/x/${topicId}`}
        target={topic ? "_blank" : undefined}
        rel={topic ? "noopener noreferrer" : undefined}
        className="block bg-black p-4 text-sm leading-6 text-[#f4efe2]/62 transition hover:text-[#fff8e6]"
      >
        Open live X search for this lane.
      </a>
    )
  }

  return (
    <div className="grid gap-3">
      {posts.map((post) => (
        <article
          key={post.id || post.url}
          role="link"
          tabIndex={0}
          onClick={() => openInAppPostSignal(post, topicId)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              openInAppPostSignal(post, topicId)
            }
          }}
          className="block cursor-pointer bg-black/72 p-3 transition hover:bg-black"
        >
          <p className="line-clamp-4 text-sm leading-5 text-[#f4efe2]/74">{post.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/44">
            {post.username && <span>@{post.username}</span>}
            <span>{postMetricLabel(post)}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

function LiveFeed({ topicTitle, articles }: { topicTitle: string; articles: IntelligenceArticle[] }) {
  const visibleArticles = articles.slice(0, 12)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Hourly feed</h3>
        <span className="text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">{topicTitle}</span>
      </div>
      <div className="grid gap-2">
        {visibleArticles.map((article) => (
          <a
            key={article.id}
            href={articleHref(article)}
            className="group grid gap-3 bg-[#050504]/36 p-2.5 transition hover:bg-[#070706]/58 data-[image=true]:grid-cols-[72px_minmax(0,1fr)]"
            data-image={Boolean(article.thumbnail.imageUrl)}
          >
            {article.thumbnail.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.thumbnail.imageUrl} alt="" className="aspect-square h-[72px] w-[72px] object-cover opacity-88" />
            ) : null}
            <span className="min-w-0">
              <span className="flex items-start justify-between gap-3">
                <span className="iw-serif text-xl leading-[1.05] text-[#fff8e6] group-hover:text-[#df2f2f]">{article.title}</span>
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#f4efe2]/38 group-hover:text-[#df2f2f]" />
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/42">
                <span>{article.source}</span>
                <span>/</span>
                <span>{normalizeDate(article.publishedAt)}</span>
              </span>
            </span>
          </a>
        ))}
        {!articles.length && (
          <a href="/news" className="block bg-[#050504]/24 p-3 text-sm text-[#f4efe2]/56 transition hover:text-[#fff8e6]">
            Open the news desk for current dossiers and source clusters.
          </a>
        )}
      </div>
    </div>
  )
}

function VideoGrid({
  videos,
  activeVideoKey,
  onSelect,
}: {
  videos: ChannelVideo[]
  activeVideoKey?: string
  onSelect: (video: ChannelVideo) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {videos.map((video) => {
        const active = activeVideoKey === videoKey(video)
        return (
          <button
            type="button"
            key={videoKey(video)}
            onClick={() => onSelect(video)}
            className={cn(
              "group overflow-hidden bg-[#050504]/36 text-left transition hover:bg-[#070706]/62",
              active && "ring-1 ring-[#df2f2f]/55",
            )}
            aria-label={`Play ${video.title}`}
          >
            <span className="relative block aspect-video w-full bg-[#050504]/70 text-left">
              {video.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-[#070706]/24 transition group-hover:bg-[#070706]/8">
                <Play className="h-7 w-7 fill-[#fff8e6] text-[#fff8e6]" />
              </span>
            </span>
            <div className="flex min-h-[126px] flex-col justify-between p-3">
              <h3 className="iw-serif line-clamp-3 text-xl leading-[1.05] text-[#fff8e6]">{video.title}</h3>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.12em] text-[#f4efe2]/42">{video.date || "upload"}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#dff7ff] transition group-hover:text-[#df2f2f]">
                  {active ? "Playing" : "Play"}
                </span>
              </div>
            </div>
          </button>
        )
      })}
      {!videos.length && (
        <a href="/archive" className="bg-[#050504]/24 p-3 text-sm text-[#f4efe2]/56 transition hover:text-[#fff8e6]">
          Open the full Tales archive.
        </a>
      )}
    </div>
  )
}
