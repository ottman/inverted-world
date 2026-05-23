"use client"

import { useEffect, useMemo, useState } from "react"
import { Archive, ArrowUpRight, Download, FileText, Film, ImageIcon, ListChecks, Play, Search, Volume2 } from "lucide-react"
import { MediaViewer } from "@/components/media-viewer"
import { topics, type MediaLibraryItem } from "@/data/inverted-world"
import { archiveSurface } from "@/components/inverted-page-shell"
import { mediaItemHref } from "@/lib/media-links"
import { cn } from "@/lib/utils"

type MediaFilter = "all" | MediaLibraryItem["kind"]

const filterLabels: Array<{ id: MediaFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "document", label: "Documents" },
  { id: "image", label: "Images" },
  { id: "audio", label: "Audio" },
  { id: "archive", label: "Archives" },
]
const MEDIA_GRID_PAGE_SIZE = 48

function mediaIcon(kind: MediaLibraryItem["kind"]) {
  const className = "h-4 w-4"
  if (kind === "video") return <Film className={className} />
  if (kind === "document") return <FileText className={className} />
  if (kind === "image") return <ImageIcon className={className} />
  if (kind === "audio") return <Volume2 className={className} />
  return <Archive className={className} />
}

function topicName(topicId: string) {
  return topics.find((topic) => topic.id === topicId)?.title || "Inverted"
}

function formatDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export function MediaLibraryPage({
  items,
}: {
  items: MediaLibraryItem[]
}) {
  const [filter, setFilter] = useState<MediaFilter>("all")
  const [topicFilter, setTopicFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState(items[0]?.id)
  const [visibleCount, setVisibleCount] = useState(MEDIA_GRID_PAGE_SIZE)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filter !== "all" && item.kind !== filter) return false
        if (topicFilter !== "all" && !item.topicIds.includes(topicFilter)) return false
        if (!normalizedQuery) return true
        const searchable = [
          item.title,
          item.summary,
          item.source,
          item.fileType || "",
          item.collection || "",
          item.agency || "",
          item.extraction?.brief || "",
          ...(item.extraction?.highlights || []),
        ]
          .join(" ")
          .toLowerCase()
        return searchable.includes(normalizedQuery)
      }),
    [filter, items, normalizedQuery, topicFilter],
  )
  const activeItem =
    filteredItems.find((item) => item.id === selectedId) ||
    filteredItems[0] ||
    items.find((item) => item.id === selectedId) ||
    items[0]
  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasMoreFilteredItems = filteredItems.length > visibleItems.length
  const stats = useMemo(
    () =>
      items.reduce<Record<string, number>>((counts, item) => {
        counts[item.kind] = (counts[item.kind] || 0) + 1
        return counts
      }, {}),
    [items],
  )

  useEffect(() => {
    setVisibleCount(MEDIA_GRID_PAGE_SIZE)
  }, [filter, normalizedQuery, topicFilter])

  function chooseFilter(nextFilter: MediaFilter) {
    setFilter(nextFilter)
    const nextItem = items.find((item) => {
      if (nextFilter !== "all" && item.kind !== nextFilter) return false
      if (topicFilter !== "all" && !item.topicIds.includes(topicFilter)) return false
      return true
    })
    if (nextItem) setSelectedId(nextItem.id)
  }

  function chooseTopic(nextTopic: string) {
    setTopicFilter(nextTopic)
    const nextItem = items.find((item) => {
      if (filter !== "all" && item.kind !== filter) return false
      if (nextTopic !== "all" && !item.topicIds.includes(nextTopic)) return false
      return true
    })
    if (nextItem) setSelectedId(nextItem.id)
  }

  if (!items.length) {
    return (
      <section className={cn("grid gap-3 p-5 text-sm leading-6 text-[#f4efe2]/66", archiveSurface)}>
        <p>The media library is warming up. Open the archive or official source index while the next media sync runs.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/archive" className="bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6]">
            Archive
          </a>
          <a href="/documents" className="bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6]">
            Sources
          </a>
        </div>
      </section>
    )
  }

  return (
    <div className="grid gap-5">
      <section className={cn("grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]", archiveSurface)}>
        <div className="grid gap-3">
          <div className="relative aspect-[16/10] overflow-hidden bg-[#050504]/76 lg:aspect-[16/9]">
            {activeItem ? <MediaViewer item={activeItem} /> : null}
          </div>
          {activeItem ? (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#f4efe2]/48">
              <span className="text-[#df2f2f]">{activeItem.source}</span>
              {activeItem.fileType ? <span>{activeItem.fileType}</span> : null}
              {activeItem.collection ? <span>{activeItem.collection}</span> : null}
              {formatDate(activeItem.publishedAt) ? <span>{formatDate(activeItem.publishedAt)}</span> : null}
            </div>
          ) : null}
        </div>

        {activeItem ? (
          <aside className="flex flex-col justify-between gap-5 bg-[#050504]/32 p-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#df2f2f]">
                {mediaIcon(activeItem.kind)}
                {activeItem.kind}
              </div>
              <h2 className="iw-serif mt-3 text-4xl leading-none text-[#fff8e6]">{activeItem.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#f4efe2]/68">{activeItem.summary}</p>
              {activeItem.extraction ? (
                <div className="mt-4 border-l border-[#df2f2f]/45 pl-3">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
                    <ListChecks className="h-3.5 w-3.5" />
                    Source brief
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#f4efe2]/66">{activeItem.extraction.brief}</p>
                  {activeItem.extraction.highlights.length ? (
                    <ul className="mt-3 grid gap-2 text-xs leading-5 text-[#f4efe2]/58">
                      {activeItem.extraction.highlights.slice(0, 2).map((highlight) => (
                        <li key={highlight} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 bg-[#df2f2f]" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {activeItem.topicIds.map((topicId) => (
                  <a
                    key={topicId}
                    href={`/#topic-${topicId}`}
                    className="bg-black/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/58 transition hover:text-[#fff8e6]"
                  >
                    {topicName(topicId)}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={mediaItemHref(activeItem)}
                className="inline-flex h-10 items-center gap-2 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/72 transition hover:text-[#fff8e6]"
              >
                Media page
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href={activeItem.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 bg-[#df2f2f]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/22"
              >
                Open source
                <ArrowUpRight className="h-4 w-4" />
              </a>
              {activeItem.viewer === "pdf" || activeItem.viewer === "video" || activeItem.viewer === "image" || activeItem.viewer === "audio" ? (
                <a
                  href={activeItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/72 transition hover:text-[#fff8e6]"
                >
                  <Download className="h-4 w-4" />
                  Source file
                </a>
              ) : null}
            </div>
          </aside>
        ) : null}
      </section>

      <section className={cn("grid gap-3 p-3 sm:p-4", archiveSurface)}>
        <div className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#df2f2f]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search media"
                className="h-11 w-full bg-black/32 pl-10 pr-3 text-sm text-[#fff8e6] outline-none ring-1 ring-transparent transition placeholder:text-[#f4efe2]/38 focus:ring-[#df2f2f]/50"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => chooseTopic("all")}
                className={cn(
                  "h-9 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/58 transition hover:text-[#fff8e6]",
                  topicFilter === "all" && "bg-[#df2f2f]/14 text-[#fff8e6]",
                )}
              >
                All Topics
              </button>
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => chooseTopic(topic.id)}
                  className={cn(
                    "h-9 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/58 transition hover:text-[#fff8e6]",
                    topicFilter === topic.id && "bg-[#df2f2f]/14 text-[#fff8e6]",
                  )}
                >
                  {topic.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {filterLabels.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseFilter(item.id)}
                  className={cn(
                    "h-9 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/58 transition hover:text-[#fff8e6]",
                    filter === item.id && "bg-[#df2f2f]/14 text-[#fff8e6]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/42">
              <span>
                {visibleItems.length} of {filteredItems.length} shown
              </span>
              <span>{stats.video || 0} video</span>
              <span>{stats.document || 0} docs</span>
              <span>{stats.image || 0} images</span>
              <span>{stats.audio || 0} audio</span>
            </div>
          </div>
        </div>

        {filteredItems.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((item) => {
                const active = activeItem?.id === item.id
                return (
                  <article
                    key={item.id}
                    className={cn(
                      "group grid min-h-[270px] content-between overflow-hidden bg-[#050504]/42 text-left transition hover:bg-black/62",
                      active && "ring-1 ring-[#df2f2f]/55",
                    )}
                  >
                    <button type="button" onClick={() => setSelectedId(item.id)} className="grid text-left">
                      <span className="relative block aspect-video bg-black/70">
                        {item.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82" />
                        ) : (
                          <span className="absolute inset-0 grid place-items-center bg-[#070706] text-[#df2f2f]/70">{mediaIcon(item.kind)}</span>
                        )}
                        <span className="absolute inset-0 grid place-items-center bg-[#070706]/20 opacity-0 transition group-hover:opacity-100">
                          <Play className="h-7 w-7 fill-[#fff8e6] text-[#fff8e6]" />
                        </span>
                      </span>
                      <span className="grid gap-3 p-3">
                        <span className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">
                          <span>{item.kind}</span>
                          <span>{item.source}</span>
                        </span>
                        <span className="iw-serif line-clamp-3 text-2xl leading-none text-[#fff8e6]">{item.title}</span>
                        <span className="line-clamp-3 text-xs leading-5 text-[#f4efe2]/52">{item.summary}</span>
                      </span>
                    </button>
                    <div className="px-3 pb-3">
                      <a
                        href={mediaItemHref(item)}
                        className="inline-flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/48 transition hover:text-[#fff8e6]"
                      >
                        Open page
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#df2f2f]" />
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
            {hasMoreFilteredItems ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + MEDIA_GRID_PAGE_SIZE)}
                  className="inline-flex h-10 items-center gap-2 bg-black/30 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/14"
                >
                  More media
                  <span className="text-[#df2f2f]">{filteredItems.length - visibleItems.length}</span>
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-3 bg-[#050504]/32 p-5 text-sm leading-6 text-[#f4efe2]/62">
            <p>No media matches this search.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setFilter("all")
                  setTopicFilter("all")
                }}
                className="bg-[#df2f2f]/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/22"
              >
                Clear filters
              </button>
              <a href="/documents" className="bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/72 transition hover:text-[#fff8e6]">
                Source shelf
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
