import type { Metadata } from "next"
import { InvertedPageShell } from "@/components/inverted-page-shell"
import { MediaLibraryPage } from "@/components/media-library-page"
import { type MediaLibraryItem, fetchMediaLibrary } from "@/lib/media-library"
import { getDeepArchive } from "@/lib/deep-archive"

export const dynamic = "force-dynamic"
export const revalidate = 300

export const metadata: Metadata = {
  title: "Media Library | Inverted World",
  description:
    "A watch-and-read media library for Inverted World: UAP releases, primary-source PDFs, official videos, images, and Tales archive clips.",
  alternates: {
    canonical: "/media",
  },
}

function archiveVideoToMedia(video: Awaited<ReturnType<typeof getDeepArchive>>["videos"][number]): MediaLibraryItem {
  return {
    id: video.videoId || video.href,
    title: video.title,
    source: "Tales From the Inverted World",
    url: video.href,
    kind: "video",
    viewer: "youtube",
    topicIds: [video.topicId],
    summary: video.description || "Tales archive video connected to the current research desk.",
    publishedAt: video.date,
    embedUrl: video.embedUrl,
    thumbnailUrl: video.thumbnail,
    fileType: video.kind === "short" ? "YouTube Short" : "YouTube",
    collection: "Tales archive",
  }
}

function dedupe(items: MediaLibraryItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.url || item.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default async function MediaPage() {
  const [library, archive] = await Promise.all([
    fetchMediaLibrary(),
    getDeepArchive({ limit: 96, maxLimit: 1000 }).catch(() => null),
  ])
  const archiveItems = archive?.videos.map(archiveVideoToMedia) || []
  const items = dedupe([...library.items, ...archiveItems])

  return (
    <InvertedPageShell
      eyebrow="Media library"
      title="Media Library"
      heroTitle="Media Library"
      heroDescription="Watch the clips, read the source files, and keep the primary media close to every developing story."
    >
      <MediaLibraryPage items={items} sourceMode={library.sourceMode} />
    </InvertedPageShell>
  )
}
