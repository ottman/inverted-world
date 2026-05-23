import type { IntelligenceArticle } from "@/data/intelligence-articles"

export function articleHref(article: Pick<IntelligenceArticle, "id" | "sourceUrl">) {
  if (article.sourceUrl?.startsWith("/news/")) return article.sourceUrl
  return `/news/${encodeURIComponent(article.id)}`
}
