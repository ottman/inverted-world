# Inverted World Content System

## Goal

Build `inverted.world` into a Recursiv-backed research and AI news product for Tales From the Inverted World.

The product should ingest channel content, compare topic coverage across news outlets, anchor claims in government documents and open-source data, and generate media-ready outputs without pretending uncertain claims are proven.

## Editorial Posture

- Curious and anomaly-friendly.
- Primary-source first.
- Skeptical and weird interpretations shown side by side.
- Allegations, official records, witness reports, analysis, and speculation must stay visibly separate.
- Missing documents and unexplained gaps are first-class research objects.

## Recursiv Capabilities

- Auth: saved research rooms, watchlists, and media projects.
- Database: channel archive, claims, source graph, coverage snapshots, and FOIA tracker.
- Storage: downloaded documents, clips, transcripts, generated images, and article drafts.
- Agents: research assistant, news brief generator, claim ledger builder, media packet builder.
- Notifications/email: topic alerts and daily brief distribution.

Server-side Recursiv calls use `RECURSIV_SERVER_API_KEY`. Local proof may use a protected key file, but production secrets belong in Recursiv/Infisical.

## Data Lanes

- Channel archive: Tales From The Inverted World YouTube handle and uploads feed.
- News coverage: Exa AI search first when `EXA_API_KEY` or `EXA_SEARCH_API_KEY` is configured, then Google News RSS fallback, with GDELT/global article search as the next expansion lane.
- Official records: Federal Register, AARO, NASA, NOAA, FBI Vault, CIA Reading Room.
- Legal records: CourtListener and direct court dockets where available.
- Science/open data: NASA NTRS, NOAA SWPC, arXiv/Crossref where relevant.
- X/Grok pulse: X API for live narrative movement, Grok for X-native synthesis and memetic framing.

## Live Routes

- `/archive`: embedded channel archive. Reads Recursiv `channel_items` first, then falls back to YouTube RSS/API.
- `/news`: Drudge-style source board backed by Recursiv `coverage_snapshots` with `source = 'worldwire'`, published `article_drafts`, and published `claim_dossiers`. The worldwire lanes cover a regular front page plus world, war, U.S. politics, power/files, money, tech/AI, science/space, health/earth, crime/culture, and strange-records coverage. The public page links directly to source URLs and does not call Exa, Brave, or RSS providers during render.
- `/news/[slug]`: source split, evidence grade, X velocity, Tales archive context, viral headlines, and AI chat for one dossier.
- `/documents`: browsable source database backed by `/api/documents`.
- `/media`: watch/read media library for Tales clips, official UAP releases, primary-source PDFs, videos, audio, images, archive hubs, source briefs, and research questions.
- `/media/[mediaId]`: shareable media detail pages with inline video/PDF/image rendering and related media.
- `/api/media`: machine-readable media library.
- `/api/media/[mediaId]`: machine-readable media item, source-chain brief, and related media.
- `/api/dossiers`: JSON feed of published claim dossiers.
- `/api/dossiers/[slug]/chat`: Recursiv-agent chat over one dossier context.
- `/api/recursiv/jobs/*`: authenticated scheduled job targets for archive sync, topic pulse, worldwire crawling, article generation, claim dossier generation, image generation, publishing, front-page editions, bounded pipeline refresh, and pipeline maintenance. Add `?async=1` for Recursiv cron triggers; omit it for manual proof runs that should wait for the full result.

The worldwire job keeps persisted rows compact: each stored item keeps the source URL, source label, score, title, section, and timestamp, while long excerpts are dropped before database write. The `items` and `metadata` JSONB payloads are embedded as safely dollar-quoted SQL literals instead of oversized Recursiv `params` entries, because the Recursiv API validates request bodies before PostgreSQL sees the query. Keep scalar params small for scheduled jobs.

If only scheduled job endpoints need repair, run:

```bash
pnpm recursiv:provision -- --jobs-only
```

That path skips database/schema/storage setup and updates the Recursiv cron jobs only. Use it after a deployment when the schema is already established or when the full provision path is blocked by database API rate limits.

## First Tables

