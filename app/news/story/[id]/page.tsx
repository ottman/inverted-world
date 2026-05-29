import type { Metadata } from "next"
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
  const title = story?.headline || story?.title || "Story"
  return {
    title: `${title} | Inverted World`,
    description: story?.synopsis || story?.summary || "",
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

  return (
    <InvertedPageShell eyebrow="Story" title={story.headline || story.title} heroTitle="Story" heroDescription="" showHero={false}>
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

        <div className="grid gap-4 text-lg leading-8 text-[#f4efe2]/86">
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
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
