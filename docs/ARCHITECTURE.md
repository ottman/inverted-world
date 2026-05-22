# Inverted World Architecture

## Current Production Shape

`www.inverted.world` currently resolves to a Vercel-hosted Next.js app. The target production host is Recursiv first at `invertedworld.on.recursiv.io`, then the custom `www.inverted.world` domain after live Recursiv proof.

Current runtime lanes:

- Home/archive UI: `app/page.tsx` reuses `app/archive/page.tsx`.
- Archive ingestion: `lib/deep-archive.ts` now reads Recursiv `channel_items` first, then falls back to YouTube Data API, RSS, and seeded local videos.
- Live articles: `lib/live-articles.ts` now reads published Recursiv `article_drafts` first, then falls back to Exa source discovery and Google News RSS.
- X signals: `lib/x-posts.ts` now reads Recursiv `x_signals` first, then falls back to X API, Brave, public syndication, and seed posts.
- Claim dossier sources: `lib/source-extraction.ts` extracts short source excerpts with Firecrawl first and Jina Reader fallback so `/news/[slug]` chat is grounded in page text, not links alone.
- Article generation: `lib/recursiv/ingestion.ts` now turns published claim dossiers into Recursiv `article_drafts`, using the configured Recursiv agent when available and a deterministic sourced fallback when the agent is unavailable.
- Front-page editions: `front_page_editions` snapshots the published lead mix from articles, dossiers, X signals, and Tales archive items so `/news` has persistent daily-return editorial state.
- Video pages: `app/archive/[videoId]/page.tsx` renders one embedded video and related Tales videos.
- Static editorial scaffolding: `data/intelligence-articles.ts`, `data/inverted-world.ts`, and docs files.

The `@recursiv/sdk` package is now used for server-side Recursiv database reads, provisioning scripts, deployment scripts, and scheduled job endpoints.

## Problem

The site is still mostly a live-rendered frontend with fetch helpers. It is not yet a serious AI news machine because:

- Recursiv tables now exist for `channel_items`, `coverage_snapshots`, `x_signals`, `article_drafts`, and `generated_assets`, but only the YouTube archive seed has been proven live so far;
- The next product layer is `claim_dossiers`, `claim_sources`, and `claim_chat_messages`: Ground News-style coverage pages for conspiracy/anomaly claims with source split, X velocity, evidence grading, Tales archive context, viral headline variants, and AI chat history.
- scheduled Recursiv jobs are implemented as authenticated route targets and provisionable jobs, but they should only be enabled after the Recursiv-hosted URL and `CRON_SECRET` are live;
- AI article generation is implemented as a Recursiv job handler over published claim dossiers; image generation tries Recursiv media first and stores a generated SVG fallback asset when the media endpoint is unavailable;
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
5. Vercel gets no third-party provider keys. Remove Vercel hosting/domain binding only after Recursiv hosting is proven live.

## A+ Product Bar

The site becomes A+ when:

- every Tales video is indexed and assigned to a topic;
- topic pages update at least hourly with sourced coverage;
- `/news` and `/news/[slug]` are real claim-dossier surfaces, authored by the AI pipeline, source-backed, and chat-enabled;
- X/news signals are stored historically so the site shows velocity, not just a current fetch;
- there is a daily editorial front page that feels like the Drudge/Ground News of paranormal and conspiracy topics;
- all secrets live behind Recursiv/Infisical, not in the frontend host.
