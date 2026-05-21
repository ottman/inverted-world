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

Server-side agent calls use `RECURSIV_SERVER_API_KEY` so this standalone app does not accidentally consume unrelated global Recursiv credentials from a developer shell.

## Data Lanes

- Channel archive: Tales From The Inverted World YouTube handle and uploads feed.
- News coverage: GDELT/global article search and later paid/indexed providers.
- Official records: Federal Register, AARO, NASA, NOAA, FBI Vault, CIA Reading Room.
- Legal records: CourtListener and direct court dockets where available.
- Science/open data: NASA NTRS, NOAA SWPC, arXiv/Crossref where relevant.
- X/Grok pulse: X API for live narrative movement, Grok for X-native synthesis and memetic framing.

## Live Routes

- `/archive`: embedded channel archive. Uses YouTube RSS now and full uploads pagination when `YOUTUBE_API_KEY` is configured.
- `/news`: daily brief surface backed by `/api/articles`.
- `/documents`: browsable source database backed by `/api/documents`.
- `/api/autopost/daily`: autopost-ready daily packet with X hooks, source packs, and thumbnail prompts.

## First Tables

```sql
CREATE TABLE channel_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  topic_id TEXT,
  transcript TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE source_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  topic_ids TEXT[] DEFAULT '{}',
  summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE claim_ledgers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic_id TEXT NOT NULL,
  claim TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence JSONB DEFAULT '[]'::jsonb,
  counter_evidence JSONB DEFAULT '[]'::jsonb,
  unknowns JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coverage_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic_id TEXT NOT NULL,
  query TEXT NOT NULL,
  outlets JSONB NOT NULL,
  official_records JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT now()
);
```

## Sync Command

```bash
bun run sync:content
```

This writes `data/generated/channel-archive.json` from public channel/archive sources. The deployed app can later push that output into Recursiv database tables.
