# Inverted World Architecture

## Current Production Shape

`www.inverted.world` currently resolves to a Vercel-hosted Next.js app. The target production host is Recursiv first at `invertedworld.on.recursiv.io`, then the custom `www.inverted.world` domain after live Recursiv proof.

Current runtime lanes:

- Home/archive UI: `app/page.tsx` reuses `app/archive/page.tsx`.
- Archive ingestion: `lib/deep-archive.ts` now reads Recursiv `channel_items` first, then falls back to YouTube Data API, RSS, and seeded local videos.
- Live articles: `lib/live-articles.ts` now reads published Recursiv `article_drafts` first, then falls back to Google News RSS.
- X signals: `lib/x-posts.ts` now reads Recursiv `x_signals` first, then falls back to X API, Brave, public syndication, and seed posts.
- Video pages: `app/archive/[videoId]/page.tsx` renders one embedded video and related Tales videos.
- Static editorial scaffolding: `data/intelligence-articles.ts`, `data/inverted-world.ts`, and docs files.

The `@recursiv/sdk` package is now used for server-side Recursiv database reads, provisioning scripts, deployment scripts, and scheduled job endpoints.

## Problem

The site is still mostly a live-rendered frontend with fetch helpers. It is not yet a serious AI news machine because:

- Recursiv tables now exist for `channel_items`, `coverage_snapshots`, `x_signals`, `article_drafts`, and `generated_assets`, but only the YouTube archive seed has been proven live so far;
- scheduled Recursiv jobs are implemented as authenticated route targets and provisionable jobs, but they should only be enabled after the Recursiv-hosted URL and `CRON_SECRET` are live;
- AI/image generation paths are implemented as Recursiv job handlers and still need production provider keys and live job runs;
- Vercel should not own YouTube, X, Brave, OpenRouter, or image-generation keys;
- the archive is complete only when a backend with the YouTube key paginates the full uploads playlist.

## Target Recursiv-First Shape

Recursiv should host the app and own the backend. Vercel is temporary legacy hosting only until `invertedworld.on.recursiv.io` is proven.

Recommended backend flow:

1. Recursiv scheduled job polls YouTube, Google News/GDELT/Brave, X, and official sources.
2. Recursiv stores normalized rows in Postgres tables:
   - `channel_items`
   - `topic_sources`
   - `coverage_snapshots`
   - `x_signals`
   - `article_drafts`
   - `generated_assets`
3. Recursiv agents generate:
   - hourly topic briefs;
   - sourced article drafts;
   - skeptical/weird read pairs;
   - claim ledgers;
   - social hooks;
   - thumbnail prompts and generated images.
4. The site reads published Recursiv data first through cacheable endpoints:
   - `/api/articles`
   - `/api/archive`
   - `/api/x/[topicId]`
   - `/news/[articleId]`
5. Vercel gets no third-party provider keys. Remove Vercel hosting/domain binding only after Recursiv hosting is proven live.

## A+ Product Bar

The site becomes A+ when:

- every Tales video is indexed and assigned to a topic;
- topic pages update at least hourly with sourced coverage;
- article pages are real, authored by the AI pipeline, image-backed, and cite sources;
- X/news signals are stored historically so the site shows velocity, not just a current fetch;
- there is a daily editorial front page that feels like the Drudge/Ground News of paranormal and conspiracy topics;
- all secrets live behind Recursiv/Infisical, not in the frontend host.
