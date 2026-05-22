import { spawn } from "node:child_process"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"

const NEWS_SNAPSHOT_FILE = path.resolve("data/generated/recursiv-news-snapshot.json")
const PUBLIC_SNAPSHOT_FILE = path.resolve("data/generated/recursiv-public-snapshot.json")
const DEFAULT_DATABASE_URL_FILE = "/private/tmp/inverted-world-database-url"

const NEWS_EXPORTS = [
  {
    key: "channelItems",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.published_at DESC NULLS LAST, export_row.created_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          source,
          source_id,
          source_url,
          title,
          description,
          published_at,
          topic_id,
          thumbnail_url,
          embed_url,
          kind,
          metadata,
          created_at,
          updated_at
        FROM channel_items
        WHERE source = 'youtube'
      ) export_row`,
  },
  {
    key: "xSignals",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.score DESC NULLS LAST, export_row.posted_at DESC NULLS LAST, export_row.captured_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          x_id,
          url,
          text,
          topic_id,
          author_name,
          username,
          posted_at,
          captured_at,
          source,
          score,
          metrics,
          metadata
        FROM x_signals
      ) export_row`,
  },
  {
    key: "articleDrafts",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.published_at DESC NULLS LAST, export_row.generated_at DESC NULLS LAST, export_row.created_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          a.id,
          a.slug,
          a.title,
          a.deck,
          a.topic_id,
          a.status,
          a.body,
          a.source_ids,
          a.source_name,
          a.source_url,
          a.heat,
          a.thumbnail_asset_id,
          a.thumbnail_prompt,
          ga.url AS asset_url,
          a.model,
          a.prompt_version,
          a.generated_at,
          a.published_at,
          a.metadata,
          a.created_at,
          a.updated_at
        FROM article_drafts a
        LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
        WHERE a.status = 'published'
      ) export_row`,
  },
  {
    key: "claimDossiers",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.x_velocity_score DESC NULLS LAST, export_row.published_at DESC NULLS LAST, export_row.updated_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          slug,
          title,
          deck,
          topic_id,
          claim,
          summary,
          status,
          evidence_grade,
          confidence_score,
          x_velocity_score,
          source_count,
          x_signal_count,
          related_video_count,
          source_links,
          x_signals,
          related_videos,
          weird_read,
          skeptical_read,
          viral_headlines,
          chat_prompt,
          generated_at,
          published_at,
          metadata,
          created_at,
          updated_at
        FROM claim_dossiers
        WHERE status = 'published'
      ) export_row`,
  },
  {
    key: "frontPageEditions",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.edition_date DESC, export_row.published_at DESC NULLS LAST, export_row.generated_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          slug,
          edition_date,
          headline,
          deck,
          status,
          lead_dossier_slug,
          sections,
          metrics,
          generated_at,
          published_at,
          metadata,
          created_at,
          updated_at
        FROM front_page_editions
        WHERE status = 'published'
      ) export_row`,
  },
  {
    key: "pipelineRuns",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.started_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          job_name,
          status,
          started_at,
          completed_at,
          duration_ms,
          results,
          error,
          metadata,
          created_at,
          updated_at
        FROM pipeline_runs
        ORDER BY started_at DESC
        LIMIT 100
      ) export_row`,
  },
  {
    key: "coverageSnapshots",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.captured_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          topic_id,
          query,
          source,
          captured_at,
          items,
          official_records,
          summary,
          velocity_score,
          metadata,
          created_at
        FROM coverage_snapshots
        ORDER BY captured_at DESC
        LIMIT 500
      ) export_row`,
  },
]

const PUBLIC_EXPORTS = [
  {
    key: "mediaItems",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.published_at DESC NULLS LAST, export_row.updated_at DESC NULLS LAST, export_row.title), '[]'::jsonb)::text
      FROM (
        SELECT
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
          metadata,
          created_at,
          updated_at
        FROM media_items
        WHERE status = 'active'
      ) export_row`,
  },
  {
    key: "sourceDocuments",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.kind, export_row.title), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          slug,
          title,
          source,
          url,
          host,
          kind,
          topic_ids,
          status,
          metadata,
          created_at,
          updated_at
        FROM source_documents
        WHERE status = 'active'
      ) export_row`,
  },
]

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const value = rawValue.replace(/^["']|["']$/g, "")
    if (!process.env[key] && value) process.env[key] = value
  }
}

function readOptionalFile(file) {
  if (!file || !fs.existsSync(file)) return ""
  return fs.readFileSync(file, "utf8").trim()
}

function readDatabaseUrl() {
  const explicitEnvCandidates = [
    ["RECURSIV_DATABASE_URL", process.env.RECURSIV_DATABASE_URL],
    ["RECURSIV_DIRECT_DATABASE_URL", process.env.RECURSIV_DIRECT_DATABASE_URL],
    ["INVERTED_WORLD_DATABASE_URL", process.env.INVERTED_WORLD_DATABASE_URL],
  ]
  for (const [source, value] of explicitEnvCandidates) {
    if (value) return { value, source }
  }

  const fileCandidates = [
    ["RECURSIV_DATABASE_URL_FILE", process.env.RECURSIV_DATABASE_URL_FILE],
    ["DATABASE_URL_FILE", process.env.DATABASE_URL_FILE],
    ["default database URL file", DEFAULT_DATABASE_URL_FILE],
  ]
  for (const [source, file] of fileCandidates) {
    const value = readOptionalFile(file)
    if (value) return { value, source }
  }

  const genericEnvCandidates = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["RECURSIV_POSTGRES_URL", process.env.RECURSIV_POSTGRES_URL],
  ]
  for (const [source, value] of genericEnvCandidates) {
    if (value) return { value, source }
  }

  throw new Error(
    `Missing Recursiv database URL. Set RECURSIV_DATABASE_URL, RECURSIV_DATABASE_URL_FILE, or write the URL to ${DEFAULT_DATABASE_URL_FILE}.`,
  )
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function databaseConnectionEnv(databaseUrl) {
  const parsed = new URL(databaseUrl)
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Recursiv database URL must use postgres:// or postgresql://")
  }

  const host = parsed.hostname
  const localHost = host === "localhost" || host === "127.0.0.1" || host === "::1"
  const sslMode = process.env.RECURSIV_DATABASE_SSLMODE || parsed.searchParams.get("sslmode") || (localHost ? "" : "require")

  const env = {
    ...process.env,
    PGHOST: host,
    PGPORT: parsed.port || "5432",
    PGDATABASE: safeDecode(parsed.pathname.replace(/^\//, "")),
    PGUSER: safeDecode(parsed.username),
    PGPASSWORD: safeDecode(parsed.password),
  }
  if (sslMode) env.PGSSLMODE = sslMode
  return env
}

function redact(value, databaseUrl) {
  let text = String(value || "")
  if (!databaseUrl) return text
  text = text.replaceAll(databaseUrl, "[redacted-database-url]")
  try {
    const parsed = new URL(databaseUrl)
    const password = safeDecode(parsed.password)
    const encodedPassword = parsed.password
    if (password) text = text.replaceAll(password, "[redacted]")
    if (encodedPassword) text = text.replaceAll(encodedPassword, "[redacted]")
  } catch {
    // Ignore malformed URLs here; the parser error is reported elsewhere.
  }
  return text
}

function runPsql(sql, databaseUrl) {
  const env = databaseConnectionEnv(databaseUrl)
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error("psql is required to export Recursiv snapshots. Install PostgreSQL client tools first."))
        return
      }
      reject(error)
    })
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }
      const detail = redact(stderr || stdout || `psql exited with ${code}`, databaseUrl)
      reject(new Error(detail.slice(0, 1200)))
    })
  })
}

async function exportRows(exportSpec, databaseUrl) {
  const raw = await runPsql(exportSpec.sql, databaseUrl)
  const parsed = JSON.parse(raw || "[]")
  if (!Array.isArray(parsed)) throw new Error(`${exportSpec.key} export returned a non-array payload`)
  return parsed
}

async function exportSnapshot(exportSpecs, databaseUrl) {
  const snapshot = {
    source: "recursiv-database-direct-export",
    generatedAt: new Date().toISOString(),
    exportedBy: "scripts/export-recursiv-snapshots.mjs",
  }

  for (const exportSpec of exportSpecs) {
    snapshot[exportSpec.key] = await exportRows(exportSpec, databaseUrl)
  }

  return snapshot
}

async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

function snapshotCounts(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length]),
  )
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const flags = new Set(process.argv.slice(2))
  const exportNews = !flags.has("--public-only")
  const exportPublic = !flags.has("--news-only")
  const dryRun = flags.has("--dry-run")
  if (!exportNews && !exportPublic) throw new Error("Nothing to export. Remove one of --news-only or --public-only.")

  const databaseUrl = readDatabaseUrl()
  const result = {
    dryRun,
    databaseUrlSource: databaseUrl.source,
    written: [],
    wouldWrite: [],
    counts: {},
  }

  if (exportNews) {
    const snapshot = await exportSnapshot(NEWS_EXPORTS, databaseUrl.value)
    if (dryRun) {
      result.wouldWrite.push(NEWS_SNAPSHOT_FILE)
    } else {
      await writeJson(NEWS_SNAPSHOT_FILE, snapshot)
      result.written.push(NEWS_SNAPSHOT_FILE)
    }
    result.counts.news = snapshotCounts(snapshot)
  }

  if (exportPublic) {
    const snapshot = await exportSnapshot(PUBLIC_EXPORTS, databaseUrl.value)
    if (dryRun) {
      result.wouldWrite.push(PUBLIC_SNAPSHOT_FILE)
    } else {
      await writeJson(PUBLIC_SNAPSHOT_FILE, snapshot)
      result.written.push(PUBLIC_SNAPSHOT_FILE)
    }
    result.counts.public = snapshotCounts(snapshot)
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
