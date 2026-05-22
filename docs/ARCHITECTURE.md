# Inverted World Architecture

## Current Production Shape

`www.inverted.world` is a Next.js app deployed on Vercel.

Current runtime lanes:

- Home/archive UI: `app/page.tsx` reuses `app/archive/page.tsx`.
- Archive ingestion: `lib/deep-archive.ts` pulls the Tales YouTube uploads playlist when `YOUTUBE_API_KEY` exists, otherwise falls back to YouTube RSS and seeded local videos.
- Live articles: `lib/live-articles.ts` pulls Google News RSS per topic and formats lightweight article records.
- X signals: `lib/x-posts.ts` uses X API if configured, Brave if configured, and a public Shane Cashman embed fallback.
- Video pages: `app/archive/[videoId]/page.tsx` renders one embedded video and related Tales videos.
- Static editorial scaffolding: `data/intelligence-articles.ts`, `data/inverted-world.ts`, and docs files.

The `@recursiv/sdk` package is installed, but the production content loop is not yet Recursiv-native.

## Problem

The site is still mostly a live-rendered frontend with fetch helpers. It is not yet a serious AI news machine because:

- there is no persistent Recursiv database table for article drafts, source snapshots, transcripts, claims, or generated thumbnails;
- there is no scheduled Recursiv job generating articles every hour/day;
- AI generation is not in the production path;
- Vercel should not own YouTube, X, Brave, OpenRouter, or image-generation keys;
- the archive is complete only when a backend with the YouTube key paginates the full uploads playlist.

## Target Recursiv-First Shape

Vercel should render pages. Recursiv should own the backend.

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
4. The site reads only published Recursiv data through cacheable endpoints:
   - `/api/home-feed`
   - `/api/archive`
   - `/api/topics/[topicId]`
   - `/api/articles/[slug]`
5. Vercel needs no third-party provider keys. At most it needs a narrow Recursiv read token or public signed endpoints.

## A+ Product Bar

The site becomes A+ when:

- every Tales video is indexed and assigned to a topic;
- topic pages update at least hourly with sourced coverage;
- article pages are real, authored by the AI pipeline, image-backed, and cite sources;
- X/news signals are stored historically so the site shows velocity, not just a current fetch;
- there is a daily editorial front page that feels like the Drudge/Ground News of paranormal and conspiracy topics;
- all secrets live behind Recursiv/Infisical, not in the frontend host.
