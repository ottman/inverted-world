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
import { getDeepArchive } from "@/lib/deep-archive"
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

type MediaExtraction = NonNullable<MediaLibraryItem["extraction"]>

export type MediaLibraryResult = {
  sourceMode: "recursiv-database" | "recursiv-snapshot" | "static"
  items: MediaLibraryItem[]
}

export type ExpandedMediaLibraryResult = MediaLibraryResult & {
  archiveSourceMode?: Awaited<ReturnType<typeof getDeepArchive>>["sourceMode"]
}

const WAR_UAP_CSV_URLS = [
  "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-data.csv",
  "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-csv.csv",
]

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

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function textArray(value: unknown) {
  return jsonArray(value).map(String).filter(Boolean)
}

function mediaExtractionFromMetadata(value: unknown): MediaExtraction | undefined {
  const metadata = jsonObject(value)
  const raw = jsonObject(metadata.extraction)
  const brief = typeof raw.brief === "string" ? raw.brief.trim() : ""
  if (!brief) return undefined

  const sourceChain: MediaExtraction["sourceChain"] = []
  for (const item of jsonArray(raw.sourceChain)) {
    const source = jsonObject(item)
    const label = typeof source.label === "string" ? source.label.trim() : ""
    const chainValue = typeof source.value === "string" ? source.value.trim() : ""
    const url = typeof source.url === "string" ? source.url.trim() : ""
    if (label && chainValue) {
      sourceChain.push(url ? { label, value: chainValue, url } : { label, value: chainValue })
    }
  }

  const status = raw.status === "extracted" || raw.status === "needs-ocr" ? raw.status : "indexed"
  return {
    status,
    brief,
    highlights: textArray(raw.highlights),
    sourceChain,
    researchQuestions: textArray(raw.researchQuestions),
  }
}

export function mediaItemMetadata(item: MediaLibraryItem) {
  return {
    generatedBy: "inverted-world-media-library-v2",
    ...extractionMetadata(item),
  }
}

function extractionMetadata(item: MediaLibraryItem) {
  return item.extraction ? { extraction: item.extraction } : {}
}

const curatedMediaById = new Map(curatedMediaItems.map((item) => [item.id, item]))

