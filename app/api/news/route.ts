import { NextRequest, NextResponse } from "next/server"
import {
  fallbackCoverage,
  getDocumentsForTopic,
  getTopic,
  type NewsCoverageItem,
} from "@/data/inverted-world"

export const dynamic = "force-dynamic"

type GdeltArticle = {
  title?: string
  url?: string
  domain?: string
  sourceCountry?: string
  seendate?: string
}

type FederalRegisterDocument = {
  title?: string
  html_url?: string
  publication_date?: string
  agencies?: Array<{ name?: string }>
}

async function fetchGdeltCoverage(query: string): Promise<NewsCoverageItem[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc")
  url.searchParams.set("query", query)
  url.searchParams.set("mode", "artlist")
  url.searchParams.set("format", "json")
  url.searchParams.set("maxrecords", "12")
  url.searchParams.set("sort", "hybridrel")

  const response = await fetch(url, { next: { revalidate: 900 } })
  if (!response.ok) throw new Error(`GDELT returned ${response.status}`)
  const data = (await response.json()) as { articles?: GdeltArticle[] }

  return (data.articles ?? [])
    .filter((article) => article.title && article.url)
    .map((article) => ({
      title: article.title!,
      outlet: article.domain || "GDELT-indexed outlet",
      url: article.url!,
      publishedAt: article.seendate,
      sourceCountry: article.sourceCountry,
      lane: "news" as const,
    }))
}

async function fetchFederalRegister(query: string): Promise<NewsCoverageItem[]> {
  const url = new URL("https://www.federalregister.gov/api/v1/documents.json")
  url.searchParams.set("conditions[term]", query.replaceAll('"', ""))
  url.searchParams.set("per_page", "6")
  url.searchParams.set("order", "newest")

  const response = await fetch(url, { next: { revalidate: 3600 } })
  if (!response.ok) throw new Error(`Federal Register returned ${response.status}`)
  const data = (await response.json()) as { results?: FederalRegisterDocument[] }

  return (data.results ?? [])
    .filter((doc) => doc.title && doc.html_url)
    .map((doc) => ({
      title: doc.title!,
      outlet: doc.agencies?.[0]?.name || "Federal Register",
      url: doc.html_url!,
      publishedAt: doc.publication_date,
      lane: "official" as const,
    }))
}

export async function GET(request: NextRequest) {
  const topic = getTopic(request.nextUrl.searchParams.get("topic"))
  const query = request.nextUrl.searchParams.get("q") || topic.query
  const docs = getDocumentsForTopic(topic.id)
  const officialDocs: NewsCoverageItem[] = docs.map((doc) => ({
    title: doc.title,
    outlet: doc.source,
    url: doc.url,
    lane: doc.kind === "science" ? "science" : doc.kind === "archive" ? "archive" : "official",
  }))

  try {
    const [gdelt, federal] = await Promise.allSettled([
      fetchGdeltCoverage(query),
      fetchFederalRegister(query),
    ])

    const coverage = [
      ...(gdelt.status === "fulfilled" ? gdelt.value : []),
      ...(federal.status === "fulfilled" ? federal.value : []),
      ...officialDocs,
    ]

    return NextResponse.json({
      topic,
      query,
      coverage: coverage.length ? coverage : fallbackCoverage,
      warnings: [
        gdelt.status === "rejected" ? gdelt.reason?.message || "GDELT lookup failed" : null,
        federal.status === "rejected" ? federal.reason?.message || "Federal Register lookup failed" : null,
      ].filter(Boolean),
    })
  } catch (error) {
    return NextResponse.json({
      topic,
      query,
      coverage: [...fallbackCoverage, ...officialDocs],
      warnings: [error instanceof Error ? error.message : "News lookup failed"],
    })
  }
}
