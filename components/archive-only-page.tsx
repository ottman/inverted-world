"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Play, RefreshCw, Youtube } from "lucide-react"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { channelProfile, topics, type ChannelVideo, type ContentTopic } from "@/data/inverted-world"
import { cn } from "@/lib/utils"
import type { DeepArchiveResponse } from "@/lib/deep-archive"
import { youtubeEmbedUrl } from "@/lib/youtube-embed"

type ArchiveResponse = {
  sourceMode?: DeepArchiveResponse["sourceMode"]
  videos?: ChannelVideo[]
  totalCount?: number
  offset?: number
  limit?: number
  hasMore?: boolean
  warnings?: string[]
}

export type VideoRelatedStory = {
  title: string
  href: string
  source?: string
  publishedAt?: string
  topicId?: string
  dossierHref?: string
  dossierTitle?: string
  relatedVideoKeys?: string[]
}

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

export function ArchiveOnlyPage({
  initialArchive,
  initialLiveVideo,
  initialRelatedStories = [],
}: {
  initialArchive?: DeepArchiveResponse
  initialLiveVideo?: ChannelVideo
  initialRelatedStories?: VideoRelatedStory[]
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
  const relatedStories = useMemo(
    () => storiesForVideo(leadVideo, initialRelatedStories).slice(0, 18),
    [initialRelatedStories, leadVideo],
  )
  const topicSummaries = useMemo(
    () =>
      topics.map((topic) => ({
        topic,
        videoCount: videosByTopic.get(topic.id)?.length ?? 0,
      })),
    [videosByTopic],
  )

  useEffect(() => {
    if (!pendingScrollKey || pendingScrollKey !== leadVideoKey) return
    document.getElementById("watch")?.scrollIntoView({ behavior: "smooth", block: "start" })
    setPendingScrollKey(undefined)
  }, [leadVideoKey, pendingScrollKey, playRequest])

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
      heroTitle="Tales From The Inverted World"
      heroDescription=""
    >
      <section id="watch" className="scroll-mt-28 grid gap-4 lg:grid-cols-[minmax(0,1.32fr)_minmax(340px,0.68fr)]">
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
          {relatedStories.length ? <RelatedStoriesRail stories={relatedStories} /> : null}
        </div>

        <aside className={cn("flex flex-col justify-between gap-6 p-4 sm:p-5", archiveSurface)}>
          <div>
            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
              <span>{selectedTopic.title}</span>
              <Youtube className="h-5 w-5" />
            </div>
            <h2 className="iw-serif mt-4 text-5xl leading-[0.86] text-[#fff8e6] sm:text-6xl lg:text-5xl xl:text-6xl">
              {leadVideo?.title || "Live uploads"}
            </h2>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/48">{leadVideo?.date || "latest upload"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {leadVideo?.videoId && relatedStories.length ? (
              <a
                href="#related-stories"
                className="inline-flex h-10 items-center gap-2 bg-[#df2f2f]/10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/18"
              >
                More details
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : leadVideo?.videoId ? (
              <a
                href={leadVideoIsArchiveItem ? `/archive/${leadVideo.videoId}` : leadVideo.href}
                target={leadVideoIsArchiveItem ? undefined : "_blank"}
                rel={leadVideoIsArchiveItem ? undefined : "noopener noreferrer"}
                className="inline-flex h-10 items-center gap-2 bg-[#df2f2f]/10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/18"
              >
                {leadVideoIsArchiveItem ? "Episode page" : "Watch live"}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : null}
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/48">{videoCount}</p>
              </div>

              <VideoGrid videos={visibleTopicVideos} activeVideoKey={leadVideoKey} onSelect={selectVideo} />
            </section>
          )
        })}
      </div>
    </InvertedPageShell>
  )
}

function videoEmbedUrl(video?: ChannelVideo, autoplay = false) {
  return youtubeEmbedUrl({
    videoId: video?.videoId,
    source: video?.embedUrl || video?.href || channelProfile.youtubeUploadsEmbedUrl,
    autoplay,
  })
}

function normalizedTextTokens(value?: string) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4),
  )
}

function tokenOverlap(left?: string, right?: string) {
  const leftTokens = normalizedTextTokens(left)
  const rightTokens = normalizedTextTokens(right)
  let count = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) count += 1
  }
  return count
}

function storiesForVideo(video: ChannelVideo | undefined, stories: VideoRelatedStory[]) {
  if (!video) return []
  const keys = new Set([video.videoId, video.href].filter(Boolean))
  const exact = stories.filter((story) => story.relatedVideoKeys?.some((key) => keys.has(key)))
  if (exact.length) return exact

  const titleMatches = stories
    .filter((story) => story.topicId === video.topicId)
    .map((story) => ({ story, score: Math.max(tokenOverlap(video.title, story.title), tokenOverlap(video.title, story.dossierTitle)) }))
    .filter((item) => item.score >= 2)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.story)
  if (titleMatches.length) return titleMatches

  return stories.filter((story) => story.topicId === video.topicId)
}

function displayDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function RelatedStoriesRail({ stories }: { stories: VideoRelatedStory[] }) {
  return (
    <section id="related-stories" className="mt-3 border-t border-[#f4efe2]/10 pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">More details</p>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/42">
          {stories.length} related links
        </span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2">
        {stories.map((story) => {
          const external = story.href.startsWith("http")
          return (
            <a
              key={`${story.href}-${story.title}`}
              href={story.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="group grid min-w-0 gap-1 bg-[#050504]/34 p-2.5 transition hover:bg-black/58"
            >
              <span className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]/82">
                <span className="truncate">{story.source || "Source"}</span>
                {story.publishedAt ? <span className="text-[#f4efe2]/34">{displayDate(story.publishedAt)}</span> : null}
              </span>
              <span className="iw-serif line-clamp-2 text-xl leading-[0.98] text-[#fff8e6] group-hover:text-white">
                {story.title}
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}

function TopicIndex({
  summaries,
}: {
  summaries: Array<{ topic: ContentTopic; videoCount: number }>
}) {
  return (
    <section className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {summaries.map(({ topic, videoCount }) => (
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
          <span className="mt-4 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#f4efe2]/42 group-hover:text-[#fff8e6]">
            {videoCount} videos
          </span>
        </a>
      ))}
    </section>
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="bg-[#050504]/24 p-3 text-sm text-[#f4efe2]/56">
          No videos are indexed for this lane yet.
        </div>
      )}
    </div>
  )
}
