/* eslint-disable @next/next/no-img-element -- rights-cleared CC/PD images come from arbitrary hosts. */
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, FileText, MessageSquare, Radio } from "lucide-react"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { fetchRecursivTopStory, type CoveringArticle } from "@/lib/story-clusters"
import { fetchStoryTweets } from "@/lib/x-posts"
import { cn } from "@/lib/utils"

// A covering item is a PRIMARY source when it's official/government/agency/court material — the only
// thing the article body should link out to (vs. secondary news coverage).
const PRIMARY_HOST_PATTERN = /(^|\.)gov(\.|$)|(^|\.)mil(\.|$)|\.gov\.|gov\.uk$|europa\.eu$|(^|\.)un\.org$|who\.int$|courtlistener\.com$|supremecourt\.gov$/i
const PRIMARY_OUTLET_PATTERN =
  /\b(white house|the pentagon|u\.?s\.? congress|u\.?s\.? senate|supreme court|department of justice|justice department|state department|nasa|noaa|cdc|fda|fbi|sec|cia|nsa|aaro|world health organization|united nations|european commission|federal reserve|press release|official statement|court filing)\b/i

function hostOf(url?: string): string {
  if (!url || !url.startsWith("http")) return ""
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

function isPrimarySource(article: CoveringArticle): boolean {
  const host = hostOf(article.url)
  if (!host) return false
  if (PRIMARY_HOST_PATTERN.test(host)) return true
  return PRIMARY_OUTLET_PATTERN.test((article.outlet || "").toLowerCase())
}

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

  // Tweets about this story: search X on the story's key entities. Empty when no X token is
  // configured — the page still links to a live X search of the same terms.
  const tweetQuery = (story.concepts.slice(0, 3).join(" ") || story.headline || story.title).trim()
  const tweets = await fetchStoryTweets(tweetQuery, 6).catch(() => [])
  const xSearchUrl = `https://x.com/search?q=${encodeURIComponent(tweetQuery)}&f=live`

  // Every story shows an image: the rights-cleared Openverse photo when present, else the branded mark.
  const hasRealImage = Boolean(story.image?.url)
  const heroImageUrl = story.image?.url || "/images/inverted-world-logo.jpg"

  // The article reads as original journalism — no inline links to news outlets. The only links out
  // of the piece are to PRIMARY sources (official/government/agency/court material) from the coverage.
  const seenPrimary = new Set<string>()
  const primarySources = covering.filter((article) => {
    if (!isPrimarySource(article)) return false
    const host = hostOf(article.url)
    if (!host || seenPrimary.has(host)) return false
    seenPrimary.add(host)
    return true
  })

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
            {story.category ? (
              <span className="bg-[#df2f2f] px-2 py-0.5 text-[#fff8e6]">{story.category}</span>
            ) : null}
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
              // object-top biases the 16:9 crop toward the top of the frame so faces/heads aren't
              // sliced off the way a centered crop does.
              className={cn("h-full w-full", hasRealImage ? "object-cover object-top" : "object-contain p-10 opacity-80")}
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
            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          ) : (
            <p className="text-[#f4efe2]/62">A synopsis for this story is being generated.</p>
          )}
        </div>

        {primarySources.length ? (
          <section className="grid gap-2 border-t border-[#f4efe2]/10 pt-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
              <FileText className="h-4 w-4" /> Primary sources
            </h2>
            <ul className="flex flex-wrap gap-2">
              {primarySources.map((article) => (
                <li key={article.url}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-[#050504]/40 px-3 py-1.5 text-sm text-[#fff8e6]/90 transition hover:bg-[#050504]/64 hover:text-[#df2f2f]"
                  >
                    {article.outlet} <ArrowUpRight className="h-3.5 w-3.5 text-[#f4efe2]/40" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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

        <section className="grid gap-3 border-t border-[#f4efe2]/10 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
              <MessageSquare className="h-4 w-4" /> On X
            </h2>
            <a
              href={xSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/58 transition hover:text-[#df2f2f]"
            >
              Follow the conversation <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          {tweets.length ? (
            <ul className="grid gap-2">
              {tweets.map((tweet) => (
                <li key={tweet.id}>
                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group grid gap-1 bg-[#050504]/40 p-3 transition hover:bg-[#050504]/64"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-[#df2f2f]/90">
                      {tweet.authorName || (tweet.username ? `@${tweet.username}` : "On X")}
                      {tweet.username ? <span className="text-[#f4efe2]/40">@{tweet.username}</span> : null}
                    </span>
                    <span className="text-sm leading-6 text-[#fff8e6]/90">{tweet.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-[#f4efe2]/56">
              See what people are saying about this story{" "}
              <a href={xSearchUrl} target="_blank" rel="noopener noreferrer" className="text-[#df2f2f] underline underline-offset-2">
                on X
              </a>
              .
            </p>
          )}
        </section>
      </article>
    </InvertedPageShell>
  )
}
