import type { Metadata } from "next"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { notFound } from "next/navigation"
import { intelligenceArticles } from "@/data/intelligence-articles"
import { archiveSurface, ExternalAction, InvertedPageShell } from "@/components/inverted-page-shell"
import { cn } from "@/lib/utils"

type PageProps = {
  params: {
    articleId: string
  }
}

const baseUrl = "https://invertedworld.on.recursiv.io"

function getArticle(articleId: string) {
  return intelligenceArticles.find((article) => article.id === articleId)
}

export function generateStaticParams() {
  return intelligenceArticles.map((article) => ({ articleId: article.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = getArticle(params.articleId)
  if (!article) return { title: "Inverted World article" }

  return {
    title: `${article.title} | Inverted World`,
    description: article.deck,
    alternates: {
      canonical: `/news/${article.id}`,
    },
    openGraph: {
      title: article.title,
      description: article.deck,
      url: `/news/${article.id}`,
      type: "article",
      publishedTime: article.publishedAt,
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.deck,
    },
  }
}

export default function NewsArticlePage({ params }: PageProps) {
  const article = getArticle(params.articleId)
  if (!article) notFound()

  const canonicalUrl = `${baseUrl}/news/${article.id}`
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.deck,
    datePublished: article.publishedAt,
    dateModified: new Date().toISOString(),
    mainEntityOfPage: canonicalUrl,
    citation: [article.sourceUrl],
    about: [article.topic],
    publisher: {
      "@type": "Organization",
      name: "Inverted World",
      url: baseUrl,
    },
  }

  return (
    <InvertedPageShell eyebrow={article.topic} title={article.title} action={<ExternalAction href={article.sourceUrl}>{article.source}</ExternalAction>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mb-6">
        <a
          href="/news"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/58 transition hover:text-[#e8b45c]"
        >
          <ArrowLeft className="h-4 w-4" />
          News
        </a>
      </div>

      <article className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={cn("p-5 sm:p-7", archiveSurface)}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">{article.publishedAt}</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#fff8e6] sm:text-5xl">{article.title}</h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#f4efe2]/72">{article.deck}</p>

          <div className="mt-8 grid gap-5">
            {article.body.map((paragraph, index) => (
              <section key={`${article.id}-${index}`} className="border-t border-[#f4efe2]/10 pt-5">
                <p className="text-sm leading-7 text-[#f4efe2]/74">{paragraph}</p>
              </section>
            ))}
          </div>
        </div>

        <aside className="grid h-fit gap-5">
          <section className={cn("p-5", archiveSurface)}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Source</h2>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-start justify-between gap-3 border border-[#f4efe2]/10 bg-[#070706]/24 p-3 transition hover:border-[#e8b45c]/45"
            >
              <span>
                <span className="block text-sm font-semibold text-[#fff8e6]">{article.source}</span>
                <span className="mt-2 block text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">open primary lane</span>
              </span>
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#f4efe2]/38" />
            </a>
          </section>

          <section className={cn("p-5", archiveSurface)}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Thumbnail prompt</h2>
            <p className="mt-4 text-xs leading-6 text-[#f4efe2]/64">{article.thumbnailPrompt}</p>
          </section>
        </aside>
      </article>
    </InvertedPageShell>
  )
}
