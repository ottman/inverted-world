import type { Metadata } from "next"
import { InvertedPageShell } from "@/components/inverted-page-shell"
import { MediaLibraryPage } from "@/components/media-library-page"
import { fetchExpandedMediaLibrary } from "@/lib/media-library"

export const dynamic = "force-dynamic"
export const revalidate = 300

export const metadata: Metadata = {
  title: "Media Library | Inverted World",
  description:
    "A watch-and-read media library for Inverted World: UAP releases, primary-source PDFs, official videos, audio, images, and Tales archive clips.",
  alternates: {
    canonical: "/media",
  },
}

export default async function MediaPage() {
  const { items } = await fetchExpandedMediaLibrary({ archiveLimit: 96 })

  return (
    <InvertedPageShell
      eyebrow="Media library"
      title="Media Library"
      heroTitle="Media Library"
      heroDescription="Watch the clips, read the source files, review audio, and keep the primary media close to every developing story."
    >
      <MediaLibraryPage items={items} />
    </InvertedPageShell>
  )
}
