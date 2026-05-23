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
    id: "front-page",
    title: "Front Page",
    query: "breaking news live updates global crisis scandal investigation emergency latest",
  },
  {
    id: "world",
    title: "World",
    query: "world news coup protest scandal leak emergency election geopolitics diplomacy",
  },
  {
    id: "war",
    title: "War",
    query: "war military attack missiles drone intelligence defense escalation invasion",
  },
  {
    id: "america",
    title: "America",
    query: "US politics White House Congress election corruption investigation live",
  },
  {
    id: "law-courts",
    title: "Law / Courts",
    query: "court ruling lawsuit indictment trial judge prosecutor supreme court investigation",
  },
  {
    id: "power-files",
    title: "Power / Files",
    query: "classified documents whistleblower court filing intelligence agency FOIA leak",
  },
  {
    id: "money",
    title: "Money",
    query: "markets economy banks debt inflation crypto collapse fraud trade layoffs",
  },
  {
    id: "tech-ai",
    title: "Tech / AI",
    query: "artificial intelligence surveillance cyberattack robots chips censorship internet data center",
  },
  {
    id: "energy-grid",
    title: "Energy / Grid",
    query: "power grid energy blackout oil gas nuclear electricity infrastructure data centers",
  },
  {
    id: "health-earth",
    title: "Health / Earth",
    query: "disease outbreak lab medicine volcano earthquake climate disaster weather",
  },
  {
    id: "science-space",
    title: "Science / Space",
    query: "NASA space anomaly asteroid discovery physics telescope launch solar storm",
  },
  {
    id: "crime-culture",
    title: "Crime / Culture",
    query: "crime scandal culture celebrity police censorship trial media backlash",
  },
  {
    id: "media-internet",
    title: "Media / Internet",
    query: "media scandal censorship platform journalism influencer viral internet controversy",
  },
  {
    id: "sports-spectacle",
    title: "Sports / Spectacle",
    query: "sports scandal championship fight injury gambling league controversy viral",
  },
  {
    id: "strange",
    title: "Strange",
    query: "UFO UAP unexplained anomaly mystery archaeology paranormal government records",
  },
]

const HOT_WORDS = [
  "abuse",
  "alien",
  "anomaly",
  "attack",
  "assassination",
  "bankrupt",
  "blackout",
  "bombshell",
  "classified",
  "court",
  "coup",
  "crash",
  "criminal",
  "collapse",
  "corruption",
  "crisis",
  "dead",
  "declassified",
  "disaster",
  "drone",
  "emergency",
  "evacuate",
  "explosion",
  "fraud",
  "hack",
  "hostage",
  "indictment",
  "intelligence",
  "investigation",
  "leak",
  "lawsuit",
  "missile",
  "mystery",
  "outbreak",
  "raid",
  "records",
  "resigns",
  "sanctions",
  "secret",
  "shooting",
  "shock",
  "shutdown",
  "spy",
  "strike",
  "surveillance",
  "terror",
  "trial",
  "uap",
  "ufo",
  "unprecedented",
  "warning",
  "war",
  "whistleblower",
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

export function sourceLabel(source?: string, url?: string) {
  const host = hostName(url || "")
  const cleaned = normalizeWorldwireText(source || "")
  const wordCount = cleaned ? cleaned.split(/\s+/).length : 0
  const looksLikeDomain = /\.[a-z]{2,}/i.test(cleaned)
  const knownShortBrand = /^(ap|bbc|cnn|npr|reuters|axios|politico|bloomberg|propublica)$/i.test(cleaned)
  const preferHost =
    Boolean(host) &&
    (!cleaned || /^by\b/i.test(cleaned) || cleaned.length > 42 || (wordCount > 1 && !looksLikeDomain && !knownShortBrand))
  return preferHost ? host : cleaned || host || "source"
}

const SOURCE_AUTHORITY_BONUSES: Array<[string, number]> = [
  ["apnews.com", 18],
  ["reuters.com", 18],
  ["bbc.com", 16],
  ["bbc.co.uk", 16],
  ["wsj.com", 16],
  ["ft.com", 16],
  ["bloomberg.com", 16],
  ["nytimes.com", 14],
  ["washingtonpost.com", 14],
  ["theguardian.com", 12],
  ["politico.com", 12],
  ["axios.com", 10],
  ["aljazeera.com", 10],
  ["npr.org", 10],
  ["abcnews.go.com", 10],
  ["cbsnews.com", 10],
  ["nbcnews.com", 10],
  ["cnn.com", 8],
  ["foxnews.com", 8],
  ["defensenews.com", 12],
  ["war.gov", 20],
  ["nasa.gov", 18],
  ["noaa.gov", 18],
  ["justice.gov", 18],
  ["fbi.gov", 18],
  ["cia.gov", 18],
  ["dni.gov", 18],
  ["cdc.gov", 16],
  ["who.int", 16],
  ["sec.gov", 16],
  ["federalregister.gov", 16],
  ["courtlistener.com", 14],
  ["documentcloud.org", 14],
  ["muckrock.com", 12],
  ["nsarchive.gwu.edu", 12],
]

function scoreSourceAuthority(source?: string, url?: string) {
  const host = hostName(url || "")
  const haystack = `${host} ${source || ""}`.toLowerCase()
  return SOURCE_AUTHORITY_BONUSES.reduce((score, [needle, bonus]) => (haystack.includes(needle) ? Math.max(score, bonus) : score), 0)
}

export function isExternalUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value))
}

export function isGoogleNewsUrl(value: string) {
  return hostName(value) === "news.google.com"
}

export function looksLikeArticleUrl(value: string) {
  try {
    const url = new URL(value)
    if (!/^https?:$/.test(url.protocol)) return false
    const pathParts = url.pathname.split("/").filter(Boolean)
    if (pathParts.length === 0) return false
    if (/^(home|search|tag|topic|topics|category|categories|author|authors)$/i.test(pathParts[0] || "")) return false
    return true
  } catch {
    return false
  }
}

export function scoreWorldwireTitle(title: string, baseScore: number, index: number, context: { source?: string; url?: string } = {}) {
  const lower = title.toLowerCase()
  const heat = HOT_WORDS.reduce((total, word) => total + (lower.includes(word) ? 11 : 0), 0)
  const punctuation = /[?!]/.test(title) ? 6 : 0
  const live = /\b(breaking|live|latest|just in|watch|updates?)\b/i.test(title) ? 8 : 0
  return baseScore + heat + punctuation + live + scoreSourceAuthority(context.source, context.url) - index * 3
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
