import type React from "react"
import type { Metadata } from "next"
import { ArrowLeft, ArrowUpRight, Gauge, MessageSquare, Radio } from "lucide-react"
import { notFound } from "next/navigation"
import { DossierChat } from "@/components/dossier-chat"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { getRecursivClaimDossier } from "@/lib/recursiv/content"
import { cn } from "@/lib/utils"

type PageProps = {
  params: {
    articleId: string
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 300

function formatScore(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(Math.round(value))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const dossier = await getRecursivClaimDossier(params.articleId)
  if (!dossier) return { title: "Inverted World dossier" }

  return {
    title: dossier.title,
    description: dossier.deck || dossier.summary,
    alternates: {
      canonical: `/news/${dossier.slug}`,
    },
    openGraph: {
      title: dossier.title,
      description: dossier.deck || dossier.summary,
      type: "article",
      publishedTime: dossier.publishedAt || undefined,
      url: `/news/${dossier.slug}`,
      images: dossier.relatedVideos[0]?.thumbnail ? [dossier.relatedVideos[0].thumbnail] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: dossier.title,
      description: dossier.deck || dossier.summary,
      images: dossier.relatedVideos[0]?.thumbnail ? [dossier.relatedVideos[0].thumbnail] : undefined,
    },
  }
}

export default async function NewsArticlePage({ params }: PageProps) {
  const dossier = await getRecursivClaimDossier(params.articleId)
  if (!dossier) notFound()

  const breakingItems: BreakingItem[] = [
    ...dossier.xSignals.slice(0, 8).map((post) => ({
      title: post.text,
      href: post.url,
      source: post.username ? `@${post.username}` : "X",
    })),
    ...dossier.sourceLinks.slice(0, 8).map((source) => ({
      title: source.title,
      href: source.url,
      source: source.outlet || source.biasLane,
    })),
  ]

  return (
    <InvertedPageShell
      eyebrow={dossier.topic}
      title={dossier.title}
      breakingItems={breakingItems}
      heroTitle={dossier.title}
      heroDescription={dossier.deck}
    >
      <div className="mb-6">
        <a
          href="/news"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/58 transition hover:text-[#df2f2f]"
        >
          <ArrowLeft className="h-4 w-4" />
          News
        </a>
      </div>

      <section className={cn("grid gap-5 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]", archiveSurface)}>
        <div className="grid gap-5">
          <div className="bg-[#050504]/42 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Claim</p>
            <p className="iw-serif mt-3 text-4xl leading-none text-[#fff8e6]">{dossier.claim}</p>
            <p className="mt-5 text-base leading-7 text-[#f4efe2]/72">{dossier.summary}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ReadBlock title="Weird Read" body={dossier.weirdRead} />
            <ReadBlock title="Skeptical Read" body={dossier.skepticalRead} />
          </div>

          <section className="bg-[#050504]/42 p-4">
            <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">Source Split</h2>
            <div className="mt-4 grid gap-2">
              {dossier.sourceLinks.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid gap-2 bg-black/28 p-3 transition hover:bg-black/54 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <span>
                    <span className="block text-sm leading-5 text-[#fff8e6]">{source.title}</span>
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/42">
                      {source.outlet || "source"} / {source.biasLane || "open-web"} / {source.sourceKind || "news"}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Metric icon={<Gauge className="h-4 w-4" />} label="Evidence" value={`${dossier.confidenceScore}/100`} />
            <Metric icon={<Radio className="h-4 w-4" />} label="X Velocity" value={formatScore(dossier.xVelocityScore)} />
            <Metric icon={<MessageSquare className="h-4 w-4" />} label="Sources" value={String(dossier.sourceCount)} />
            <Metric icon={<MessageSquare className="h-4 w-4" />} label="X Posts" value={String(dossier.xSignalCount)} />
          </div>

          <section className="bg-[#050504]/42 p-4">
            <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">Viral Headlines</h2>
            <div className="mt-4 grid gap-2">
              {dossier.viralHeadlines.map((headline) => (
                <p key={headline} className="bg-black/28 p-3 text-sm leading-5 text-[#f4efe2]/72">
                  {headline}
                </p>
              ))}
            </div>
          </section>

          <section className="bg-[#050504]/42 p-4">
            <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">Tales Context</h2>
            <div className="mt-4 grid gap-3">
              {dossier.relatedVideos.map((video) => (
                <a
                  key={video.href}
                  href={video.videoId ? `/archive/${video.videoId}` : video.href}
                  className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 bg-black/28 p-2 transition hover:bg-black/54"
                >
                  <span className="relative block aspect-video overflow-hidden bg-black/60">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    ) : null}
                  </span>
                  <span className="line-clamp-3 text-sm leading-5 text-[#fff8e6]">{video.title}</span>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <div className="mt-6">
        <DossierChat slug={dossier.slug} />
      </div>
    </InvertedPageShell>
  )
}

function ReadBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-[#050504]/42 p-4">
      <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#f4efe2]/68">{body}</p>
    </section>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid gap-3 bg-black/30 p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/44">
        {icon}
        {label}
      </div>
      <span className="iw-serif text-3xl leading-none text-[#fff8e6]">{value}</span>
    </div>
  )
}
