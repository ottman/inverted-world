import { Archive, FileText, Film, ImageIcon } from "lucide-react"
import type { MediaLibraryItem } from "@/data/inverted-world"

function mediaIcon(kind: MediaLibraryItem["kind"], className = "h-5 w-5") {
  if (kind === "video") return <Film className={className} />
  if (kind === "document") return <FileText className={className} />
  if (kind === "image") return <ImageIcon className={className} />
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
        src={item.url}
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
        <p className="iw-serif mt-5 text-4xl leading-none text-[#fff8e6]">{item.title}</p>
        <p className="mt-3 text-sm leading-6 text-[#f4efe2]/62">{item.summary}</p>
      </div>
    </div>
  )
}
