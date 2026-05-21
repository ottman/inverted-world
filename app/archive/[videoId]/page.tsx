import type { Metadata } from "next"
import Script from "next/script"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { notFound } from "next/navigation"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { getArchiveVideo } from "@/lib/deep-archive"
import { buildVideoDossier, videoDossierJsonLd } from "@/lib/video-dossier"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { getTopicXSearchUrl } from "@/lib/x-search"
import { cn } from "@/lib/utils"
import type { ChannelVideo, ContentTopic } from "@/data/inverted-world"

type PageProps = {
  params: {
    videoId: string
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 900

function compactVideoDescription(video: ChannelVideo) {
  const clean = video.description?.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  return clean.length > 760 ? `${clean.slice(0, 757)}...` : clean
}

function buildSynopsis(video: ChannelVideo, topic: ContentTopic) {
  const description = compactVideoDescription(video)
  const format = video.kind === "short" ? "short" : "episode"
  const lead =
    description ||
    `This ${format} belongs to the ${topic.title} lane: ${topic.signal.toLowerCase()}. It is best used as a starting point for the claim, not the last word on the claim.`

  return [
    lead,
    `Research path: watch the source, then compare official records, skeptical coverage, archive material, and current reporting around ${topic.title.toLowerCase()}.`,
  ]
}

function articleToBreakingItems(
  articles: Awaited<ReturnType<typeof fetchLiveArticlesForTopic>>,
): BreakingItem[] {
  return articles.slice(0, 12).map((article) => ({
    title: article.title,
    href: article.sourceUrl,
    source: article.source,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const video = await getArchiveVideo(params.videoId)
  if (!video) {
    return {
      title: "Inverted World archive",
    }
  }

  const dossier = buildVideoDossier(video)
  const synopsis = buildSynopsis(video, dossier.topic).join(" ")
  const url = `/archive/${params.videoId}`

  return {
    title: `${video.title} | Inverted World`,
    description: synopsis,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${video.title} | Inverted World`,
      description: synopsis,
      url,
      type: "article",
      publishedTime: video.date || undefined,
      images: video.thumbnail ? [video.thumbnail] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${video.title} | Inverted World`,
      description: synopsis,
      images: video.thumbnail ? [video.thumbnail] : undefined,
    },
  }
}

export default async function ArchiveVideoPage({ params }: PageProps) {
  const video = await getArchiveVideo(params.videoId)
  if (!video) notFound()

  const dossier = buildVideoDossier(video)
  const canonicalUrl = `https://invertedworld.on.recursiv.io/archive/${params.videoId}`
  const synopsis = buildSynopsis(video, dossier.topic)
  const liveArticles = await fetchLiveArticlesForTopic(dossier.topic.id, dossier.topic.query.replaceAll('"', "")).catch(() => [])
  const breakingItems = articleToBreakingItems(liveArticles)

  return (
    <InvertedPageShell
      eyebrow="Tales From The Inverted World"
      title={video.title}
      breakingItems={breakingItems}
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
          <div className="relative aspect-video overflow-hidden bg-[#050504]/55">
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
          <h2 className="iw-serif mt-4 text-4xl leading-tight text-[#fff8e6]">Synopsis</h2>
          <p className="mt-4 text-sm leading-6 text-[#f4efe2]/68">{synopsis[0]}</p>
          <div className="mt-6 grid gap-2 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/48">
            <span>topic: {dossier.topic.title}</span>
            <span>source: Tales From the Inverted World</span>
            <span>format: video + research links</span>
          </div>
        </aside>
      </section>

      <article className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className={cn("p-5 sm:p-6", archiveSurface)}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">Video synopsis</p>
          <h2 className="iw-serif mt-4 text-4xl leading-tight text-[#fff8e6] sm:text-5xl">{video.title}</h2>
          <div className="mt-5 grid max-w-3xl gap-4">
            {synopsis.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-[#f4efe2]/72">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <aside className="grid h-fit gap-5">
          <section className={cn("p-5", archiveSurface)}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Further research</h2>
            <div className="mt-4 grid gap-3">
              {dossier.references.slice(0, 8).map((reference) => (
                <a
                  key={reference.url}
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block bg-[#070706]/24 p-3 transition hover:bg-[#070706]/46"
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

          {!!liveArticles.length && (
            <section className={cn("p-5", archiveSurface)}>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Current coverage</h2>
              <div className="mt-4 grid gap-2">
                {liveArticles.slice(0, 5).map((article) => (
                  <a
                    key={article.id}
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group block bg-[#070706]/24 p-3 transition hover:bg-[#070706]/46"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#e8b45c]">
                        {article.title}
                      </span>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#f4efe2]/38" />
                    </span>
                    <span className="mt-2 block text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">
                      {article.source}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className={cn("p-5", archiveSurface)}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">X signal</h2>
              <a
                href={getTopicXSearchUrl(dossier.topic)}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#dff7ff] transition hover:text-[#e8b45c]"
              >
                Top search
              </a>
            </div>
            <a
              className="twitter-timeline"
              data-theme="dark"
              data-dnt="true"
              data-height="320"
              data-chrome="noheader nofooter noborders transparent"
              href={getTopicXSearchUrl(dossier.topic)}
            >
              X signal for {dossier.topic.title}
            </a>
          </section>
        </aside>
      </article>
      <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" />
    </InvertedPageShell>
  )
}