function enrichMediaItem(item: MediaLibraryItem): MediaLibraryItem {
  const curated = curatedMediaById.get(item.id)
  if (!curated) return item
  return {
    ...item,
    extraction: item.extraction || curated.extraction,
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

function splitPipeValues(value: string) {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
}

function firstPipeValue(value: string) {
  return splitPipeValues(value)[0] || ""
}

function fieldValues(row: Record<string, string>, keys: string[]) {
  const seen = new Set<string>()
  const values: string[] = []
  for (const key of keys) {
    for (const value of splitPipeValues(field(row, [key]))) {
      if (!seen.has(value)) {
        seen.add(value)
        values.push(value)
      }
    }
  }
  return values
}

function viewerForUrl(url: string, fallback: MediaLibraryItem["viewer"] = "link"): MediaLibraryItem["viewer"] {
  const normalized = url.toLowerCase().split("?")[0]
  if (normalized.endsWith(".pdf")) return "pdf"
  if (/\.(mp4|mov|m4v|webm)$/i.test(normalized)) return "video"
  if (/\.(mp3|wav|m4a|aac|flac|oga|ogg)$/i.test(normalized)) return "audio"
  if (/\.(png|jpe?g|gif|webp)$/i.test(normalized)) return "image"
  return fallback
}

function kindForViewer(viewer: MediaLibraryItem["viewer"]): MediaLibraryItem["kind"] {
  if (viewer === "youtube" || viewer === "video") return "video"
  if (viewer === "pdf") return "document"
  if (viewer === "image") return "image"
  if (viewer === "audio") return "audio"
  return "archive"
}

function normalizedFileType(value: string) {
  const clean = value.trim().toLowerCase()
  if (!clean) return ""
  if (/^(pdf|vid|img|aud)$/.test(clean)) return `.${clean}`
  if (/^\.(pdf|mp4|mov|m4v|webm|mp3|wav|m4a|aac|flac|oga|ogg|png|jpe?g|gif|webp|vid|img|aud)$/.test(clean)) {
    return clean
  }
  return clean
}

function fileTypeForUrl(url: string) {
  const cleanUrl = url.toLowerCase().split("?")[0]
  const match = cleanUrl.match(/\.[a-z0-9]+$/i)
  return match?.[0] || ""
}

function viewerForOfficialRecord(row: Record<string, string>, url: string, fallback: MediaLibraryItem["viewer"] = "link") {
  const fileType = normalizedFileType(field(row, ["filetype", "documenttype", "type"]))
  const documentType = field(row, ["documenttype", "doctype", "kind"]).trim().toLowerCase()
  const firstTypeLetter = documentType[0] || ""

  if (fileType === ".pdf" || firstTypeLetter === "p") return "pdf"
  if (fileType === ".vid" || firstTypeLetter === "v") return "video"
  if (fileType === ".aud" || firstTypeLetter === "a") return "audio"
  if (fileType === ".img" || firstTypeLetter === "i") return "image"
  return viewerForUrl(url, fallback)
}

function displayFileType(row: Record<string, string>, url: string, viewer: MediaLibraryItem["viewer"]) {
  const explicit = field(row, ["filetype", "documenttype", "type"])
  const normalized = normalizedFileType(explicit)
  if (normalized) return normalized.toUpperCase()

  const extension = fileTypeForUrl(url)
  if (extension) return extension.replace(".", "").toUpperCase()
  if (viewer === "pdf") return "PDF"
  if (viewer === "video") return "Video"
  if (viewer === "audio") return "Audio"
  if (viewer === "image") return "Image"
  return "Record"
}

function officialRecordHash(title: string) {
  return title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9\-_]/g, "")
    .replace(/-+/g, "-")
}

function releaseQueryValue(value?: string) {
  if (!value) return ""
  const label = releaseLabel(value)
  if (/release\s*02/i.test(label)) return "Release 02"
  if (/release\s*01|5\/8\/26|05\/08\/26|2026-05-08/i.test(label)) return "Release 01"
  return ""
}

function officialRecordUrl(row: Record<string, string>, viewer: MediaLibraryItem["viewer"]) {
  const title = field(row, ["title", "name", "assetfilename", "filename", "description"])
  const release = releaseQueryValue(field(row, ["releasedate", "release"]))
  const type = normalizedFileType(field(row, ["filetype", "documenttype", "type"]))
  const params = new URLSearchParams()
  if (release) params.set("releaseDate", release)
  if (type) params.set("type", type)
  else if (viewer === "pdf") params.set("type", ".pdf")
  else if (viewer === "video") params.set("type", ".vid")
  else if (viewer === "audio") params.set("type", ".aud")
  else if (viewer === "image") params.set("type", ".img")

  const query = params.toString()
  const hash = officialRecordHash(title)
  return `https://www.war.gov/UFO/${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`
}

function releaseLabel(value?: string) {
  if (!value) return "PURSUE"
  return /release\s*02|5\/22\/26|05\/22\/26|2026-05-22/i.test(value) ? "PURSUE Release 02" : value
}

