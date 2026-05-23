import fs from "node:fs"
import { Recursiv } from "@recursiv/sdk"

const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_DATABASE_NAME = "inverted_world_research"
const DEFAULT_BUCKET_NAME = "inverted-world-generated-assets"
const DEFAULT_SITE_URL = "https://invertedworld.on.recursiv.io"

const SCHEMA_SQL = [
  "CREATE EXTENSION IF NOT EXISTS pgcrypto",
  `CREATE TABLE IF NOT EXISTS channel_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source TEXT NOT NULL,
    source_id TEXT,
    source_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    published_at TIMESTAMPTZ,
    topic_id TEXT,
    transcript TEXT,
    thumbnail_url TEXT,
    embed_url TEXT,
    kind TEXT DEFAULT 'episode',
    metadata JSONB DEFAULT '{}'::jsonb,
    sync_status TEXT DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS channel_items_topic_published_idx ON channel_items (topic_id, published_at DESC)",
  "CREATE INDEX IF NOT EXISTS channel_items_source_id_idx ON channel_items (source, source_id)",
  `CREATE TABLE IF NOT EXISTS coverage_snapshots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    topic_id TEXT NOT NULL,
    query TEXT NOT NULL,
    source TEXT NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT now(),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    official_records JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    velocity_score NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS coverage_snapshots_topic_captured_idx ON coverage_snapshots (topic_id, captured_at DESC)",
  `CREATE TABLE IF NOT EXISTS x_signals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    topic_id TEXT NOT NULL,
    x_id TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    username TEXT,
    author_name TEXT,
    text TEXT NOT NULL,
    posted_at TIMESTAMPTZ,
    captured_at TIMESTAMPTZ DEFAULT now(),
    source TEXT DEFAULT 'x-api',
    score NUMERIC DEFAULT 0,
    metrics JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS x_signals_topic_score_idx ON x_signals (topic_id, score DESC, posted_at DESC)",
  `CREATE TABLE IF NOT EXISTS generated_assets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    asset_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    provider TEXT,
    bucket_name TEXT,
    object_key TEXT,
    url TEXT,
    status TEXT DEFAULT 'generated',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS generated_assets_type_created_idx ON generated_assets (asset_type, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS article_drafts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    deck TEXT,
    topic_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    body JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_ids JSONB DEFAULT '[]'::jsonb,
    source_name TEXT,
    source_url TEXT,
    heat INTEGER DEFAULT 0,
    thumbnail_asset_id TEXT,
    thumbnail_prompt TEXT,
    model TEXT,
    prompt_version TEXT,
    generated_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS article_drafts_status_published_idx ON article_drafts (status, published_at DESC)",
  "CREATE INDEX IF NOT EXISTS article_drafts_topic_status_idx ON article_drafts (topic_id, status, published_at DESC)",
  `CREATE TABLE IF NOT EXISTS claim_dossiers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    deck TEXT,
    topic_id TEXT NOT NULL,
    claim TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    evidence_grade TEXT NOT NULL DEFAULT 'developing',
    confidence_score NUMERIC DEFAULT 0,
    x_velocity_score NUMERIC DEFAULT 0,
    source_count INTEGER DEFAULT 0,
    x_signal_count INTEGER DEFAULT 0,
    related_video_count INTEGER DEFAULT 0,
    source_links JSONB DEFAULT '[]'::jsonb,
    x_signals JSONB DEFAULT '[]'::jsonb,
    related_videos JSONB DEFAULT '[]'::jsonb,
    weird_read TEXT,
    skeptical_read TEXT,
    viral_headlines JSONB DEFAULT '[]'::jsonb,
    chat_prompt TEXT,
    generated_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS claim_dossiers_status_published_idx ON claim_dossiers (status, published_at DESC)",
  "CREATE INDEX IF NOT EXISTS claim_dossiers_topic_velocity_idx ON claim_dossiers (topic_id, x_velocity_score DESC, updated_at DESC)",
  `CREATE TABLE IF NOT EXISTS claim_sources (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    dossier_id TEXT NOT NULL REFERENCES claim_dossiers(id) ON DELETE CASCADE,
    source_kind TEXT NOT NULL DEFAULT 'news',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    outlet TEXT,
    stance TEXT,
    bias_lane TEXT,
    published_at TIMESTAMPTZ,
    credibility_score NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS claim_sources_dossier_url_unique ON claim_sources (dossier_id, url)",
  "CREATE INDEX IF NOT EXISTS claim_sources_dossier_kind_idx ON claim_sources (dossier_id, source_kind, bias_lane)",
  `CREATE TABLE IF NOT EXISTS source_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    url TEXT NOT NULL,
    host TEXT,
    kind TEXT NOT NULL,
    topic_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "ALTER TABLE IF EXISTS source_documents ADD COLUMN IF NOT EXISTS slug TEXT",
  "ALTER TABLE IF EXISTS source_documents ADD COLUMN IF NOT EXISTS host TEXT",
  "ALTER TABLE IF EXISTS source_documents ADD COLUMN IF NOT EXISTS topic_id TEXT",
  "ALTER TABLE IF EXISTS source_documents ADD COLUMN IF NOT EXISTS topic_ids JSONB DEFAULT '[]'::jsonb",
  "ALTER TABLE IF EXISTS source_documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
  "ALTER TABLE IF EXISTS source_documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
  "ALTER TABLE IF EXISTS source_documents ALTER COLUMN id SET DEFAULT gen_random_uuid()::text",
  `UPDATE source_documents
    SET slug = trim(both '-' from regexp_replace(lower(coalesce(source, 'source') || ' ' || coalesce(title, url, id)), '[^a-z0-9]+', '-', 'g'))
    WHERE slug IS NULL OR slug = ''`,
  `UPDATE source_documents
    SET topic_ids = CASE
      WHEN topic_ids IS NULL OR topic_ids = '[]'::jsonb THEN jsonb_build_array(topic_id)
      ELSE topic_ids
    END
    WHERE topic_id IS NOT NULL`,
  "UPDATE source_documents SET status = COALESCE(NULLIF(status, ''), 'active')",
  "CREATE UNIQUE INDEX IF NOT EXISTS source_documents_slug_unique ON source_documents (slug)",
  "CREATE INDEX IF NOT EXISTS source_documents_status_kind_idx ON source_documents (status, kind)",
  `CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    kind TEXT NOT NULL,
    viewer TEXT NOT NULL DEFAULT 'link',
    topic_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT,
    published_at TIMESTAMPTZ,
    embed_url TEXT,
    thumbnail_url TEXT,
    file_type TEXT,
    agency TEXT,
    collection TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS slug TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS title TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS source TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS source_url TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS kind TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS viewer TEXT DEFAULT 'link'",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS topic_ids JSONB DEFAULT '[]'::jsonb",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS summary TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS embed_url TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS file_type TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS agency TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS collection TEXT",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()",
  "ALTER TABLE IF EXISTS media_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()",
  "ALTER TABLE IF EXISTS media_items ALTER COLUMN id SET DEFAULT gen_random_uuid()::text",
  `UPDATE media_items
    SET slug = trim(both '-' from regexp_replace(lower(coalesce(source, 'source') || ' ' || coalesce(title, source_url, id)), '[^a-z0-9]+', '-', 'g'))
    WHERE slug IS NULL OR slug = ''`,
  "UPDATE media_items SET viewer = COALESCE(NULLIF(viewer, ''), 'link')",
  "UPDATE media_items SET topic_ids = COALESCE(topic_ids, '[]'::jsonb)",
  "UPDATE media_items SET status = COALESCE(NULLIF(status, ''), 'active')",
  "CREATE UNIQUE INDEX IF NOT EXISTS media_items_slug_unique ON media_items (slug)",
  "CREATE INDEX IF NOT EXISTS media_items_source_url_idx ON media_items (source_url)",
  "CREATE INDEX IF NOT EXISTS media_items_status_kind_idx ON media_items (status, kind, published_at DESC)",
  "CREATE INDEX IF NOT EXISTS media_items_topic_ids_gin_idx ON media_items USING GIN (topic_ids)",
  `CREATE TABLE IF NOT EXISTS claim_chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    dossier_slug TEXT NOT NULL,
    conversation_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    message TEXT NOT NULL,
    response TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS claim_chat_messages_dossier_created_idx ON claim_chat_messages (dossier_slug, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS front_page_editions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug TEXT NOT NULL UNIQUE,
    edition_date DATE NOT NULL UNIQUE,
    headline TEXT NOT NULL,
    deck TEXT,
    status TEXT NOT NULL DEFAULT 'published',
    lead_dossier_slug TEXT,
    sections JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS front_page_editions_status_date_idx ON front_page_editions (status, edition_date DESC)",
  `CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER DEFAULT 0,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS pipeline_runs_job_started_idx ON pipeline_runs (job_name, started_at DESC)",
  "CREATE INDEX IF NOT EXISTS pipeline_runs_status_started_idx ON pipeline_runs (status, started_at DESC)",
]

const JOBS = [
  {
    name: "inverted-world-youtube-archive-sync",
    cron: "*/30 * * * *",
    endpoint: "/api/recursiv/jobs/youtube-archive-sync?async=1",
  },
  {
    name: "inverted-world-topic-pulse",
    cron: "*/20 * * * *",
    endpoint: "/api/recursiv/jobs/topic-pulse?limit=24&profileReader=1&async=1",
  },
  {
    name: "inverted-world-worldwire",
    cron: "*/10 * * * *",
    endpoint: "/api/recursiv/jobs/worldwire?limitPerLane=12&async=1",
  },
  {
    name: "inverted-world-article-generation",
    cron: "5 * * * *",
    endpoint: "/api/recursiv/jobs/article-generation?limit=2&useAgent=0&async=1",
  },
  {
    name: "inverted-world-claim-dossiers",
    cron: "10 * * * *",
    endpoint: "/api/recursiv/jobs/claim-dossiers?async=1",
  },
  {
    name: "inverted-world-source-documents",
    cron: "12 * * * *",
    endpoint: "/api/recursiv/jobs/source-documents?async=1",
  },
  {
    name: "inverted-world-media-library",
    cron: "14 * * * *",
    endpoint: "/api/recursiv/jobs/media-library?async=1",
  },
  {
    name: "inverted-world-image-generation",
    cron: "15 * * * *",
    endpoint: "/api/recursiv/jobs/image-generation?async=1",
  },
  {
    name: "inverted-world-publishing",
    cron: "25 * * * *",
    endpoint: "/api/recursiv/jobs/publishing?async=1",
  },
  {
    name: "inverted-world-front-page-edition",
    cron: "30 * * * *",
    endpoint: "/api/recursiv/jobs/front-page-edition?async=1",
  },
  {
    name: "inverted-world-full-pipeline",
    cron: "2 * * * *",
    endpoint: "/api/recursiv/jobs/full-pipeline?mode=scheduled&staleAfterMinutes=30&async=1",
  },
  {
    name: "inverted-world-pipeline-maintenance",
    cron: "*/15 * * * *",
    endpoint: "/api/recursiv/jobs/pipeline-maintenance?async=1",
  },
  {
    name: "inverted-world-provider-health",
    cron: "0 */6 * * *",
    endpoint: "/api/recursiv/jobs/provider-health?async=1",
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
    if (process.env[key] || !value) continue
    process.env[key] = value
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function readApiKeyFromFile() {
  const candidates = [process.env.RECURSIV_API_KEY_FILE, "/private/tmp/inverted-world-recursiv-key"].filter(Boolean)
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim()
  }
  return undefined
}

function jobHandlerCode(endpoint) {
  return `async () => {
  const baseUrl = process.env.INVERTED_WORLD_SITE_URL || "${DEFAULT_SITE_URL}";
  const secret = process.env.CRON_SECRET || "";
  const response = await fetch(new URL("${endpoint}", baseUrl), {
    method: "POST",
    headers: secret ? { authorization: \`Bearer \${secret}\` } : {},
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(\`${endpoint} returned \${response.status}: \${text.slice(0, 500)}\`);
  }
  return response.json();
}`
}

async function ensureJob(sdk, existingJobs, projectId, job) {
  const existing = existingJobs.find((item) => item.name === job.name)
  const input = {
    name: job.name,
    cron: job.cron,
    project_id: projectId,
    timezone: "America/New_York",
    handler_code: jobHandlerCode(job.endpoint),
  }

  if (existing) {
    const { data } = await sdk.jobs.update(existing.id, input)
    return { action: "updated", id: data.id, name: data.name, cron: data.cron, status: data.status }
  }

  const { data } = await sdk.jobs.create(input)
  return { action: "created", id: data.id, name: data.name, cron: data.cron, status: data.status }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const withJobs = process.argv.includes("--with-jobs")
  const withAgent = process.argv.includes("--with-agent")
  const baseUrl = process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL
  const apiKey =
    readApiKeyFromFile() ||
    process.env.RECURSIV_SERVER_API_KEY ||
    process.env.RECURSIV_API_KEY ||
    process.env.SOCIAL_DEV_API_KEY
  const projectId = requireEnv("RECURSIV_PROJECT_ID")
  const organizationId = process.env.RECURSIV_ORG_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  const bucketName = process.env.RECURSIV_ASSETS_BUCKET || DEFAULT_BUCKET_NAME

  if (!apiKey) throw new Error("Missing RECURSIV_SERVER_API_KEY or RECURSIV_API_KEY")

  const sdk = new Recursiv({ apiKey, baseUrl, timeout: 120000, maxRetries: 2 })

  const { data: project } = await sdk.projects.get(projectId)
  console.log(`Project: ${project.name || projectId} (${project.id || projectId})`)

  await sdk.databases.ensure({ project_id: projectId, name: databaseName })
  for (const sql of SCHEMA_SQL) {
    await sdk.databases.query({ project_id: projectId, database_name: databaseName, sql })
  }
  console.log(`Database ready: ${databaseName} (${SCHEMA_SQL.length} schema statements)`)

  await sdk.storage.ensureBucket({ project_id: projectId, name: bucketName })
  console.log(`Storage bucket ready: ${bucketName}`)

  if (withAgent) {
    if (!organizationId) throw new Error("RECURSIV_ORG_ID is required for --with-agent")
    if (process.env.RECURSIV_AGENT_ID) {
      const { data: agent } = await sdk.agents.get(process.env.RECURSIV_AGENT_ID)
      console.log(`Agent found: ${agent.name} (${agent.id})`)
    } else {
      const { data: agent } = await sdk.agents.create({
        name: "Inverted World Research Desk",
        username: `inverted_world_research_${Date.now()}`,
        model: process.env.OPENROUTER_MODEL || process.env.ANTHROPIC_MODEL || "anthropic/claude-sonnet-4",
        organization_id: organizationId,
        system_prompt:
          "You are the Inverted World research desk. Generate sourced, skeptical, anomaly-friendly briefs. Separate documented fact, allegation, inference, speculation, and unknowns. Never invent citations.",
      })
      await sdk.agents.grantProjectAccess(agent.id, {
        project_id: projectId,
        permissions: ["execute_code", "read_files", "write_files"],
      })
      console.log(`Agent created: ${agent.name} (${agent.id})`)
    }
  }

  if (withJobs) {
    const { data: existingJobs } = await sdk.jobs.list()
    const results = []
    for (const job of JOBS) {
      try {
        results.push(await ensureJob(sdk, existingJobs, projectId, job))
      } catch (error) {
        results.push({
          action: "failed",
          name: job.name,
          cron: job.cron,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    console.log(JSON.stringify({ jobs: results }, null, 2))
    if (results.some((result) => result.action === "failed")) process.exitCode = 1
  } else {
    console.log("Skipped jobs. Re-run with --with-jobs after the hosted job endpoints are live.")
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(
      JSON.stringify({
        message: error.message,
        name: error.name,
        cause: error.cause
          ? {
              code: error.cause.code,
              host: error.cause.hostname,
              message: error.cause.message,
            }
          : undefined,
      }),
    )
  } else {
    console.error(String(error))
  }
  process.exit(1)
})
