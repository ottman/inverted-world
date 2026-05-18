import fs from "node:fs/promises"
import path from "node:path"

const TIMCAST_CHANNEL =
  process.env.TIMCAST_CHANNEL_URL ||
  "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291"
const YOUTUBE_FEED =
  process.env.YOUTUBE_FEED_URL ||
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC7qGeFv85Oyct3xlKq-pedw"
const MAX_PAGES = Number(process.env.TIMCAST_MAX_PAGES || "50")
const OUT_FILE = path.resolve("data/generated/channel-archive.json")

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

async function getText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "InvertedWorldContentSync/1.0 (+https://www.inverted.world)",
    },
  })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

function parseTimcastVideos(html, pageUrl) {
  const videos = []
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = linkPattern.exec(html))) {
    const href = absoluteUrl(match[1], pageUrl)
    const label = stripHtml(match[2])
    if (!label || !href.includes("/video/")) continue

    const dateMatch = label.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/)
    const title = label
      .replace(/^Video\s+/i, "")
      .replace(/\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}.*$/, "")
      .trim()

    if (title) {
      videos.push({
        title,
        href,
        date: dateMatch?.[1] || null,
        source: "timcast",
      })
    }
  }

  return videos
}

function findNextUrl(html, pageUrl) {
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = linkPattern.exec(html))) {
    if (stripHtml(match[2]).toLowerCase() === "next") {
      return absoluteUrl(match[1], pageUrl)
    }
  }
  return null
}

function parseYouTubeFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((entry) => {
    const block = entry[1]
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim()
    const href = block.match(/<link rel="alternate" href="([^"]+)"/)?.[1]
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1]
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    return {
      title,
      href,
      published,
      videoId,
      source: "youtube",
    }
  }).filter((item) => item.title && item.href)
}

async function syncTimcast() {
  const seenUrls = new Set()
  const videos = []
  let pageUrl = TIMCAST_CHANNEL

  for (let page = 1; page <= MAX_PAGES && pageUrl && !seenUrls.has(pageUrl); page += 1) {
    seenUrls.add(pageUrl)
    const html = await getText(pageUrl)
    videos.push(...parseTimcastVideos(html, pageUrl))
    pageUrl = findNextUrl(html, pageUrl)
  }

  return videos
}

async function main() {
  const [timcastResult, youtubeResult] = await Promise.allSettled([
    syncTimcast(),
    getText(YOUTUBE_FEED).then(parseYouTubeFeed),
  ])

  const archive = {
    generatedAt: new Date().toISOString(),
    sources: {
      timcast: TIMCAST_CHANNEL,
      youtube: YOUTUBE_FEED,
    },
    timcast:
      timcastResult.status === "fulfilled"
        ? timcastResult.value
        : { error: timcastResult.reason?.message || String(timcastResult.reason) },
    youtube:
      youtubeResult.status === "fulfilled"
        ? youtubeResult.value
        : { error: youtubeResult.reason?.message || String(youtubeResult.reason) },
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, `${JSON.stringify(archive, null, 2)}\n`)
  console.log(`Wrote ${OUT_FILE}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
