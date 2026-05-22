const FIRECRAWL_TIMEOUT_MS = 9000
const JINA_TIMEOUT_MS = 9000
const MAX_EXCERPT_CHARS = 1200

type FirecrawlScrapeResponse = {
  data?: {
    markdown?: string
    metadata?: {
      title?: string
      description?: string
      sourceURL?: string
    }
  }
}

export type ExtractedSourceText = {
  excerpt: string
  provider: "firecrawl" | "jina"
  title?: string
  description?: string
}

function cleanExtractedText(value: string) {
  return value
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#*_`>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function excerpt(value?: string) {
  const cleaned = cleanExtractedText(value || "")
  if (!cleaned) return ""
  return cleaned.length > MAX_EXCERPT_CHARS ? `${cleaned.slice(0, MAX_EXCERPT_CHARS - 1).trim()}...` : cleaned
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function extractWithFirecrawl(url: string): Promise<ExtractedSourceText | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null

  const response = await fetchWithTimeout(
    "https://api.firecrawl.dev/v2/scrape",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "InvertedWorldSourceExtraction/1.0",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: FIRECRAWL_TIMEOUT_MS,
      }),
    },
    FIRECRAWL_TIMEOUT_MS + 1000,
  )

  if (!response.ok) return null
  const data = (await response.json().catch(() => null)) as FirecrawlScrapeResponse | null
  const text = excerpt(data?.data?.markdown)
  if (!text) return null

  return {
    excerpt: text,
    provider: "firecrawl",
    title: data?.data?.metadata?.title,
    description: data?.data?.metadata?.description,
  }
}

async function extractWithJina(url: string): Promise<ExtractedSourceText | null> {
  const apiKey = process.env.JINA_API_KEY
  if (!apiKey) return null

  const response = await fetchWithTimeout(
    `https://r.jina.ai/${url}`,
    {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "user-agent": "InvertedWorldSourceExtraction/1.0",
      },
    },
    JINA_TIMEOUT_MS,
  )

  if (!response.ok) return null
  const text = excerpt(await response.text())
  if (!text) return null

  return {
    excerpt: text,
    provider: "jina",
  }
}

export async function extractSourceText(url: string): Promise<ExtractedSourceText | null> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null

  const firecrawl = await extractWithFirecrawl(url).catch(() => null)
  if (firecrawl) return firecrawl

  return extractWithJina(url).catch(() => null)
}
