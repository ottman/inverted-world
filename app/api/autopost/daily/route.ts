import { NextResponse } from "next/server"
import { researchDocuments, topics } from "@/data/inverted-world"
import {
  fetchRecursivClaimDossiers,
  getLatestRecursivFrontPageEditionWithSource,
  getLatestRecursivPipelineRun,
  type ClaimDossier,
} from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

const SITE_URL = process.env.INVERTED_WORLD_SITE_URL || "https://invertedworld.on.recursiv.io"

function textField(value: unknown) {
  return typeof value === "string" ? value : ""
}

function numberField(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

function absoluteUrl(pathOrUrl: string) {
  if (!pathOrUrl) return SITE_URL
  try {
    return new URL(pathOrUrl).toString()
  } catch {
    return new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, SITE_URL).toString()
  }
}

function uniqueByUrl<T extends { url: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.url.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function topicLabel(topicId: string) {
  return topics.find((topic) => topic.id === topicId)?.title || "Inverted World"
}

function sourcePack(dossiers: ClaimDossier[]) {
  const dossierSources = dossiers.flatMap((dossier) =>
    dossier.sourceLinks.map((source) => ({
      title: source.title,
      url: source.url,
      outlet: source.outlet || "source",
      kind: source.sourceKind || "source",
      topic: dossier.topic,
      evidence: dossier.evidenceGrade,
    })),
  )
  const fallbackSources = researchDocuments.slice(0, 12).map((document) => ({
    title: document.title,
    url: document.url,
    outlet: document.source,
    kind: document.kind,
    topic: document.topicIds.map(topicLabel).join(", "),
    evidence: "source-shelf",
  }))

  return uniqueByUrl(dossierSources.length ? dossierSources : fallbackSources).slice(0, 18)
}

function socialThread(lead: ClaimDossier | undefined, editionHeadline: string, editionDeck: string, sourceCount: number) {
  if (!lead) {
    return [
      `${editionHeadline}\n\n${editionDeck}`,
      `Start with ${sourceCount} source links, then move through the live desk, Tales archive, and source shelf.`,
      `Read the latest desk: ${absoluteUrl("/news")} / Archive: ${absoluteUrl("/archive")} / Sources: ${absoluteUrl("/documents")}`,
    ]
  }

  const sourceLine = sourceCount === 1 ? "1 source attached" : `${sourceCount} sources attached`
  const archiveLine = lead.relatedVideoCount === 1 ? "1 Tales archive link" : `${lead.relatedVideoCount} Tales archive links`

  return [
    `${lead.title}\n\n${lead.summary}`,
    `Evidence grade: ${lead.evidenceGrade}. Confidence: ${lead.confidenceScore}/100. X velocity: ${lead.xVelocityScore}.`,
    `Context: ${lead.weirdRead}`,
    `Skeptical read: ${lead.skepticalRead}`,
    `${sourceLine}. ${archiveLine}. Read the story: ${absoluteUrl(`/news/${lead.slug}`)}`,
  ]
}

function headlineVariants(lead: ClaimDossier | undefined, editionHeadline: string) {
  const variants = lead?.viralHeadlines.filter(Boolean) || []
  return [
    ...variants,
    editionHeadline,
    lead ? `${lead.topic}: what the records show and what is still missing` : "The Inverted World daily source packet is live",
  ].slice(0, 8)
}

export async function GET() {
  const [frontPage, pipeline, dossiers] = await Promise.all([
    getLatestRecursivFrontPageEditionWithSource(),
    getLatestRecursivPipelineRun(),
    fetchRecursivClaimDossiers({ limit: 12 }).then((items) => items || []),
  ])
  const edition = frontPage?.edition ?? null
  const lead = dossiers.find((dossier) => dossier.slug === edition?.leadDossierSlug) || dossiers[0]
  const articles = recordArray(edition?.sections.articles).slice(0, 8)
  const editionDossiers = recordArray(edition?.sections.dossiers).slice(0, 8)
  const xSignals = recordArray(edition?.sections.xSignals).slice(0, 8)
  const archiveVideos = recordArray(edition?.sections.archiveVideos).slice(0, 6)
  const sources = sourcePack(dossiers)
  const headline = edition?.headline || lead?.title || "Inverted World daily briefing"
  const deck = edition?.deck || lead?.summary || "Daily Recursiv-backed news, source, X, and Tales archive packet."
  const leadUrl = lead ? absoluteUrl(`/news/${lead.slug}`) : absoluteUrl("/news")
  const headlineList = headlineVariants(lead, headline)
  const thread = socialThread(lead, headline, deck, sources.length)
  const imagePrompts = [
    `Inverted World daily briefing thumbnail for "${headline}": source graph, X velocity, court records, archive tape, amber-black editorial palette, no fake documents, no faces.`,
    `Share card for "${headline}": evidence grade, source pack, Tales archive context, stark investigative news design.`,
  ]
  const links = {
    newsDesk: absoluteUrl("/news"),
    archive: absoluteUrl("/archive"),
    sources: absoluteUrl("/documents"),
    howItWorks: absoluteUrl("/how-it-works"),
    articles: articles.map((item) => ({
      title: textField(item.title),
      url: absoluteUrl(textField(item.href) || "/news"),
      source: textField(item.source),
      heat: numberField(item.heat),
    })),
    dossiers: editionDossiers.map((item) => ({
      title: textField(item.title),
      url: absoluteUrl(textField(item.href) || "/news"),
      evidenceGrade: textField(item.evidenceGrade),
      xVelocityScore: numberField(item.xVelocityScore),
    })),
    xSignals: xSignals.map((item) => ({
      text: textField(item.text),
      url: textField(item.href),
      username: textField(item.username),
      score: numberField(item.score),
    })),
    archiveVideos: archiveVideos.map((item) => ({
      title: textField(item.title),
      url: absoluteUrl(textField(item.href) || "/archive"),
      topic: topicLabel(textField(item.topicId)),
    })),
  }
  const readiness = {
    ready: Boolean(
      frontPage?.sourceMode &&
        edition &&
        lead &&
        sources.length >= 8 &&
        headlineList.length >= 3 &&
        thread.length >= 3 &&
        imagePrompts.length >= 2 &&
        links.articles.length >= 3 &&
        links.xSignals.length >= 3 &&
        links.archiveVideos.length >= 2,
    ),
    sourceMode: frontPage?.sourceMode ?? "unavailable",
    hasEdition: Boolean(edition),
    hasLeadDossier: Boolean(lead),
    sourcePackCount: sources.length,
    headlineVariantCount: headlineList.length,
    xThreadCount: thread.length,
    imagePromptCount: imagePrompts.length,
    articleLinkCount: links.articles.length,
    dossierLinkCount: links.dossiers.length,
    xSignalLinkCount: links.xSignals.length,
    archiveVideoLinkCount: links.archiveVideos.length,
    hasGuardrails: true,
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode: frontPage?.sourceMode ?? "unavailable",
    status: readiness.ready ? "ready" : "assembling",
    siteUrl: SITE_URL,
    readiness,
    edition: edition
      ? {
          slug: edition.slug,
          date: edition.editionDate,
          headline: edition.headline,
          deck: edition.deck,
          url: absoluteUrl("/news"),
          metrics: edition.metrics,
        }
      : null,
    pipeline,
    autopost: {
      canonicalUrl: leadUrl,
      primaryPost: `${headline}\n\n${deck}\n\n${leadUrl}`,
      headlineVariants: headlineList,
      xThread: thread,
      hashtags: ["InvertedWorld", "TalesFromTheInvertedWorld", "OpenRecords", topicLabel(lead?.topicId || "")].filter(Boolean),
      newsletter: {
        subject: `Inverted World: ${headline}`,
        preview: deck,
        sections: [
          { title: "Lead Dossier", href: leadUrl, summary: lead?.summary || deck },
          { title: "Source Pack", count: sources.length },
          { title: "X Velocity", count: xSignals.length },
          { title: "Tales Archive", count: archiveVideos.length },
        ],
      },
      shortVideo: {
        hook: lead?.viralHeadlines[0] || headline,
        beats: [
          lead?.claim || headline,
          lead ? `Evidence grade: ${lead.evidenceGrade}; confidence ${lead.confidenceScore}/100.` : deck,
          lead?.weirdRead || "Follow the strange read, then check the source links.",
          lead?.skepticalRead || "Separate records, allegations, speculation, and open questions.",
          `Read the dossier and source pack at ${leadUrl}`,
        ].filter(Boolean),
      },
      imagePrompts,
      sourcePack: sources,
      links,
      guardrails: [
        "Separate documented facts, allegations, speculation, and open questions.",
        "Do not imply guilt, certainty, or source confirmation beyond the attached records.",
        "Use the source pack and dossier URL in every off-platform post.",
      ],
    },
  })
}
