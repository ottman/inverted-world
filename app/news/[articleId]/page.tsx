import { cache, type ReactNode } from "react"
import type { Metadata } from "next"
import { ArrowLeft, ArrowUpRight, BookOpen, FileText, Gauge, MessageSquare, Radio } from "lucide-react"
import { DossierChat } from "@/components/dossier-chat"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import { getArticleById } from "@/lib/live-articles"
import { getRecursivClaimDossier, type ClaimDossier, type ClaimSourceLink } from "@/lib/recursiv/content"
import { xPostInternalHref } from "@/lib/x-links"
import { cn } from "@/lib/utils"

type PageProps = {
  params: {
    articleId: string
  }
}

const articlePrimarySources: Record<string, ClaimSourceLink> = {
  "secret-programs-the-top-secret-testimony-of-cia-s-mkultra-chief-50-years-later-national-security": {
    title: "The Top Secret Testimony of CIA's MKULTRA Chief, 50 Years Later",
    url: "https://nsarchive.gwu.edu/briefing-book/intelligence/2025-09-04/top-secret-testimony-cias-mkultra-chief-50-years-later",
    outlet: "National Security Archive",
    sourceKind: "archive",
  },
}

export const dynamic = "force-dynamic"
export const revalidate = 300

const getStoryData = cache(async (articleId: string) => {
  const [article, dossier] = await Promise.all([
    getArticleById(articleId),
    getRecursivClaimDossier(articleId),
  ])

  return { article, dossier }
})

function formatScore(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(Math.round(value))
}

function titleFromSlug(slug: string) {
  try {
    return decodeURIComponent(slug)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  } catch {
    return slug.replace(/[-_]+/g, " ").trim()
  }
}

function isExternalUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value))
}

function formatDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function primarySource(article?: IntelligenceArticle | null, dossier?: ClaimDossier | null): ClaimSourceLink | undefined {
  const dossierSource = dossier?.sourceLinks.find((source) => isExternalUrl(source.url))
  if (dossierSource) return dossierSource
  if (article?.id && articlePrimarySources[article.id]) return articlePrimarySources[article.id]
  if (article && isExternalUrl(article.sourceUrl)) {
    return {
      title: article.title,
      url: article.sourceUrl,
      outlet: article.source,
      sourceKind: "news",
    }
  }
  return undefined
}

