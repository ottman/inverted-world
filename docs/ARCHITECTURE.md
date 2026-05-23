# Inverted World Architecture

## Current Production Shape

`invertedworld.on.recursiv.io` is now the proven Recursiv-hosted app. `www.inverted.world` still resolves to the legacy Vercel-hosted Next.js app and should stay there until the Recursiv custom-domain binding is created and proven.

Current runtime lanes:

- Home/archive UI: `app/page.tsx` reuses `app/archive/page.tsx`.
- Archive ingestion: `lib/deep-archive.ts` now reads Recursiv `channel_items` first, then a generated Recursiv database snapshot, then YouTube Data API, RSS, and seeded local videos.
- Live articles: `lib/live-articles.ts` now reads published Recursiv `article_drafts` first, then falls back to Exa source discovery and Google News RSS.
- X signals: `lib/x-posts.ts` now reads Recursiv `x_signals` first, then falls back to X API, Brave, Exa-indexed search, public syndication, X profile-reader extraction, and seed posts. `scripts/backfill-x-signals.mjs --provider=profile` is the local/proof path for widening stored X coverage when direct X API credits are blocked.
- Provider fallback policy: public request paths default to Recursiv/static/seeded data and do not directly call third-party provider APIs; Recursiv job handlers explicitly opt into provider fallbacks for ingestion.
- Claim dossier sources: `lib/source-extraction.ts` extracts short source excerpts with Firecrawl first and Jina Reader fallback so `/news/[slug]` chat is grounded in page text, not links alone.
- Article generation: `lib/recursiv/ingestion.ts` now turns published claim dossiers into Recursiv `article_drafts`, using the configured Recursiv agent when available and a deterministic sourced fallback when the agent is unavailable.
- Worldwire/news board: Recursiv jobs crawl Exa, Brave, and RSS fallbacks into `coverage_snapshots` with `source = 'worldwire'`. The lanes now include a regular front page alongside war, politics, power/files, money, tech/AI, science, health/earth, crime/culture, and strange-records coverage. `/news` reads those persisted snapshots, published article drafts, and claim dossier sources; public page renders do not call third-party crawler APIs directly.
- Front-page editions: `front_page_editions` snapshots the published lead mix from articles, dossiers, X signals, and Tales archive items so `/news` has persistent daily-return editorial state. Public article, X, dossier, worldwire, archive, front-page, media, document, and pipeline reads also have generated Recursiv snapshot fallbacks so the hosted app does not collapse to seed/static mode while the runtime database key is rate-limited.
- Pipeline runs: `pipeline_runs` records execution and step results. `/api/recursiv/jobs/full-pipeline` now defaults to a bounded scheduled refresh (`source-documents`, `media-library`, `youtube-archive-sync`, `topic-pulse`, `worldwire`, `publishing`, `front-page-edition`) and supports `?mode=all` for manual deep runs. It inserts the new run before background stale-run cleanup, marks old interrupted runs as `stale_running`, and records current-step progress. `/api/pipeline` reports `sourceMode` plus non-secret Recursiv read health so rate limits do not masquerade as stale success. `/api/recursiv/jobs/pipeline-maintenance` performs stale-run cleanup without invoking heavy generation.
- Scheduled job triggering: every `/api/recursiv/jobs/*` route supports `?async=1`. Recursiv cron should use async mode so the scheduler receives a fast acknowledgement while the hosted Next process continues the ingestion work. Manual local/proof POSTs should omit `async=1` when the caller needs the full job result body.
- Pipeline status: `/api/pipeline` exposes the latest persisted Recursiv pipeline run, and `/api/front-page` includes the latest pipeline status so the public news desk can show freshness without provider keys.
- Dossier chat: `/api/dossiers/[slug]/chat` stores Recursiv-agent Q/A in `claim_chat_messages`; the dossier chat UI hydrates recent messages from Recursiv so conversations persist beyond the current browser session.
- Video pages: `app/archive/[videoId]/page.tsx` renders one embedded video and related Tales videos.
- Media library: `/media`, `/media/[mediaId]`, `/api/media`, and `/api/media/[mediaId]` render and expose Recursiv-backed videos, official release documents, audio, images, archive hubs, source-chain briefs, and research questions. The WAR.GOV PURSUE manifest importer expands official rows into direct PDF/video/audio/image entries when the source CSV is reachable.
- Static editorial scaffolding: `data/intelligence-articles.ts`, `data/inverted-world.ts`, and docs files.

