export type WorldwireLane = {
  id: string
  title: string
  query: string
}

export type WorldwireItem = {
  id: string
  title: string
  url: string
  source: string
  sectionId: string
  sectionTitle: string
  score: number
  publishedAt?: string
  excerpt?: string
}

export const WORLDWIRE_LANES: WorldwireLane[] = [
  {
    id: "world",
    title: "World",
    query: "breaking world news crisis scandal leak emergency geopolitics",
  },
  {
    id: "war",
    title: "War",
    query: "war military attack border missiles intelligence defense escalation",
  },
  {
    id: "america",
    title: "America",
    query: "US politics courts congress election corruption investigation breaking",
  },
  {
    id: "money",
    title: "Money",
    query: "markets economy banks debt inflation crypto collapse fraud breaking",
  },
  {
    id: "tech-ai",
    title: "Tech / AI",
    query: "artificial intelligence surveillance cyberattack robots chips censorship",
  },
  {
    id: "science-space",
    title: "Science / Space",
    query: "NASA space anomaly asteroid volcano earthquake disease lab discovery",
  },
  {
    id: "crime-culture",
    title: "Crime / Culture",
    query: "crime media scandal culture celebrity police censorship trial",
  },
]

const HOT_WORDS = [
  "alien",
  "anomaly",
  "attack",
  "blackout",
  "classified",
  "collapse",
  "crisis",
  "emergency",
  "explosion",
  "leak",
  "mystery",
  "secret",
  "surveillance",
  "unprecedented",
  "warning",
  "war",
]

export function normalizeWorldwireText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function decodeWorldwireEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

export function stripWorldwireTags(value: string) {
  return value.replace(/<[^>]*>/g, " ")
}

export function readWorldwireXmlTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? normalizeWorldwireText(decodeWorldwireEntities(stripWorldwireTags(match[1]))) : ""
}

export function readWorldwireXmlSource(item: string) {
  const match = item.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i)
  return {
    name: match ? normalizeWorldwireText(decodeWorldwireEntities(stripWorldwireTags(match[2]))) : "News wire",
    url: match ? decodeWorldwireEntities(match[1]) : undefined,
  }
}

export function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export function isExternalUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value))
}

export function isGoogleNewsUrl(value: string) {
  return hostName(value) === "news.google.com"
}

export function scoreWorldwireTitle(title: string, baseScore: number, index: number) {
  const lower = title.toLowerCase()
  const heat = HOT_WORDS.reduce((total, word) => total + (lower.includes(word) ? 11 : 0), 0)
  const punctuation = /[?!]/.test(title) ? 6 : 0
  return baseScore + heat + punctuation - index * 3
}

export function uniqueWorldwireItems(items: WorldwireItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.url.replace(/\/$/, "")}:${item.title.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