```sql
CREATE TABLE channel_items (
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
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coverage_snapshots (
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
);

CREATE TABLE x_signals (
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
);

CREATE TABLE article_drafts (
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
  generated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE generated_assets (
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
);

CREATE TABLE claim_dossiers (
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
);

CREATE TABLE claim_sources (
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
);

CREATE TABLE claim_chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dossier_slug TEXT NOT NULL,
  conversation_id TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  message TEXT NOT NULL,
  response TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Sync Command

```bash
npm run recursiv:provision
npm run recursiv:sync
npm run recursiv:snapshot
```

`recursiv:provision` creates the Recursiv database, schema, storage bucket, and agent access. `recursiv:sync` writes `data/generated/channel-archive.json` and upserts the current public YouTube archive into `channel_items`.

`recursiv:provision -- --with-jobs` is the desired-state scheduled-job manifest. It points Recursiv cron at the hosted job endpoints with `async=1` so long ingestion tasks acknowledge quickly and do not leave scheduler `last_error` noise while the app continues work. Direct operator proof should call the same endpoint without `async=1` when the full JSON result is needed.

`recursiv:snapshot` exports persisted Recursiv rows into the committed public fallbacks `data/generated/recursiv-news-snapshot.json` and `data/generated/recursiv-public-snapshot.json`. It is for local/proof refreshes when the hosted runtime database key is unhealthy or rate-limited. The command reads a direct database URL from `RECURSIV_DATABASE_URL`, `RECURSIV_DATABASE_URL_FILE`, or the protected local file `/private/tmp/inverted-world-database-url`; it passes the password to `psql` through environment variables and prints only redacted counts.

Run `npm run recursiv:snapshot -- --dry-run` to validate the export path and row counts without rewriting the committed snapshots.

The public snapshot feeds the archive, worldwire/news desk, X velocity, front-page edition, media library, and source document shelf. It is Recursiv-backed persisted data, but it is still a fallback: production is fully healthy only when hosted reads return `sourceMode: "recursiv-database"`.

The media-library importer reads the WAR.GOV PURSUE CSV manifest when available, splits each official row into direct PDF/video/audio/image media entries, preserves record-page anchors, and writes source briefs into Recursiv `media_items.metadata.extraction`. Curated static records stay in the library as a fallback when the government CSV is temporarily blocked or unavailable.

`recursiv:backfill:x` is a local/proof ingestion path for widening stored X coverage without exposing provider keys to public requests. It reads the protected local provider env file when present, filters X results through topic terms and trusted source accounts, and upserts only normalized rows into Recursiv `x_signals`. By default it only replaces previous local-backfill rows after the new fetch has accepted rows; pass `--keep-existing` to append/refresh without clearing previous local-backfill rows.

When X API credits are blocked, run the profile-reader lane first as a dry run:

```bash
pnpm recursiv:backfill:x -- --provider=profile --limit=8 --dry-run
```

If the accepted counts look useful, rerun with `--keep-existing` to bulk upsert the accepted rows. The script also accepts `--topic=uap-disclosure,secret-programs` for smaller proof runs. By default it writes through the Recursiv API unless a protected direct database URL is available; pass `--write=recursiv-api` or `--write=direct-db` to force either path. The direct database path follows the snapshot exporter convention and reads `RECURSIV_DATABASE_URL`, `RECURSIV_DATABASE_URL_FILE`, or `/private/tmp/inverted-world-database-url`, then passes credentials to `psql` through environment variables rather than command arguments.

If Recursiv returns an API-key per-hour rate limit and no direct database URL is available, do not rotate or paste keys into the repo; wait for the limit window or run the hosted topic-pulse job once the server-side key budget is healthy.

`recursiv:deploy` and `recursiv:deploy:status` record a local cooldown in `/private/tmp/inverted-world-recursiv-api-cooldown.json` after a Recursiv API `429`, then refuse further deploy/status calls until the window is likely clear. Use `node scripts/deploy-recursiv.mjs --clear-cooldown` only when the window has likely cleared, or `--ignore-cooldown` for a deliberate one-shot override. `recursiv:deploy:dry-run` prints the intended non-secret payload without calling Recursiv. `recursiv:deploy:custom-domain` redeploys production with `custom_domain=www.inverted.world` to create the pre-DNS custom-domain binding; it must be followed by `recursiv:cutover` proof before any DNS record is changed.

The scheduled topic-pulse manifest and the scheduled full-pipeline manifest enable `profileReader=1` so Recursiv can keep collecting priority-account X signals through the public profile-reader lane while paid X API credits are blocked. Paid X API access is still the full-fidelity provider for metric-aware velocity.

`recursiv:health` prints a non-secret provider health report for local proof. The authenticated hosted job `/api/recursiv/jobs/provider-health` runs the same class of checks inside the Recursiv-hosted app and persists the redacted result into `pipeline_runs` under `job_name = 'provider-health'`. It reports whether provider paths are missing, live, or errored without returning API keys or secret values.
