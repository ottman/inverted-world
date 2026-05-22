import fs from "node:fs/promises"
import path from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { Recursiv } from "@recursiv/sdk"

const YOUTUBE_FEED =
  process.env.YOUTUBE_FEED_URL ||
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC7qGeFv85Oyct3xlKq-pedw"
const OUT_FILE = path.resolve("data/generated/channel-archive.json")
const DEFAULT_RECURSIV_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_RECURSIV_DATABASE_NAME = "inverted_world_research"

const TOPIC_KEYWORDS = [
  { topicId: "uap-disclosure", words: ["ufo", "uap", "alien", "retrieval", "aaro", "pentagon", "disclosure"] },
  { topicId: "secret-programs", words: ["mkultra", "cia", "fbi", "psyop", "coverup", "classified", "hearing"] },
  { topicId: "epstein-networks", words: ["epstein", "maxwell", "island", "sealed", "client list", "court"] },
  { topicId: "cryptids-paranormal", words: ["cryptid", "bigfoot", "ghost", "paranormal", "haunted", "demon"] },
  { topicId: "ai-technocracy", words: ["ai", "data center", "surveillance", "technocracy", "algorithm", "machine"] },
  { topicId: "space-anomalies", words: ["bermuda", "nasa", "moon", "mars", "meteor", "space", "solar"] },
]

function loadEnvFile(file) {
  if (!existsSync(file)) return
  const content = readFileSync(file, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, "")
  }
}

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function classifyTopic(title, description = "") {
  const haystack = `${title} ${description}`.toLowerCase()
  return TOPIC_KEYWORDS.find((topic) => topic.words.some((word) => haystack.includes(word)))?.topicId || "secret-programs"
}

function readApiKeyFromFile() {
  const candidates = [process.env.RECURSIV_API_KEY_FILE, "/private/tmp/inverted-world-recursiv-key"].filter(Boolean)
  for (const file of candidates) {
    if (existsSync(file)) return readFileSync(file, "utf8").trim()
  }
  return undefined
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

function parseYouTubeFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((entry) => {
    const block = entry[1]
    const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim())
    const href = block.match(/<link rel="alternate" href="([^"]+)"/)?.[1]
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1]
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    return {
      title,
      href,
      published,
      videoId,
      topicId: classifyTopic(title),
      thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
      embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : undefined,
      kind: title?.toLowerCase().includes("#shorts") ? "short" : "episode",
      source: "youtube",
    }
  }).filter((item) => item.title && item.href)
}

async function pushYouTubeArchiveToRecursiv(items) {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const apiKey =
    readApiKeyFromFile() ||
    process.env.RECURSIV_SERVER_API_KEY ||
    process.env.RECURSIV_API_KEY ||
    process.env.SOCIAL_DEV_API_KEY
  const projectId = process.env.RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_RECURSIV_DATABASE_NAME
  if (!apiKey) throw new Error("Missing RECURSIV_SERVER_API_KEY or RECURSIV_API_KEY")
  if (!projectId) throw new Error("Missing RECURSIV_PROJECT_ID")

  const sdk = new Recursiv({
    apiKey,
    baseUrl: process.env.RECURSIV_BASE_URL || DEFAULT_RECURSIV_BASE_URL,
    timeout: 120000,
    maxRetries: 2,
  })

  await sdk.databases.ensure({ project_id: projectId, name: databaseName })
  for (const item of items) {
    await sdk.databases.query({
      project_id: projectId,
      database_name: databaseName,
      sql: `INSERT INTO channel_items (
          source,
          source_id,
          source_url,
          title,
          published_at,
          topic_id,
          thumbnail_url,
          embed_url,
          kind,
          metadata,
          updated_at
        )
        VALUES ('youtube', $1, $2, $3, NULLIF($4, '')::timestamptz, $5, $6, $7, $8, $9::jsonb, now())
        ON CONFLICT (source_url) DO UPDATE SET
          source_id = EXCLUDED.source_id,
          title = EXCLUDED.title,
          published_at = EXCLUDED.published_at,
          topic_id = EXCLUDED.topic_id,
          thumbnail_url = EXCLUDED.thumbnail_url,
          embed_url = EXCLUDED.embed_url,
          kind = EXCLUDED.kind,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
      params: [
        item.videoId,
        item.href,
        item.title,
        item.published || "",
        item.topicId,
        item.thumbnail,
        item.embedUrl,
        item.kind,
        JSON.stringify({ syncedBy: "scripts/sync-inverted-world.mjs" }),
      ],
    })
  }

  return items.length
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

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

  if (process.argv.includes("--push-recursiv")) {
    if (youtubeResult.status !== "fulfilled") throw new Error("Cannot push failed YouTube archive sync")
    const pushed = await pushYouTubeArchiveToRecursiv(youtubeResult.value)
    console.log(`Pushed ${pushed} YouTube archive rows to Recursiv`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
