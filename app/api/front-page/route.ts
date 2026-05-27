import { NextResponse } from "next/server"
import {
  getLatestRecursivFrontPageEditionWithSource,
  getLatestRecursivPipelineRun,
  type FrontPageEdition,
} from "@/lib/recursiv/content"
import { maybeStartNewsRefresh } from "@/lib/recursiv/news-refresh"
import { xPostInternalHref } from "@/lib/x-links"

export const dynamic = "force-dynamic"

type FrontPageSectionItem = {
  id?: unknown
  href?: unknown
  title?: unknown
  text?: unknown
  source?: unknown
  username?: unknown
  topicId?: unknown
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function sectionItems(value: unknown): FrontPageSectionItem[] {
  return Array.isArray(value) ? value.filter((item): item is FrontPageSectionItem => Boolean(item && typeof item === "object")) : []
}

function directItem(item: FrontPageSectionItem, fallbackSource: string) {
  const title = textField(item.title || item.text)
  const href = textField(item.href)
  if (!title || !href) return null
  return {
    title,
    href,
    source: textField(item.source) || fallbackSource,
  }
}

function xSignalItem(item: FrontPageSectionItem) {
  const title = textField(item.text || item.title)
  const topicId = textField(item.topicId) || "uap-disclosure"
  if (!title) return null
  return {
    title,
    href: xPostInternalHref(
      {
        id: textField(item.id),
        topicId,
        url: textField(item.href),
      },
      topicId,
    ),
    source: textField(item.username) ? `@${textField(item.username)}` : "X",
  }
}

function dedupeBreakingItems(items: Array<{ title: string; href: string; source?: string } | null>) {
  const seen = new Set<string>()
  const result: Array<{ title: string; href: string; source?: string }> = []

  for (const item of items) {
    if (!item) continue
    const key = `${item.href}:${item.title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result.slice(0, 32)
}

function breakingItemsFromEdition(edition: FrontPageEdition | null | undefined) {
  const sections = edition?.sections || {}
  const leadWorldwire = directItem((sections.leadWorldwire || {}) as FrontPageSectionItem, "Source")
  const worldwire = sectionItems(sections.worldwire).map((item) => directItem(item, textField(item.source) || "Source"))
  const leadArticle = directItem((sections.leadArticle || {}) as FrontPageSectionItem, "Story")
  const leadDossier = directItem((sections.leadDossier || {}) as FrontPageSectionItem, "Dossier")
  const articles = sectionItems(sections.articles).map((item) => directItem(item, textField(item.source) || "Story"))
  const dossiers = sectionItems(sections.dossiers).map((item) => directItem(item, "Dossier"))
  const xSignals = sectionItems(sections.xSignals).map(xSignalItem)
  const archiveVideos = sectionItems(sections.archiveVideos).map((item) => directItem(item, "Archive"))

  return dedupeBreakingItems([leadWorldwire, ...worldwire, leadArticle, leadDossier, ...articles, ...dossiers, ...xSignals, ...archiveVideos])
}

export async function GET() {
  const refreshKickoff = maybeStartNewsRefresh("front-page-api").catch(() => null)
  const [frontPage, pipeline] = await Promise.all([getLatestRecursivFrontPageEditionWithSource(), getLatestRecursivPipelineRun()])
  void refreshKickoff
  const edition = frontPage?.edition ?? null

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode: frontPage?.sourceMode ?? "unavailable",
    edition,
    breakingItems: breakingItemsFromEdition(edition),
    pipeline,
  })
}
