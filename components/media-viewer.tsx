import { Archive, ArrowUpRight, FileText, Film, ImageIcon, Volume2 } from "lucide-react"
import type { MediaLibraryItem } from "@/data/inverted-world"

function mediaIcon(kind: MediaLibraryItem["kind"], className = "h-5 w-5") {
  if (kind === "video") return <Film className={className} />
  if (kind === "document") return <FileText className={className} />
  if (kind === "image") return <ImageIcon className={className} />
  if (kind === "audio") return <Volume2 className={className} />
  return <Archive className={className} />
}

function youtubeEmbedUrl(item: MediaLibraryItem) {
  const source = item.embedUrl || item.url
  try {
    const url = new URL(source)
    const id =
      url.hostname.includes("youtu.be")
        ? url.pathname.replace("/", "")
        : url.searchParams.get("v") ||
          url.pathname.match(/\/embed\/([^/?]+)/)?.[1] ||
          url.pathname.match(/\/shorts\/([^/?]+)/)?.[1]
    const embed = new URL(id ? `https://www.youtube.com/embed/${id}` : source)
    embed.searchParams.set("rel", "0")
    embed.searchParams.set("playsinline", "1")
    return embed.toString()
  } catch {
    return source
  }
}

function pdfViewerUrl(item: MediaLibraryItem) {
  try {
    const url = new URL(item.url)
    if (!url.hash) url.hash = "toolbar=0&navpanes=0&view=FitH"
    return url.toString()
  } catch {
    const separator = item.url.includes("#") ? "&" : "#"
    return `${item.url}${separator}toolbar=0&navpanes=0&view=FitH`
  }
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

export function MediaViewer({
  item,
  className = "absolute inset-0 h-full w-full",
}: {
  item: MediaLibraryItem
  className?: string
}) {
  if (item.viewer === "youtube") {
    return (
      <iframe
        key={item.id}
        className={className}
        src={youtubeEmbedUrl(item)}
        title={item.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    )
  }

  if (item.viewer === "pdf") {
    return (
      <iframe
        key={item.id}
        className={`${className} bg-[#111]`}
        src={pdfViewerUrl(item)}
        title={item.title}
        referrerPolicy="strict-origin-when-cross-origin"
      />
    )
  }

  if (item.viewer === "video") {
    return (
      <video
        key={item.id}
        className={`${className} bg-black object-contain`}
        src={item.url}
        poster={item.thumbnailUrl}
        controls
        playsInline
      />
    )
  }

  if (item.viewer === "audio") {
    return (
      <div
        key={item.id}
        className={`${className} grid place-items-center bg-[radial-gradient(circle_at_center,rgba(223,47,47,0.18),rgba(5,5,4,0.96))] p-6`}
      >
        <div className="grid w-full max-w-2xl gap-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center bg-[#df2f2f]/14 text-[#fff8e6]">
            <Volume2 className="h-7 w-7" />
          </div>
          <div>
            <p className="iw-serif text-4xl leading-none text-[#fff8e6]">{item.title}</p>
            <p className="mt-3 text-sm leading-6 text-[#f4efe2]/62">{item.summary}</p>
          </div>
          <audio className="w-full" src={item.url} controls preload="metadata" />
        </div>
      </div>
    )
  }

  if (item.viewer === "image" || item.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={item.id} src={item.thumbnailUrl || item.url} alt="" className={`${className} bg-black object-contain`} />
    )
  }

  return (
    <div
      className={`${className} grid place-items-center bg-[radial-gradient(circle_at_center,rgba(223,47,47,0.18),rgba(5,5,4,0.95))] p-8 text-center`}
    >
      <div className="max-w-lg">
        <div className="mx-auto grid h-14 w-14 place-items-center bg-[#df2f2f]/14 text-[#fff8e6]">{mediaIcon(item.kind)}</div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">{sourceHost(item.url)}</p>
        <p className="iw-serif mt-3 text-4xl leading-none text-[#fff8e6]">{item.title}</p>
        <p className="mt-3 text-sm leading-6 text-[#f4efe2]/62">{item.summary}</p>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex h-10 items-center gap-2 bg-[#df2f2f]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/22"
        >
          Open record
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}
