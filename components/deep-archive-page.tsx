"use client"

import { useEffect, useState } from "react"
import { RefreshCw, Youtube } from "lucide-react"
import { channelProfile, featuredVideos, type ChannelVideo } from "@/data/inverted-world"
import { archiveSurface, ExternalAction, InvertedPageShell } from "@/components/inverted-page-shell"
import { cn } from "@/lib/utils"

type ArchiveResponse = {
  sourceMode?: string
  completeHistoryAvailable?: boolean
  videos?: ChannelVideo[]
  warnings?: string[]
}

const seedVideos = featuredVideos.filter((video) => video.source === "YouTube" && video.embedUrl)

export function DeepArchivePage() {
  const [videos, setVideos] = useState<ChannelVideo[]>(seedVideos)
  const [mode, setMode] = useState("seed")
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  async function loadArchive() {
    setLoading(true)
    try {
      const response = await fetch("/api/archive")
      const data = (await response.json()) as ArchiveResponse
      setVideos(data.videos?.length ? data.videos : seedVideos)
      setMode(data.sourceMode || "seed")
      setWarnings(data.warnings ?? [])
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : "Archive load failed"])
      setVideos(seedVideos)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadArchive()
  }, [])

  return (
    <InvertedPageShell
      eyebrow={`${videos.length} embedded videos`}
      title="Deep archive"
      action={<ExternalAction href="https://www.youtube.com/@TalesfromtheInvertedWorld/videos">YouTube</ExternalAction>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className={cn("p-3", archiveSurface)}>
          <div className="relative aspect-video overflow-hidden border border-[#f4efe2]/10 bg-[#050504]/45">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={channelProfile.youtubeUploadsEmbedUrl}
              title="Tales From the Inverted World uploads playlist"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
        <div className={cn("flex min-h-[220px] flex-col justify-between p-5", archiveSurface)}>
          <div>
            <Youtube className="h-6 w-6 text-[#e8b45c]" />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#f4efe2]/48">{mode}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#fff8e6]">Every available upload, embedded.</h2>
            <p className="mt-4 text-sm leading-6 text-[#f4efe2]/62">Full history unlocks with the YouTube API.</p>
          </div>
          <button
            onClick={() => void loadArchive()}
            className="mt-6 inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[#7dd3fc]/35 bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:bg-[#7dd3fc]/12"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {warnings.length > 0 && <p className="mt-4 text-xs text-[#e8b45c]/72">{warnings.slice(0, 2).join(" | ")}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <article key={video.videoId || video.href} className={cn("overflow-hidden", archiveSurface)}>
            <div className="relative aspect-video bg-[#050504]/45">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={video.embedUrl}
                title={video.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <a
              href={video.href}
              target="_blank"
              rel="noreferrer"
              className="block p-3 text-sm font-semibold leading-5 text-[#fff8e6] transition hover:text-[#e8b45c]"
            >
              {video.title}
            </a>
          </article>
        ))}
      </div>
    </InvertedPageShell>
  )
}
