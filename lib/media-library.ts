import {
  curatedMediaItems,
  featuredVideos,
  researchDocuments,
  topics,
  type ChannelVideo,
  type MediaLibraryItem,
  type ResearchDocument,
} from "@/data/inverted-world"
import recursivPublicSnapshot from "@/data/generated/recursiv-public-snapshot.json"
import { queryInvertedWorldDatabase, type RecursivRow } from "@/lib/recursiv/database"

export type { MediaLibraryItem } from "@/data/inverted-world"

type MediaLibraryRow = RecursivRow & {
  slug?: string | null
  title?: string | null
  source?: string | null
  source_url?: string | null
  kind?: MediaLibraryItem["kind"] | null
  viewer?: MediaLibraryItem["viewer"] | null
  topic_ids?: unknown
  summary?: string | null
  published_at?: string | null
  embed_url?: string | null
  thumbnail_url?: string | null
  file_type?: string | null
  agency?: string | null
  collection?: string | null
  status?: string | null
  metadata?: unknown
}

export type MediaLibraryResult = {
  sourceMode: "recursiv-database" | "recursiv-snapshot" | "static"
  items: MediaLibraryItem[]
}

const WAR_UAP_CSV_URL = "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-csv.csv"

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "")
}

function jsonArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function topicTitle(topicId: string) {
  return topics.find((topic) => topic.id === topicId)?.title || "Inverted World"
}

function absoluteWarUrl(value: string) {
  if (!value) return ""
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("/")) return `https://www.war.gov${value}`
  return `https://www.war.gov/${value.replace(/^\/+/, "")}`
}

function viewerForUrl(url: string, fallback: MediaLibraryItem["viewer"] = "link"): MediaLibraryItem["viewer"] {
  const normalized = url.toLowerCase().split("?")[0]
  if (normalized.endsWith(".pdf")) return "pdf"
  if (/\.(mp4|mov|m4v|webm)$/i.test(normalized)) return "video"
  if (/\.(png|jpe?g|gif|webp)$/i.test(normalized)) return "image"
  return fallback
}

function kindForViewer(viewer: MediaLibraryItem["viewer"]): MediaLibraryItem["kind"] {
  if (viewer === "youtube" || viewer === "video") return "video"
  if (viewer === "pdf") return "document"
  if (viewer === "image") return "image"
  return "archive"
}

function documentMediaItem(document: ResearchDocument): MediaLibraryItem {
  const viewer = viewerForUrl(document.url)
  return {
    id: slugify(`${document.source}-${document.title}`) || slugify(document.url),
    title: document.title,
    source: document.source,
    url: document.url,
    kind: kindForViewer(viewer),
    viewer,
    topicIds: document.topicIds,
    summary: `Primary ${document.kind} source for ${document.topicIds.map(topicTitle).join(", ")} coverage.`,
    fileType: viewer === "pdf" ? "PDF" : document.kind,
    agency: document.source,
  }
}

function videoMediaItem(video: ChannelVideo): MediaLibraryItem {
  return {
    id: video.videoId || slugify(video.href),
    title: video.title,
    source: "Tales From the Inverted World",
    url: video.href,
    kind: "video",
    viewer: "youtube",
    topicIds: [video.topicId],
    summary: video.description || `Tales archive video in the ${topicTitle(video.topicId)} lane.`,
    publishedAt: video.date,
    embedUrl: video.embedUrl,
    thumbnailUrl: video.thumbnail,
    fileType: video.kind === "short" ? "YouTube Short" : "YouTube",
    collection: "Tales archive",
  }
}

function rowToMediaItem(row: MediaLibraryRow): MediaLibraryItem {
  const url = row.source_url || "#"
  const viewer = row.viewer || viewerForUrl(url)
  const topicIds = jsonArray(row.topic_ids).map(String).filter(Boolean)
  return {
    id: row.slug || slugify(`${row.source || hostName(url)}-${row.title || url}`),
    title: row.title || "Untitled media",
    source: row.source || hostName(url) || "Source",
    url,
    kind: row.kind || kindForViewer(viewer),
    viewer,
    topicIds,
    summary: row.summary || `Source media for ${topicIds.map(topicTitle).join(", ") || "the archive"}.`,
    publishedAt: row.published_at || undefined,
    embedUrl: row.embed_url || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    fileType: row.file_type || undefined,
    agency: row.agency || undefined,
    collection: row.collection || undefined,
  }
}