The `@recursiv/sdk` package is now used for server-side Recursiv database reads, provisioning scripts, deployment scripts, and scheduled job endpoints.

Custom-domain cutover proof is explicit: `pnpm recursiv:cutover` checks the Recursiv hosted URL, Recursiv archive API data mode, documents API, media item page/API, the current `www.inverted.world` HTTP/DNS state, active scheduled jobs, latest deployment, and hosted provider blockers before any DNS change. It separates public hosting readiness from full AI product readiness so provider account failures do not get mistaken for DNS problems.

## Problem

The site has moved into a Recursiv-hosted, Recursiv-backed shape, but it is not yet a serious AI news machine because:

- Recursiv public hosting is proven and public archive, document, and media reads are live `recursiv-database` reads, but the custom domain has not been cut over;
- The next product layer is `claim_dossiers`, `claim_sources`, and `claim_chat_messages`: comparative coverage pages for conspiracy/anomaly claims with source split, X velocity, evidence grading, Tales archive context, viral headline variants, and AI chat history.
- scheduled Recursiv jobs are implemented as authenticated route targets and have been provisioned against the Recursiv-hosted URL with `CRON_SECRET`, including the worldwire crawler that powers the Drudge-style `/news` board from stored `coverage_snapshots`;
- `scripts/provision-recursiv-backend.mjs --with-jobs` is the desired-state manifest for the Recursiv scheduled jobs, including the bounded full-pipeline refresh and pipeline-maintenance cleanup job. Its job endpoints use `async=1` to prevent scheduler-level timeout noise on ingestion tasks that intentionally keep running in the hosted app;
- `/api/autopost/daily` now exposes the Recursiv-published daily packet for site/social/newsletter/video reuse without exposing provider keys to the browser;
- AI article generation is implemented as a Recursiv job handler over published claim dossiers; image generation tries Recursiv media first and stores a generated SVG fallback asset when the media endpoint is unavailable; YouTube archive sync now falls back to the seeded Tales video list when RSS/Data API access is unavailable;
- X API access is currently blocked by account credits, YouTube Data API access is blocked by quota or missing configuration, and local Recursiv writes can hit API-key per-hour limits; these are full-product/provider blockers, not DNS blockers. The scheduled topic-pulse job should still run with the public X profile-reader fallback enabled so the site continues collecting priority-account X signals while paid X API access is repaired;
- Vercel should not own YouTube, X, Brave, OpenRouter, or image-generation keys;
- the archive is complete only when a backend with the YouTube key paginates the full uploads playlist.

## Target Recursiv-First Shape

Recursiv should host the app and own the backend. Vercel is temporary legacy hosting only until `invertedworld.on.recursiv.io` is proven.

Recommended backend flow:

1. Recursiv scheduled job polls YouTube, Exa/Google News/GDELT/Brave, X, and official sources, then enriches lead links with source-text extraction.
2. Recursiv stores normalized rows in Postgres tables:
   - `channel_items`
   - `topic_sources`
   - `coverage_snapshots`
   - `x_signals`
   - `article_drafts`
   - `generated_assets`
   - `claim_dossiers`
   - `claim_sources`
   - `claim_chat_messages`
   - `front_page_editions`
   - `pipeline_runs`
3. Recursiv agents generate:
   - hourly topic briefs;
   - sourced article drafts;
   - claim dossiers with evidence grade, source split, X velocity, weird read, skeptical read, and viral headline variants;
   - skeptical/weird read pairs;
   - claim ledgers;
   - social hooks;
   - thumbnail prompts and generated images.
   - front-page editions for the daily return surface.
4. The site reads published Recursiv data first through cacheable endpoints:
   - `/api/articles`
   - `/api/archive`
   - `/api/x/[topicId]`
   - `/news/[articleId]`
   - `/api/dossiers`
   - `/api/dossiers/[slug]/chat`
   - `/api/front-page`
   - `/api/media`
   - `/api/documents`
5. Vercel gets no third-party provider keys. Remove Vercel hosting/domain binding only after Recursiv hosting is proven live.

## A+ Product Bar

The site becomes A+ when:

- every Tales video is indexed and assigned to a topic;
- topic pages update at least hourly with sourced coverage;
- `/news` and `/news/[slug]` are real claim-dossier surfaces, authored by the AI pipeline, source-backed, and chat-enabled;
- X/news signals are stored historically so the site shows velocity, not just a current fetch;
- there is a daily editorial front page that feels like the Drudge/Ground News of paranormal and conspiracy topics;
- all secrets live behind Recursiv/Infisical, not in the frontend host.
