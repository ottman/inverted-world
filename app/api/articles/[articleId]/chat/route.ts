import { NextResponse } from "next/server"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import { featuredVideos, researchDocuments } from "@/data/inverted-world"
import { getArticleById } from "@/lib/live-articles"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: {
    articleId: string
  }
}

type ArticleLink = {
  title: string
  url: string
  note?: string
}

function trimMessage(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, 1200)
}

function isExternalUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value))
}

function markdownLabel(value: string, fallback = "Source") {
  return (value || fallback).replace(/[\[\]\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) || fallback
}

function markdownLink(label: string, url?: string) {
  if (!url || url === "#") return markdownLabel(label)
  return `[${markdownLabel(label)}](${url})`
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function questionFocus(message: string) {
  const normalized = message.toLowerCase()
  return {
    evidence: /\b(evidence|source|document|proof|prove|primary|link)\b/.test(normalized),
    truth: /\b(true|truth|real|verified|fact|facts|documented)\b/.test(normalized),
    missing: /\b(missing|unknown|unproven|weak|skeptical|counter)\b/.test(normalized),
    video: /\b(video|youtube|tales|episode|archive|show)\b/.test(normalized),
  }
}

function sentence(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function articleSourceLinks(article: IntelligenceArticle): ArticleLink[] {
  const links: ArticleLink[] = []
  if (isExternalUrl(article.sourceUrl)) {
    links.push({
      title: article.source || article.title,
      url: article.sourceUrl,
      note: "lead source",
    })
  }

  for (const document of researchDocuments.filter((item) => item.topicIds.includes(article.topicId)).slice(0, 4)) {
    if (!isExternalUrl(document.url) || links.some((link) => link.url === document.url)) continue
    links.push({
      title: document.title,
      url: document.url,
      note: document.source,
    })
  }

  return links.slice(0, 5)
}

function relatedArchiveLinks(article: IntelligenceArticle) {
  return featuredVideos
    .filter((video) => video.topicId === article.topicId)
    .slice(0, 3)
    .map((video) => ({
      title: video.title,
      url: video.videoId ? `/archive/${video.videoId}` : video.href,
    }))
}

function fallbackConversationId(article: IntelligenceArticle, conversationId?: string) {
  return conversationId || `article-${article.id}-${Date.now().toString(36)}`
}

function fallbackArticleAnswer(article: IntelligenceArticle, message: string) {
  const focus = questionFocus(message)
  const sources = articleSourceLinks(article)
  const archive = relatedArchiveLinks(article)
  const leadParagraph = sentence(article.body[0] || article.deck || article.title)
  const sourceLines = sources.map((source) => {
    const suffix = source.note ? ` - ${source.note}` : ""
    return `- ${markdownLink(source.title, source.url)}${suffix}`
  })
  const archiveLines = archive.map((item) => `- ${markdownLink(item.title, item.url)}`)
  const bodySignals = article.body.slice(1, 4).map((paragraph) => `- ${sentence(paragraph).slice(0, 260)}`)

  const lead = focus.truth
    ? `The article supports **${article.title}** as a sourced news story, with unresolved questions separated from the documented record.`
    : focus.evidence
      ? `Start with the linked source trail for **${article.title}**, then compare the article body against the related records.`
      : focus.video
        ? `The Tales archive gives background context for **${article.title}**; the article source links are still the evidentiary starting point.`
        : `**${article.title}** is a ${article.topic} story sourced from ${article.source || "the current source trail"}.`

  const documented = [
    `- ${leadParagraph}`,
    `- Published lane: **${article.topic}**. Source label: **${article.source || "source trail"}**.`,
    sources.length
      ? `- Attached source trail: ${countLabel(sources.length, "link")}, led by ${markdownLink(sources[0].title, sources[0].url)}.`
      : "- This article needs a stronger primary-source attachment before it should be treated as settled.",
  ]

  const sections = [
    `**Short answer:** ${lead}`,
    `**What the article says**\n${documented.join("\n")}`,
  ]

  if (bodySignals.length) sections.push(`**Reporting context**\n${bodySignals.join("\n")}`)

  sections.push(
    `**What still needs checking**\n${
      [
        "- Separate the article's documented statements from inferences, reactions, and viral framing.",
        focus.missing || focus.truth
          ? "- The strongest upgrade would be a primary document, full transcript, named on-record source, or official response attached directly to the story."
          : "- Before sharing the strongest version of the story, compare the lead source against at least one skeptical or hostile read.",
      ].join("\n")
    }`,
  )

  if (sourceLines.length) sections.push(`**Start with these sources**\n${sourceLines.join("\n")}`)
  if (archiveLines.length) sections.push(`**Tales archive context**\n${archiveLines.join("\n")}`)

  return sections.join("\n\n")
}

export async function GET(_request: Request, { params }: RouteContext) {
  const article = await getArticleById(params.articleId, { allowProviderFallbacks: false })
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  return NextResponse.json({
    articleId: article.id,
    generatedAt: new Date().toISOString(),
    count: 0,
    messages: [],
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  const article = await getArticleById(params.articleId, { allowProviderFallbacks: false })
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    message?: unknown
    conversationId?: unknown
  }
  const message = trimMessage(body.message)
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const responseText = fallbackArticleAnswer(article, message)

  return NextResponse.json({
    conversationId: fallbackConversationId(article, conversationId),
    response: responseText,
    mode: "context-fallback",
    stored: false,
  })
}
