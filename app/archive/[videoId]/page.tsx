import type { Metadata } from "next"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { notFound } from "next/navigation"
import { archiveSurface, ExternalAction, InvertedPageShell } from "@/components/inverted-page-shell"
import { getArchiveVideo } from "@/lib/deep-archive"
import { buildVideoDossier, videoDossierJsonLd } from "@/lib/video-dossier"
import { cn } from "@/lib/utils"

type PageProps = {
  params: {
    videoId: string
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 900

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const video = await getArchiveVideo(params.videoId)
  if (!video) {
    return {
      title: "Inverted World archive dossier",
    }
  }

  const dossier = buildVideoDossier(video)
  const url = `/archive/${params.videoId}`

  return {
    title: dossier.title,
    description: dossier.dek,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: dossier.title,
      description: dossier.dek,
      url,
      type: "article",
      publishedTime: video.date || undefined,
      images: video.thumbnail ? [video.thumbnail] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: dossier.title,
      description: dossier.dek,
      images: video.thumbnail ? [video.thumbnail] : undefined,
    },
  }
}

export default async function ArchiveVideoPage({ params }: PageProps) {
  const video = await getArchiveVideo(params.videoId)
  if (!video) notFound()

  const dossier = buildVideoDossier(video)
  const canonicalUrl = `https://invertedworld.on.recursiv.io/archive/${params.videoId}`

  return (
    <InvertedPageShell
      eyebrow={dossier.topic.title}
      title={video.title}
      action={<ExternalAction href={video.href}>YouTube</ExternalAction>}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoDossierJsonLd(dossier, canonicalUrl)) }}
      />

      <div className="mb-6">
        <a
          href="/archive"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/58 transition hover:text-[#e8b45c]"
        >
          <ArrowLeft className="h-4 w-4" />
          Archive
        </a>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.14fr_0.86fr]">
        <div className={cn("p-3", archiveSurface)}>
          <div className="relative aspect-video overflow-hidden border border-[#f4efe2]/10 bg-[#050504]/55">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={video.embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <aside className={cn("p-5", archiveSurface)}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">{video.date || "archive"}</p>
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-[#fff8e6]">AI dossier</h2>
          <p className="mt-4 text-sm leading-6 text-[#f4efe2]/68">{dossier.dek}</p>
          <div className="mt-6 grid gap-2 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/48">
            <span>topic: {dossier.topic.title}</span>
            <span>source: Tales From the Inverted World</span>
            <span>format: video + article + references</span>
          </div>
        </aside>
      </section>

      <article className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={cn("p-5 sm:p-7", archiveSurface)}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">Indexable research article</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#fff8e6] sm:text-4xl">{dossier.title}</h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#f4efe2]/72">{dossier.dek}</p>

          <div className="mt-8 grid gap-7">
            {dossier.article.map((section) => (
              <section key={section.heading}>
                <h3 className="text-xl font-semibold text-[#fff8e6]">{section.heading}</h3>
                <p className="mt-3 text-sm leading-7 text-[#f4efe2]/72">{section.body}</p>
              </section>
            ))}
          </div>
        </div>

        <aside className="grid h-fit gap-5">
          <section className={cn("p-5", archiveSurface)}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">References</h2>
            <div className="mt-4 grid gap-3">
              {dossier.references.map((reference) => (
                <a
                  key={reference.url}
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block border border-[#f4efe2]/10 bg-[#070706]/24 p-3 transition hover:border-[#e8b45c]/45"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#e8b45c]">{reference.title}</span>
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#f4efe2]/38" />
                  </span>
                  <span className="mt-2 block text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">
                    {reference.source} / {reference.kind}
                  </span>
                </a>
              ))}
            </div>
          </section>

          <section className={cn("p-5", archiveSurface)}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Research prompts</h2>
            <ul className="mt-4 grid gap-2">
              {dossier.searchQueries.map((query) => (
                <li key={query} className="border border-[#f4efe2]/10 bg-[#070706]/24 p-3 text-xs leading-5 text-[#f4efe2]/64">
                  {query}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </article>
    </InvertedPageShell>
  )
}
