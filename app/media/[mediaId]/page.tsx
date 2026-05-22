import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, Download, FileText, Play } from "lucide-react"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { MediaViewer } from "@/components/media-viewer"
import { topics, type MediaLibraryItem } from "@/data/inverted-world"
import { mediaItemHref } from "@/lib/media-links"
import { fetchMediaLibraryItem } from "@/lib/media-library"
import { cn } from "@/lib/utils"

type PageProps = {
  params: {
    mediaId: string
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 300

function topicTitle(topicId: string) {
  return topics.find((topic) => topic.id === topicId)?.title || "Inverted World"
}

function formatDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function viewerFrameClass(item: MediaLibraryItem) {
  if (item.viewer === "pdf") return "relative h-[74vh] min-h-[540px] overflow-hidden bg-[#050504]/76"
  if (item.viewer === "image") return "relative min-h-[520px] overflow-hidden bg-[#050504]/76"
  return "relative aspect-video overflow-hidden bg-[#050504]/76"
}

function mediaDescription(item: MediaLibraryItem) {
  const topicNames = item.topicIds.map(topicTitle).join(", ")
  return `${item.summary} Topics: ${topicNames}. Source: ${item.source}.`
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchMediaLibraryItem(params.mediaId)
  if (!result) {
    return {
      title: "Media item",
      robots: {
        index: false,
        follow: true,
      },
    }
  }

  const { item } = result
  const description = mediaDescription(item)
  const url = mediaItemHref(item)

  return {
    title: `${item.title} | Media Library`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: item.title,
      description,
      url,
      type: item.viewer === "youtube" || item.viewer === "video" ? "video.other" : "article",
      publishedTime: item.publishedAt,
      images: item.thumbnailUrl ? [item.thumbnailUrl] : undefined,
    },
    twitter: {
      card: item.thumbnailUrl ? "summary_large_image" : "summary",
      title: item.title,
      description,
      images: item.thumbnailUrl ? [item.thumbnailUrl] : undefined,
    },
  }
}

export default async function MediaItemPage({ params }: PageProps) {
  const result = await fetchMediaLibraryItem(params.mediaId)
  if (!result) notFound()

  const { item, related } = result
  const sourceLabel = sourceHost(item.url)
  const isDownloadable = item.viewer === "pdf" || item.viewer === "video" || item.viewer === "image"
  const archiveHref = item.viewer === "youtube" ? `/archive/${encodeURIComponent(item.id)}` : ""

  return (
    <InvertedPageShell
      eyebrow={item.kind}
      title={item.title}
      heroTitle={item.title}
      heroDescription={item.summary}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <a
          href="/media"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/58 transition hover:text-[#df2f2f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Media
        </a>
        {archiveHref ? (
          <a
            href={archiveHref}
            className="inline-flex items-center gap-2 bg-black/28 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54"
          >
            Tales page
            <Play className="h-4 w-4 text-[#df2f2f]" />
          </a>
        ) : null}
        <a
          href="/news"
          className="inline-flex items-center gap-2 bg-black/28 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54"
        >
          News desk
          <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
        </a>
      </div>

      <section className={cn("grid gap-4 p-3 sm:p-4", archiveSurface)}>
        <div className={viewerFrameClass(item)}>
          <MediaViewer item={item} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#f4efe2]/48">
              <span className="text-[#df2f2f]">{item.source}</span>
              <span>{sourceLabel}</span>
              {item.fileType ? <span>{item.fileType}</span> : null}
              {item.collection ? <span>{item.collection}</span> : null}
              {formatDate(item.publishedAt) ? <span>{formatDate(item.publishedAt)}</span> : null}
            </div>
            <p className="max-w-3xl text-base leading-7 text-[#f4efe2]/74">{item.summary}</p>
            <div className="flex flex-wrap gap-2">
              {item.topicIds.map((topicId) => (
                <a
                  key={topicId}
                  href={`/#topic-${topicId}`}
                  className="bg-black/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/58 transition hover:text-[#fff8e6]"
                >
                  {topicTitle(topicId)}
                </a>
              ))}
            </div>
          </div>

          <aside className="grid content-start gap-2 bg-[#050504]/30 p-3">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 bg-[#df2f2f]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/22"
            >
              Open original
              <ArrowUpRight className="h-4 w-4" />
            </a>
            {isDownloadable ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/72 transition hover:text-[#fff8e6]"
              >
                <Download className="h-4 w-4" />
                Source file
              </a>
            ) : null}
            <a
              href="/documents"
              className="inline-flex h-10 items-center justify-center gap-2 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/72 transition hover:text-[#fff8e6]"
            >
              <FileText className="h-4 w-4" />
              Source shelf
            </a>
          </aside>
        </div>
      </section>

      {related.length ? (
        <section className={cn("mt-5 p-3 sm:p-4", archiveSurface)}>
          <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">Related Media</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((relatedItem) => (
              <a
                key={relatedItem.id}
                href={mediaItemHref(relatedItem)}
                className="group grid overflow-hidden bg-[#050504]/36 transition hover:bg-[#070706]/62"
              >
                <span className="relative block aspect-video overflow-hidden bg-[#050504]/70">
                  {relatedItem.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={relatedItem.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-78" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-[#df2f2f]/72">{relatedItem.kind}</span>
                  )}
                </span>
                <span className="grid gap-2 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">{relatedItem.source}</span>
                  <span className="iw-serif line-clamp-3 text-xl leading-[1.05] text-[#fff8e6] group-hover:text-[#df2f2f]">
                    {relatedItem.title}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </InvertedPageShell>
  )
}
