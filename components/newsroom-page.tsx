"use client"

import { useEffect, useState } from "react"
import { ExternalLink, RefreshCw, Zap } from "lucide-react"
import { intelligenceArticles, type IntelligenceArticle } from "@/data/intelligence-articles"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { cn } from "@/lib/utils"

type ArticlesResponse = {
  articles?: IntelligenceArticle[]
  warnings?: string[]
}

export function NewsroomPage() {
  const [articles, setArticles] = useState<IntelligenceArticle[]>(intelligenceArticles)
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<IntelligenceArticle | null>(null)

  async function loadArticles() {
    setLoading(true)
    try {
      const response = await fetch("/api/articles")
      const data = (await response.json()) as ArticlesResponse
      setArticles(data.articles?.length ? data.articles : intelligenceArticles)
      setWarnings(data.warnings ?? [])
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : "News load failed"])
      setArticles(intelligenceArticles)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadArticles()
  }, [])

  return (
    <InvertedPageShell
      eyebrow={`${articles.length} sourced briefs`}
      title="Newsroom"
      action={
        <button
          onClick={() => void loadArticles()}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-[#7dd3fc]/35 bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:bg-[#7dd3fc]/12"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      }
    >
      <div className={cn("mb-5 grid gap-3 p-4 sm:grid-cols-3", archiveSurface)}>
        <Metric label="daily issue" value="autopost-ready" />
        <Metric label="sources" value="news + docs" />
        <Metric label="format" value="viral brief" />
      </div>
      {warnings.length > 0 && <p className="mb-4 text-xs text-[#e8b45c]/72">{warnings.slice(0, 2).join(" | ")}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {articles.map((article) => (
          <article key={article.id} className={cn("overflow-hidden transition hover:border-[#e8b45c]/55", archiveSurface)}>
            <button onClick={() => setSelected(article)} className="block w-full text-left">
              <div className="relative h-36 border-b border-[#f4efe2]/10 bg-[#120d07] p-4">
                <Zap className="h-5 w-5 text-[#e8b45c]" />
                <div className="absolute bottom-4 left-4 text-4xl font-extrabold uppercase tracking-normal text-[#fff8e6]">
                  {article.thumbnail.glyph}
                </div>
                <div className="absolute right-4 top-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">
                  {article.heat}
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/42">{article.topic}</p>
                <h2 className="mt-3 line-clamp-3 text-base font-semibold leading-6 text-[#fff8e6]">{article.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#f4efe2]/58">{article.deck}</p>
              </div>
            </button>
          </article>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050504]/55 p-3 backdrop-blur-[3px]">
          <button className="absolute inset-0 cursor-default" aria-label="Close article" onClick={() => setSelected(null)} />
          <article className={cn("relative max-h-[92vh] w-full max-w-4xl overflow-y-auto p-5 sm:p-6", archiveSurface)}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">{selected.topic}</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#fff8e6] sm:text-4xl">{selected.title}</h2>
            <p className="mt-4 text-base leading-7 text-[#f4efe2]/70">{selected.deck}</p>
            <div className="mt-6 grid gap-3">
              {selected.body.map((paragraph) => (
                <p key={paragraph} className="border border-[#f4efe2]/12 bg-[#070706]/24 p-4 text-sm leading-6 text-[#f4efe2]/78">
                  {paragraph}
                </p>
              ))}
            </div>
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-md border border-[#e8b45c]/45 bg-[#e8b45c]/12 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#e8b45c]/22"
            >
              {selected.source}
              <ExternalLink className="h-4 w-4" />
            </a>
          </article>
        </div>
      )}
    </InvertedPageShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#f4efe2]/10 bg-[#050504]/30 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/44">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#fff8e6]">{value}</p>
    </div>
  )
}
