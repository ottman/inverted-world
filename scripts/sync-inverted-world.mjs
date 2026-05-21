import fs from "node:fs/promises"
import path from "node:path"

const YOUTUBE_FEED =
  process.env.YOUTUBE_FEED_URL ||
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC7qGeFv85Oyct3xlKq-pedw"
const OUT_FILE = path.resolve("data/generated/channel-archive.json")

async function getText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "InvertedWorldContentSync/1.0 (+https://www.inverted.world)",
    },
  })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
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

async function main() {
  const youtubeResult = await getText(YOUTUBE_FEED).then(parseYouTubeFeed).then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason }),
  )

  const archive = {
    generatedAt: new Date().toISOString(),
    sources: {
      youtube: YOUTUBE_FEED,
    },
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
