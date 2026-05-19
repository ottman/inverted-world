"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Play, RefreshCw, Search, Youtube } from "lucide-react"
import { channelProfile, featuredVideos, type ChannelVideo } from "@/data/inverted-world"
import { archiveSurface, ExternalAction, InvertedPageShell } from "@/components/inverted-page-shell"
import { cn } from "@/lib/utils"
import type { DeepArchiveResponse } from "@/lib/deep-archive"

type ArchiveResponse = {
  sourceMode?: string
  completeHistoryAvailable?: boolean
  videos?: ChannelVideo[]
  totalCount?: number
  offset?: number
  limit?: number
  hasMore?: boolean
  warnings?: string[]
}

const PAGE_SIZE = 24
const seedVideos = featuredVideos.filter((video) => video.source === "YouTube" && video.embedUrl)

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

export function DeepArchivePage({ initialArchive }: { initialArchive?: DeepArchiveResponse }) {
  const initialVideos = initialArchive?.videos?.length ? initialArchive.videos : seedVideos
  const [videos, setVideos] = useState<ChannelVideo[]>(initialVideos)
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | undefined>(initialVideos[0])
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState(initialArchive?.sourceMode || "seed")
  const [warnings, setWarnings] = useState<string[]>(initialArchive?.warnings ?? [])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(initialArchive?.totalCount ?? initialVideos.length)
  const [nextOffset, setNextOffset] = useState((initialArchive?.offset ?? 0) + (initialArchive?.limit ?? initialVideos.length))
  const [hasMore, setHasMore] = useState(Boolean(initialArchive?.hasMore))

  async function loadArchive({ offset = 0, append = false } = {}) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      const response = await fetch(`/api/archive?${params.toString()}`)
      if (!response.ok) throw new Error(`Archive returned ${response.status}`)

      const data = (await response.json()) as ArchiveResponse
      const incoming = data.videos?.length ? data.videos : seedVideos
      const nextVideos = append ? mergeVideos(videos, incoming) : incoming

      setVideos(nextVideos)
      setSelectedVideo((current) =>
        current && nextVideos.some((video) => videoKey(video) === videoKey(current)) ? current : nextVideos[0],
      )
      setMode(data.sourceMode || "seed")
      setWarnings(data.warnings ?? [])
      setTotalCount(data.totalCount ?? nextVideos.length)
      setNextOffset((data.offset ?? offset) + (data.limit ?? incoming.length))
      setHasMore(Boolean(data.hasMore))
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : "Archive load failed"])
      setVideos(seedVideos)
      setSelectedVideo(seedVideos[0])
      setTotalCount(seedVideos.length)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialArchive) void loadArchive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return videos
    return videos.filter((video) => `${video.title} ${video.date}`.toLowerCase().includes(normalizedQuery))
  }, [query, videos])

  const selectedEmbed = selectedVideo?.embedUrl || channelProfile.youtubeUploadsEmbedUrl
  const archiveCount = totalCount || videos.length

  return (
    <InvertedPageShell
      eyebrow={`${archiveCount} uploads`}
      title="Archive"
      action={<ExternalAction href="https://www.youtube.com/@TalesfromtheInvertedWorld/videos">YouTube</ExternalAction>}
    >
      <section className="grid gap-4 lg:grid-cols-[1.22fr_0.78fr]">
        <div className={cn("p-3", archiveSurface)}>
          <div className="relative aspect-video overflow-hidden border border-[#f4efe2]/10 bg-[#050504]/55">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={selectedEmbed}
              title={selectedVideo?.title || "Tales From the Inverted World uploads playlist"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <aside className={cn("flex min-h-[260px] flex-col justify-between p-5", archiveSurface)}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <Youtube className="h-6 w-6 text-[#e8b45c]" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f4efe2]/48">{mode}</span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold leading-tight text-[#fff8e6]">
              {selectedVideo?.title || "Tales From the Inverted World"}
            </h2>
            {selectedVideo?.date && <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#e8b45c]">{selectedVideo.date}</p>}
            {selectedVideo?.videoId && (
              <a
                href={`/archive/${selectedVideo.videoId}`}
                className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#dff7ff] transition hover:text-[#e8b45c]"
              >
                Open dossier
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="mt-6 grid gap-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f4efe2]/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search loaded uploads"
                className="h-11 w-full rounded-md border border-[#f4efe2]/12 bg-[#070706]/35 pl-10 pr-3 text-sm text-[#fff8e6] outline-none transition placeholder:text-[#f4efe2]/34 focus:border-[#e8b45c]/55"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadArchive()}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[#7dd3fc]/35 bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:bg-[#7dd3fc]/12 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </aside>
      </section>

      {warnings.length > 0 && <p className="mt-4 text-xs text-[#e8b45c]/72">{warnings.slice(0, 2).join(" | ")}</p>}

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className={cn("p-3", archiveSurface)}>
          <div className="relative aspect-video overflow-hidden border border-[#f4efe2]/10 bg-[#050504]/45">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={channelProfile.youtubeUploadsEmbedUrl}
              title="Tales From the Inverted World uploads playlist"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <div className={cn("p-4", archiveSurface)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f4efe2]/54">
              {filteredVideos.length} shown / {archiveCount}
            </p>
            <p className="text-xs uppercase tracking-[0.16em] text-[#f4efe2]/38">each card has an indexable dossier</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filteredVideos.map((video) => {
              const active = videoKey(video) === videoKey(selectedVideo || video)
              return (
                <article
                  key={videoKey(video)}
                  className={cn("group overflow-hidden rounded-md border bg-[#070706]/26 transition hover:border-[#e8b45c]/45", active ? "border-[#e8b45c]/70" : "border-[#f4efe2]/12")}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedVideo(video)}
                    className="relative block aspect-video w-full bg-[#050504]/60 text-left"
                    aria-label={`Play ${video.title}`}
                  >
                    {video.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82" />
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-[#070706]/24 transition group-hover:bg-[#070706]/10">
                      <Play className="h-7 w-7 fill-[#fff8e6] text-[#fff8e6]" />
                    </span>
                  </button>
                  <div className="flex min-h-[128px] flex-col justify-between p-3">
                    <span className="line-clamp-3 text-sm font-semibold leading-5 text-[#fff8e6]">{video.title}</span>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">{video.date || "upload"}</span>
                      {video.videoId && (
                        <a
                          href={`/archive/${video.videoId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:text-[#e8b45c]"
                        >
                          Dossier
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {hasMore && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => void loadArchive({ offset: nextOffset, append: true })}
                className="inline-flex h-11 items-center rounded-md border border-[#e8b45c]/45 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#e8b45c]/12 disabled:cursor-wait disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Loading" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </section>
    </InvertedPageShell>
  )
}