function officialUapExtraction(row: Record<string, string>, item: MediaLibraryItem): MediaExtraction {
  const incidentDate = field(row, ["incidentdate", "date"])
  const incidentLocation = field(row, ["incidentlocation", "location"])
  const release = releaseLabel(field(row, ["releasedate", "release"]))
  const agency = item.agency || item.source
  const recordUrl = officialRecordUrl(row, item.viewer)
  const facts = [
    incidentDate ? `Incident date: ${incidentDate}.` : "",
    incidentLocation ? `Incident location: ${incidentLocation}.` : "",
    `Release lane: ${release}.`,
    `Agency attribution: ${agency}.`,
  ].filter(Boolean)

  return {
    status: "indexed",
    brief:
      "Official PURSUE record imported from the Department of War UAP release index. Use the original file or record page as the primary source, then compare social claims against the agency, incident date, location, file type, and release metadata.",
    highlights: facts,
    sourceChain: [
      {
        label: "Primary index",
        value: "WAR.GOV/UFO",
        url: "https://www.war.gov/UFO/?releaseDate=Release+02",
      },
      {
        label: "Release",
        value: release,
        url: recordUrl,
      },
      {
        label: item.viewer === "link" ? "Record" : "Source file",
        value: item.title,
        url: item.url,
      },
    ],
    researchQuestions: [
      "Does the file contain enough sensor, date, location, and platform context to support the claim being made?",
      "Which related documents, still frames, audio, or video files describe the same incident?",
      "What does the official record leave unresolved, and what would a skeptical reconstruction require?",
    ],
  }
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

function archiveVideoToMediaItem(video: Awaited<ReturnType<typeof getDeepArchive>>["videos"][number]): MediaLibraryItem {
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
  return enrichMediaItem({
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
    extraction: mediaExtractionFromMetadata(row.metadata),
  })
}

export function dedupeMediaItems(items: MediaLibraryItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.url || item.id
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function findMediaItem(items: MediaLibraryItem[], mediaId: string) {
  const decodedId = decodeURIComponent(mediaId || "")
  return items.find((item) => item.id === decodedId || slugify(item.title) === decodedId || slugify(item.url) === decodedId) || null
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

function officialUapAssetUrls(row: Record<string, string>, viewer: MediaLibraryItem["viewer"]) {
  const commonKeys = ["downloadurl", "downloadlink", "medialink", "mediaurl", "asseturl", "fileurl", "directurl", "directlink", "href", "link", "url"]
  if (viewer === "video") {
    return fieldValues(row, ["videourl", "videolink", "video", "mp4url", "movurl", "assetvideo", ...commonKeys])
  }
  if (viewer === "audio") {
    return fieldValues(row, ["audiourl", "audiolink", "audio", "mp3url", "wavurl", "assetaudio", ...commonKeys])
  }
  if (viewer === "image") {
    return fieldValues(row, ["imageurl", "imagelink", "thumbnailurl", "posterurl", "image", "jpgurl", "jpegurl", "pngurl", "assetimage", ...commonKeys])
  }
  if (viewer === "pdf") {
    return fieldValues(row, ["documenturl", "documentlink", "pdfurl", "pdflink", "document", "assetdocument", ...commonKeys])
  }
  return fieldValues(row, ["documenturl", "videourl", "audiourl", "imageurl", ...commonKeys])
}

function officialUapMediaItemsFromRow(row: Record<string, string>): MediaLibraryItem[] {
  const title = field(row, ["title", "name", "assetfilename", "filename", "description"]) || "PURSUE UAP record"
  const recordViewer = viewerForOfficialRecord(row, "", "link")
  const primaryUrls = officialUapAssetUrls(row, recordViewer)
  const urls = primaryUrls.length ? primaryUrls : [officialRecordUrl(row, recordViewer)]
  const thumbnailUrl =
    recordViewer === "image"
      ? undefined
      : absoluteWarUrl(firstPipeValue(field(row, ["imageurl", "thumbnailurl", "posterurl"]))) || undefined
  const agency = field(row, ["agency", "source"]) || "Department of War"
  const publishedAt = field(row, ["releasedate", "date", "publicationdate"]) || undefined
  const recordUrl = officialRecordUrl(row, recordViewer)

  return urls
    .map((rawUrl, index) => {
      const url = absoluteWarUrl(rawUrl)
      if (!url || !/^https?:\/\//i.test(url)) return null
      const intendedViewer = primaryUrls.length ? viewerForOfficialRecord(row, url, recordViewer) : recordViewer
      const viewer = primaryUrls.length ? intendedViewer : "link"
      const kind = kindForViewer(intendedViewer)
      const total = urls.length
      const titleSuffix = total > 1 ? ` (${index + 1} of ${total})` : ""
      const itemTitle = `${title}${titleSuffix}`
      const topicIds = ["uap-disclosure", "secret-programs", kind === "video" || kind === "image" ? "space-anomalies" : ""].filter(
        (topicId): topicId is string => Boolean(topicId),
      )
      const item: MediaLibraryItem = {
        id: slugify(`war-uap-${title}-${viewer}-${index + 1}-${url}`),
        title: itemTitle,
        source: agency,
        url,
        kind,
        viewer,
        topicIds,
        summary:
          field(row, ["description", "summary", "caption"]) ||
          `Official PURSUE ${kind} record pulled from the Department of War UAP release index.`,
        publishedAt,
        thumbnailUrl,
        fileType: displayFileType(row, url, intendedViewer),
        agency,
        collection: releaseLabel(field(row, ["release", "releasedate"])),
      }
      const extraction = officialUapExtraction(row, item)
      item.extraction = {
        ...extraction,
        sourceChain: [
          ...extraction.sourceChain,
          ...(recordUrl !== item.url
            ? [
                {
                  label: "Record page",
                  value: "WAR.GOV detail",
                  url: recordUrl,
                },
              ]
            : []),
        ],
      }
      return item
    })
    .filter((item): item is MediaLibraryItem => item !== null)
}

export async function fetchOfficialUapReleaseMedia(limit = 500): Promise<MediaLibraryItem[]> {
  try {
    const responses = await Promise.all(
      WAR_UAP_CSV_URLS.map((url) =>
        fetch(url, {
          headers: {
            referer: "https://www.war.gov/UFO/",
            "user-agent": "InvertedWorldMediaLibrary/1.0",
          },
          signal: AbortSignal.timeout(8000),
        }).catch(() => null),
      ),
    )
    const response = responses.find((item): item is Response => Boolean(item?.ok))
    if (!response) return []
    const text = await response.text()
    if (/^\s*</.test(text)) return []
    const rows = parseCsv(text)
    return dedupeMediaItems(rows.flatMap(officialUapMediaItemsFromRow))
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
      items: dedupeMediaItems([...rows.map(rowToMediaItem), ...curatedMediaItems, ...officialUapItems]),
    }
  }

  const snapshotItems = snapshotMediaLibraryItems()
  if (snapshotItems.length) {
    return {
      sourceMode: "recursiv-snapshot",
      items: dedupeMediaItems([...snapshotItems, ...curatedMediaItems, ...officialUapItems]),
    }
  }

  return {
    sourceMode: "static",
    items: staticMediaLibraryItems(officialUapItems),
  }
}

export async function fetchExpandedMediaLibrary(options: { archiveLimit?: number } = {}): Promise<ExpandedMediaLibraryResult> {
  const archiveLimit = Math.max(0, Math.min(Math.trunc(options.archiveLimit || 96), 500))
  const [library, archive] = await Promise.all([
    fetchMediaLibrary(),
    archiveLimit > 0 ? getDeepArchive({ limit: archiveLimit, maxLimit: 1000 }).catch(() => null) : Promise.resolve(null),
  ])
  const archiveItems = archive?.videos.map(archiveVideoToMediaItem) || []

  return {
    sourceMode: library.sourceMode,
    archiveSourceMode: archive?.sourceMode,
    items: dedupeMediaItems([...library.items, ...archiveItems]),
  }
}

export async function fetchMediaLibraryItem(mediaId: string, options: { relatedLimit?: number } = {}) {
  const relatedLimit = Math.max(1, Math.min(Math.trunc(options.relatedLimit || 8), 16))
  const library = await fetchExpandedMediaLibrary({ archiveLimit: 160 })
  const item = findMediaItem(library.items, mediaId)
  if (!item) return null

  const topicIds = new Set(item.topicIds)
  const related = library.items
    .filter((candidate) => candidate.id !== item.id && candidate.topicIds.some((topicId) => topicIds.has(topicId)))
    .slice(0, relatedLimit)

  return {
    sourceMode: library.sourceMode,
    archiveSourceMode: library.archiveSourceMode,
    item,
    related,
  }
}
