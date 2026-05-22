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
- `/news`: claim-dossier desk backed by published Recursiv `claim_dossiers`.
- `/news/[slug]`: source split, evidence grade, X velocity, Tales archive context, viral headlines, and AI chat for one dossier.
- `/documents`: browsable source database backed by `/api/documents`.
- `/api/dossiers`: JSON feed of published claim dossiers.
- `/api/dossiers/[slug]/chat`: Recursiv-agent chat over one dossier context.
- `/api/recursiv/jobs/*`: authenticated scheduled job targets for archive sync, topic pulse, article generation, claim dossier generation, image generation, and publishing.

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
```

`recursiv:provision` creates the Recursiv database, schema, storage bucket, and agent access. `recursiv:sync` writes `data/generated/channel-archive.json` and upserts the current public YouTube archive into `channel_items`.