function dedupeMediaItems(items: MediaLibraryItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.url || item.id
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let cell = ""
  let row: string[] = []
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      row.push(cell)
      cell = ""
      continue
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ""
      continue
    }
    cell += char
  }

  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  const headers = rows.shift()?.map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")) || []
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() || ""])))
}

function field(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key.toLowerCase().replace(/[^a-z0-9]+/g, "")]
    if (value) return value
  }
  return ""
}

export async function fetchOfficialUapReleaseMedia(limit = 24): Promise<MediaLibraryItem[]> {
  try {
    const response = await fetch(WAR_UAP_CSV_URL, {
      headers: { "user-agent": "InvertedWorldMediaLibrary/1.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return []
    const rows = parseCsv(await response.text())
    return rows
      .map((row) => {
        const url = absoluteWarUrl(
          field(row, ["url", "downloadurl", "documenturl", "videourl", "imageurl", "mediaurl", "asseturl"]),
        )
        if (!url || !/^https?:\/\//i.test(url)) return null
        const title = field(row, ["title", "name", "assetfilename", "filename", "description"]) || hostName(url)
        const viewer = viewerForUrl(url, /youtu\.?be|video/i.test(url) ? "video" : "link")
        const publishedAt = field(row, ["releasedate", "date", "publicationdate"]) || undefined
        const item: MediaLibraryItem = {
          id: slugify(`war-uap-${title}-${url}`),
          title,
          source: field(row, ["agency", "source"]) || "Department of War",
          url,
          kind: kindForViewer(viewer),
          viewer,
          topicIds: ["uap-disclosure", "secret-programs"],
          summary:
            field(row, ["description", "summary", "caption"]) ||
            "Official UAP release media pulled from the public release index.",
          publishedAt,
          thumbnailUrl: absoluteWarUrl(field(row, ["imageurl", "thumbnailurl", "posterurl"])) || undefined,
          fileType: field(row, ["filetype", "documenttype", "type"]) || undefined,
          agency: field(row, ["agency"]) || "Department of War",
          collection: field(row, ["release", "releasedate"]) || "PURSUE",
        }
        return item
      })
      .filter((item): item is MediaLibraryItem => item !== null)
      .slice(0, limit)
  } catch {
    return []
  }
}

function staticMediaLibraryItems(officialUapItems: MediaLibraryItem[] = []) {
  return dedupeMediaItems([
    ...curatedMediaItems,
    ...officialUapItems,
    ...featuredVideos.map(videoMediaItem),
    ...researchDocuments.map(documentMediaItem),
  ])
}

function snapshotMediaLibraryItems() {
  const rows = Array.isArray(recursivPublicSnapshot.mediaItems)
    ? (recursivPublicSnapshot.mediaItems as MediaLibraryRow[])
    : []
  return dedupeMediaItems(rows.map(rowToMediaItem))
}

export async function fetchMediaSeedItemsForSync() {
  const officialUapItems = await fetchOfficialUapReleaseMedia()
  return staticMediaLibraryItems(officialUapItems)
}

export async function fetchMediaLibrary(): Promise<MediaLibraryResult> {
  const [rows, officialUapItems] = await Promise.all([
    queryInvertedWorldDatabase<MediaLibraryRow>(
      `SELECT
        slug,
        title,
        source,
        source_url,
        kind,
        viewer,
        topic_ids,
        summary,
        published_at,
        embed_url,
        thumbnail_url,
        file_type,
        agency,
        collection,
        status,
        metadata
      FROM media_items
      WHERE status = 'active'
      ORDER BY published_at DESC NULLS LAST, updated_at DESC NULLS LAST, title`,
    ),
    fetchOfficialUapReleaseMedia(),
  ])

  if (rows?.length) {
    return {
      sourceMode: "recursiv-database",
      items: dedupeMediaItems([...rows.map(rowToMediaItem), ...officialUapItems]),
    }
  }

  const snapshotItems = snapshotMediaLibraryItems()
  if (snapshotItems.length) {
    return {
      sourceMode: "recursiv-snapshot",
      items: dedupeMediaItems([...snapshotItems, ...officialUapItems]),
    }
  }

  return {
    sourceMode: "static",
    items: staticMediaLibraryItems(officialUapItems),
  }
}
