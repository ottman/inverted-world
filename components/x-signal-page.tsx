"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, RefreshCw } from "lucide-react"
import { XIcon } from "@/components/inverted-page-shell"
import type { ContentTopic } from "@/data/inverted-world"
import { getTopicXSearchUrl } from "@/lib/x-search"
import type { ViralXPost } from "@/lib/x-posts"
import { cn } from "@/lib/utils"

function formatMetric(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  return String(Math.round(value))
}

function metricLine(post: ViralXPost) {
  const likes = formatMetric(post.metrics?.likes)
  const reposts = formatMetric(post.metrics?.reposts)
  const replies = formatMetric(post.metrics?.replies)
  const views = formatMetric(post.metrics?.views)
  const parts = [
    likes ? `${likes} likes` : undefined,
    reposts ? `${reposts} reposts` : undefined,
    replies ? `${replies} replies` : undefined,
    views ? `${views} views` : undefined,
  ].filter(Boolean)

  return parts.length ? parts.join(" / ") : "fresh signal"
}

function formatAge(value?: string) {
  if (!value) return "live"
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return "live"
  const minutes = Math.max(Math.floor((Date.now() - time) / 60_000), 0)
  if (minutes < 60) return `${minutes || 1}m`
  return `${Math.floor(minutes / 60)}h`
}

export function XSignalPage({ topic, initialPosts }: { topic: ContentTopic; initialPosts: ViralXPost[] }) {
  const [posts, setPosts] = useState(initialPosts)
  const [updatedAt, setUpdatedAt] = useState(new Date().toISOString())
  const [refreshing, setRefreshing] = useState(false)
  const tickerPosts = useMemo(() => (posts.length ? [...posts, ...posts] : []), [posts])

  useEffect(() => {
    let active = true

    async function loadPosts() {
      setRefreshing(true)
      try {
        const response = await fetch(`/api/x/${topic.id}?limit=24`, { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as { posts?: ViralXPost[]; generatedAt?: string }
        if (active) {
          setPosts(data.posts || [])
          setUpdatedAt(data.generatedAt || new Date().toISOString())
        }
      } finally {
        if (active) setRefreshing(false)
      }
    }

    const interval = window.setInterval(() => void loadPosts(), 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [topic.id])

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden bg-[#070706]/32 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
            <XIcon className="h-4 w-4" />
            Live X Stream
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-[#f4efe2]/48">
            <span>last pull {formatAge(updatedAt)} ago</span>
            <span>last 7 days</span>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin text-[#df2f2f]")} />
          </div>
        </div>
        {tickerPosts.length ? (
          <div className="iw-breaking-scroll overflow-hidden py-2">
            <div className="iw-breaking-track flex w-max gap-4">
              {tickerPosts.map((post, index) => (
                <a
                  key={`${post.id}-${index}`}
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex max-w-[520px] shrink-0 items-center gap-2 bg-black/42 px-3 py-2 text-xs text-[#f4efe2]/72 transition hover:text-[#fff8e6]"
                >
                  <span className="text-[#df2f2f]">@{post.username || "x"}</span>
                  <span className="truncate">{post.text}</span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-black/36 p-4 text-sm text-[#f4efe2]/62">
            No embeddable posts found this week. The live search is still available.
          </div>
        )}
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {posts.map((post) => (
            <a
              key={post.id || post.url}
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="group grid min-h-[172px] gap-5 bg-[#050504]/46 p-4 transition hover:bg-black/72"
            >
              <div>
                <div className="mb-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-[#f4efe2]/44">
                  <span>@{post.username || "x"}</span>
                  <span>{formatAge(post.createdAt)}</span>
                </div>
                <p className="line-clamp-5 text-sm leading-6 text-[#fff8e6] group-hover:text-[#df2f2f]">{post.text}</p>
              </div>
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/44">
                <span>{metricLine(post)}</span>
                <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
              </div>
            </a>
          ))}
        </div>

        <aside className="grid gap-3 bg-black/30 p-4">
          <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">{topic.title}</h2>
          <p className="text-sm leading-6 text-[#f4efe2]/64">{topic.signal}</p>
          <a
            href={getTopicXSearchUrl(topic)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 bg-[#df2f2f]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/22"
          >
            Open X search
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <p className="text-xs leading-5 text-[#f4efe2]/44">
            Follow the fastest posts, source links, and counterarguments in this lane. Strong signals move into dossiers
            and front-page coverage as the record develops.
          </p>
        </aside>
      </section>
    </div>
  )
}