function storyParagraphs(article?: IntelligenceArticle | null, dossier?: ClaimDossier | null) {
  const articleBody = article?.body.map((paragraph) => paragraph.trim()).filter(Boolean) || []
  if (articleBody.length) return articleBody

  if (!dossier) return []

  const source = primarySource(article, dossier)
  return [
    dossier.summary,
    source
      ? `The strongest starting point is ${source.outlet || "the linked source"}: ${source.title}. Read that record first, then compare the surrounding coverage and social reaction.`
      : `Start with the source links below, then compare the X signals, related Tales videos, and skeptical read before sharing the story.`,
    dossier.skepticalRead,
  ].filter(Boolean)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { article, dossier } = await getStoryData(params.articleId)
  const title = article?.title || dossier?.title
  const description = article?.deck || dossier?.deck || dossier?.summary

  if (!title) {
    return {
      title: "Inverted World story",
      robots: {
        index: false,
        follow: true,
      },
    }
  }

  return {
    title,
    description,
    alternates: {
      canonical: `/news/${dossier?.slug || params.articleId}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article?.publishedAt || dossier?.publishedAt || undefined,
      url: `/news/${dossier?.slug || params.articleId}`,
      images:
        article?.thumbnail.imageUrl
          ? [article.thumbnail.imageUrl]
          : dossier?.relatedVideos[0]?.thumbnail
            ? [dossier.relatedVideos[0].thumbnail]
            : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images:
        article?.thumbnail.imageUrl
          ? [article.thumbnail.imageUrl]
          : dossier?.relatedVideos[0]?.thumbnail
            ? [dossier.relatedVideos[0].thumbnail]
            : undefined,
    },
  }
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { article, dossier } = await getStoryData(params.articleId)

  if (!article && !dossier) {
    return (
      <InvertedPageShell
        eyebrow="Research desk"
        title="Story Recovery"
        breakingItems={[]}
        heroTitle={titleFromSlug(params.articleId) || "Story Recovery"}
        heroDescription="This story is being refreshed. Continue through the current desk, archive, or source shelf."
      >
        <section className={cn("grid gap-4 p-5 text-sm leading-6 text-[#f4efe2]/68", archiveSurface)}>
          <p>Use the live desk and Tales archive to continue the trail while this story refreshes.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/news" className="inline-flex items-center gap-2 bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54">
              News desk
              <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
            </a>
            <a href="/archive" className="inline-flex items-center gap-2 bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54">
              Tales archive
              <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
            </a>
            <a href="/documents" className="inline-flex items-center gap-2 bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54">
              Source shelf
              <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
            </a>
          </div>
        </section>
      </InvertedPageShell>
    )
  }

  const headline = article?.title || dossier?.title || "Inverted World story"
  const deck = article?.deck || dossier?.deck || dossier?.summary || ""
  const source = primarySource(article, dossier)
  const body = storyParagraphs(article, dossier)
  const topic = article?.topic || dossier?.topic || "INVERTED WORLD"
  const publishedAt = formatDate(article?.publishedAt || dossier?.publishedAt)
  const articleFirst = Boolean(article)

  const breakingItems: BreakingItem[] = dossier ? [
    ...dossier.xSignals.slice(0, 8).map((post) => ({
      title: post.text,
      href: xPostInternalHref(post, dossier.topicId),
      source: post.username ? `@${post.username}` : "X",
    })),
    ...dossier.sourceLinks.slice(0, 8).map((source) => ({
      title: source.title,
      href: source.url,
      source: source.outlet || source.biasLane,
    })),
  ] : []

  return (
    <InvertedPageShell
      eyebrow={topic}
      title={headline}
      breakingItems={breakingItems}
      heroTitle={headline}
      heroDescription={deck}
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
          <article className="bg-[#050504]/42 p-5">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
              {article?.source ? <span>{article.source}</span> : null}
              {publishedAt ? <span>{publishedAt}</span> : null}
              {!articleFirst && dossier?.evidenceGrade ? <span>{dossier.evidenceGrade}</span> : null}
            </div>
            <div className="grid gap-5 text-lg leading-8 text-[#f4efe2]/78">
              {body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {source ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 bg-[#df2f2f]/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/20"
              >
                Read primary source
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : null}
          </article>

          {dossier ? (
            <div className="grid gap-3 md:grid-cols-2">
              <ReadBlock title={articleFirst ? "What To Verify" : "Open Questions"} body={dossier.weirdRead} />
              <ReadBlock title="Skeptical Check" body={dossier.skepticalRead} />
            </div>
          ) : null}

          {dossier ? (
            <section className="bg-[#050504]/42 p-4">
              <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">Sources</h2>
            <div className="mt-4 grid gap-2">
              {dossier.sourceLinks.length ? dossier.sourceLinks.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid gap-2 bg-black/28 p-3 transition hover:bg-black/54 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <span>
                    <span className="block text-sm leading-5 text-[#fff8e6]">{source.title}</span>
                    {source.excerpt ? (
                      <span className="mt-2 block line-clamp-2 text-xs leading-5 text-[#f4efe2]/56">{source.excerpt}</span>
                    ) : null}
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/42">
                      {source.outlet || "source"} / {source.biasLane || "open web"} / {source.sourceKind || "news"}
                      {source.extractionProvider ? ` / ${source.extractionProvider}` : ""}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
                </a>
              )) : (
                <a href="/documents" className="bg-black/28 p-3 text-sm leading-6 text-[#f4efe2]/62 transition hover:text-[#fff8e6]">
                  Open the source document shelf.
                </a>
              )}
            </div>
            </section>
          ) : null}
        </div>

        <aside className="grid gap-4">
          {article?.thumbnail.imageUrl ? (
            <div className="overflow-hidden bg-[#050504]/42 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.thumbnail.imageUrl} alt="" className="aspect-square w-full object-contain opacity-95" />
            </div>
          ) : null}

          {dossier ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {articleFirst ? (
                  <>
                    <Metric icon={<FileText className="h-4 w-4" />} label="Sources" value={String(dossier.sourceCount)} />
                    <Metric icon={<Radio className="h-4 w-4" />} label="X Posts" value={String(dossier.xSignalCount)} />
                    <Metric icon={<BookOpen className="h-4 w-4" />} label="Archive" value={String(dossier.relatedVideoCount)} />
                    <Metric icon={<MessageSquare className="h-4 w-4" />} label="AI Guide" value="Ready" />
                  </>
                ) : (
                  <>
                    <Metric icon={<Gauge className="h-4 w-4" />} label="Evidence" value={`${dossier.confidenceScore}/100`} />
                    <Metric icon={<Radio className="h-4 w-4" />} label="X Velocity" value={formatScore(dossier.xVelocityScore)} />
                    <Metric icon={<MessageSquare className="h-4 w-4" />} label="Sources" value={String(dossier.sourceCount)} />
                    <Metric icon={<MessageSquare className="h-4 w-4" />} label="X Posts" value={String(dossier.xSignalCount)} />
                  </>
                )}
              </div>

              <section className="bg-[#050504]/42 p-4">
                <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">What To Watch</h2>
                <div className="mt-4 grid gap-2">
                  {dossier.viralHeadlines.length ? dossier.viralHeadlines.slice(0, 4).map((headline) => (
                    <p key={headline} className="bg-black/28 p-3 text-sm leading-5 text-[#f4efe2]/72">
                      {headline}
                    </p>
                  )) : (
                    <a href="/news" className="bg-black/28 p-3 text-sm leading-6 text-[#f4efe2]/62 transition hover:text-[#fff8e6]">
                      Open the latest stories.
                    </a>
                  )}
                </div>
              </section>

              <section className="bg-[#050504]/42 p-4">
                <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">Tales Context</h2>
                <div className="mt-4 grid gap-3">
                  {dossier.relatedVideos.length ? dossier.relatedVideos.map((video) => (
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
                  )) : (
                    <a href="/archive" className="bg-black/28 p-3 text-sm leading-6 text-[#f4efe2]/62 transition hover:text-[#fff8e6]">
                      Open the full Tales archive.
                    </a>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="bg-[#050504]/42 p-4">
              <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">Keep Reading</h2>
              <div className="mt-4 grid gap-2">
                <a href="/news" className="bg-black/28 p-3 text-sm leading-6 text-[#f4efe2]/62 transition hover:text-[#fff8e6]">
                  Latest stories
                </a>
                <a href="/archive" className="bg-black/28 p-3 text-sm leading-6 text-[#f4efe2]/62 transition hover:text-[#fff8e6]">
                  Tales archive
                </a>
              </div>
            </section>
          )}
        </aside>
      </section>

      {dossier ? (
        <div className="mt-6">
          <DossierChat slug={dossier.slug} />
        </div>
      ) : null}
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

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
