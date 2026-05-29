/* eslint-disable @next/next/no-img-element -- rights-cleared CC/PD images come from arbitrary hosts. */
import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, Radio } from "lucide-react"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { fetchRecursivTopStory } from "@/lib/story-clusters"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const story = await fetchRecursivTopStory(id).catch(() => null)
  if (!story) {
    return { title: "Story | Inverted World", robots: { index: false, follow: true } }
  }
  const title = story.headline || story.title
  const description = story.synopsis || story.summary || ""
  const url = `/news/story/${encodeURIComponent(story.uri)}`
  const images = [story.image?.url || "/images/inverted-world-logo.jpg"]
  return {
    title: `${title} | Inverted World`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "Inverted World",
      url,
      publishedTime: story.eventDate || undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  }
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = await fetchRecursivTopStory(id).catch(() => null)
  if (!story) notFound()

  const paragraphs = (story.body || story.synopsis || story.summary || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const covering = story.coveringArticles || []

  // Every story shows an image: the rights-cleared Openverse photo when present, else the branded mark.
  const hasRealImage = Boolean(story.image?.url)
  const heroImageUrl = story.image?.url || "/images/inverted-world-logo.jpg"

  // Linkify outlet names in the body prose to the covering article that outlet published, so the
  // synopsis cites its sources inline. Each outlet is linked on its first mention only.
  const outletLinks = new Map<string, { name: string; url: string }>()
  for (const article of covering) {
    const name = (article.outlet || "").trim()
    if (name.length < 4 || !article.url?.startsWith("http")) continue
    const key = name.toLowerCase()
    if (!outletLinks.has(key)) outletLinks.set(key, { name, url: article.url })
  }
  const sortedOutletNames = [...outletLinks.values()].sort((a, b) => b.name.length - a.name.length)
  const outletPattern = sortedOutletNames.map((o) => o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const outletRegex = outletPattern ? new RegExp(`(?<![\\w'])(${outletPattern})(?![\\w])`, "gi") : null
  const linkedOutlets = new Set<string>()

  function renderBodyParagraph(text: string, paragraphIndex: number): ReactNode {
    if (!outletRegex) return text
    const nodes: ReactNode[] = []
    let lastIndex = 0
    let part = 0
    outletRegex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = outletRegex.exec(text)) !== null) {
      const matched = match[0]
      const key = matched.toLowerCase()
      const outlet = outletLinks.get(key)
      if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
      if (outlet && !linkedOutlets.has(key)) {
        linkedOutlets.add(key)
        nodes.push(
          <a
            key={`${paragraphIndex}-${part++}`}
            href={outlet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#fff8e6] underline decoration-[#df2f2f]/55 underline-offset-2 transition hover:text-[#df2f2f]"
          >
            {matched}
          </a>,
        )
      } else {
        nodes.push(matched)
      }
      lastIndex = match.index + matched.length
    }
    if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
    return nodes
  }

  const canonicalUrl = `https://www.inverted.world/news/story/${story.uri}`
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: (story.headline || story.title).slice(0, 110),
    description: story.synopsis || story.summary || undefined,
    articleBody: story.body || story.synopsis || undefined,
    ...(story.image?.url ? { image: [story.image.url] } : {}),
    ...(story.eventDate ? { datePublished: story.eventDate, dateModified: story.eventDate } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    keywords: story.concepts.length ? story.concepts.join(", ") : undefined,
    publisher: {
      "@type": "Organization",
      name: "Inverted World",
      logo: { "@type": "ImageObject", url: "https://www.inverted.world/images/inverted-world-logo.jpg" },
    },
  }
  const jsonLdHtml = JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")

  return (
    <InvertedPageShell eyebrow="Story" title={story.headline || story.title} heroTitle="Story" heroDescription="" showHero={false}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml }} />
      <div className="mb-5">
        <a
          href="/news"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/58 transition hover:text-[#df2f2f]"
        >
          <ArrowLeft className="h-4 w-4" /> All news
        </a>
      </div>

      <article className={cn("grid gap-5 p-5 sm:p-7", archiveSurface)}>
        <header className="grid gap-3 border-b border-[#f4efe2]/10 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
            <Radio className="h-4 w-4" />
            <span>{story.articleCount.toLocaleString()} articles covering this story</span>
            {story.eventDate ? <span className="text-[#f4efe2]/46">· {story.eventDate}</span> : null}
          </div>
          <h1 className="iw-serif text-4xl font-bold leading-[1.02] text-[#fff8e6] sm:text-6xl">
            {story.headline || story.title}
          </h1>
          {story.concepts.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {story.concepts.slice(0, 6).map((concept) => (
                <span key={concept} className="bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/56">
                  {concept}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <figure className="grid gap-1">
          <div className="aspect-[16/9] overflow-hidden bg-black/40">
            <img
              src={heroImageUrl}
              alt={story.headline || story.title}
              className={cn("h-full w-full", hasRealImage ? "object-cover" : "object-contain p-10 opacity-80")}
            />
          </div>
          {hasRealImage ? (
            <figcaption className="text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/40">
              {story.image?.attribution ? (
                <a href={story.image.sourceUrl} target="_blank" rel="noopener noreferrer" className="transition hover:text-[#df2f2f]">
                  {story.image.attribution}
                </a>
              ) : (
                <span>Image via Openverse · {story.image?.license || "public domain"}</span>
              )}
            </figcaption>
          ) : null}
        </figure>

        <div className="iw-serif grid gap-5 text-xl leading-9 text-[#f4efe2]/88">
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => <p key={index}>{renderBodyParagraph(paragraph, index)}</p>)
          ) : (
            <p className="text-[#f4efe2]/62">A synopsis for this story is being generated.</p>
          )}
        </div>

        {covering.length ? (
          <section className="grid gap-3 border-t border-[#f4efe2]/10 pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
              Who is covering this ({covering.length}+ outlets)
            </h2>
            <ul className="grid gap-2">
              {covering.map((article) => (
                <li key={article.url}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group grid gap-1 bg-[#050504]/40 p-3 transition hover:bg-[#050504]/64 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#df2f2f]/90">{article.outlet}</span>
                    <span className="text-sm leading-6 text-[#fff8e6]/90">{article.headline}</span>
                    <ArrowUpRight className="hidden h-4 w-4 text-[#f4efe2]/40 transition group-hover:text-[#df2f2f] sm:block" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </InvertedPageShell>
  )
}
