# Inverted World Daily Editorial System

## Goal

Publish a daily, source-first conspiracy and anomaly briefing system that can scale to 100 evergreen articles, daily updates, social posts, video scripts, and searchable dossiers without drifting into unsourced claims.

The editorial posture is:

- Want to believe, but demand receipts.
- Put the weird read and skeptical read side by side.
- Separate document, reporting, allegation, speculation, and unknown.
- Prefer primary records before pundit summaries.
- Treat missing records, narrow denials, redactions, and sealed gaps as research objects, not proof.

## Article Inventory

The first 100 articles should be split across ten lanes:

1. UAP disclosure and retrieval claims.
2. Declassified intelligence programs and MKULTRA continuities.
3. Epstein networks, sealed records, and institutional protection.
4. Cryptids, paranormal reports, folklore, and witness clusters.
5. AI, surveillance, technocracy, and autonomous governance.
6. Space anomalies, NASA language, meteor events, and solar disruption.
7. Biosecurity, COVID origin questions, funding trails, and policy reversals.
8. Data centers, floating infrastructure, energy demand, and private sovereignty.
9. Ancient anomalies, religious artifacts, remote viewing, and fringe history.
10. Media pattern analysis: what gets amplified, buried, mocked, or reframed.

Each lane needs ten articles. Every article must include:

- Hook: one sentence that makes conspiracy circles want to click.
- Claim ledger: what is documented, alleged, speculative, and unknown.
- Primary records: at least three source links from government, legal, science, archive, or original media lanes.
- Weird read: the strongest anomaly-friendly interpretation.
- Skeptical read: the strongest mundane or debunking interpretation.
- Verification path: searches, agencies, dockets, datasets, and archived media to pull next.
- Image prompt: reusable thumbnail prompt in the Inverted World style.
- Social packet: X hook, thread outline, short-form video angle, newsletter subject.

## Daily Update Loop

Run this every morning:

1. Pull latest channel uploads from YouTube Data API.
2. Pull latest cross-outlet coverage from Google News RSS and GDELT for every topic lane.
3. Pull primary-source changes from:
   - AARO
   - ODNI
   - Congress.gov
   - GovInfo
   - Federal Register
   - CourtListener
   - DOJ
   - CIA Reading Room
   - FBI Vault
   - NASA / NOAA / NIST / CISA
4. Score each item:
   - document strength
   - weirdness
   - controversy
   - virality
   - freshness
   - media split
5. Generate a daily issue:
   - 6 lead stories
   - 12 secondary links
   - 1 source-of-the-day
   - 1 skeptical correction
   - 1 weird unresolved thread
   - 3 social hooks
6. Update site surfaces:
   - home truth desk ticker
   - `/news`
   - `/archive`
   - per-video dossiers
   - `/llms.txt`
   - `/sitemap.xml`
7. Queue distribution:
   - site
   - X thread
   - newsletter
   - short-form video script

## Required Automation

The existing endpoints should evolve into this contract:

- `/api/archive`: source of truth for YouTube archive and video IDs.
- `/archive/[videoId]`: SEO and LLM-readable per-video dossier.
- `/api/articles`: daily merged feed of current news plus evergreen article inventory.
- `/api/autopost/daily`: Recursiv-backed daily issue packet for site, X, newsletter, short-video scripting, source packs, image prompts, and guardrails.
- `/api/recursiv/jobs/daily-autopost`: authenticated Recursiv scheduler target that builds and verifies the current daily issue packet after the front-page edition job.
- `/llms.txt`: LLM-readable index of the archive and dossiers.
- `/sitemap.xml`: crawler index for all article and video dossier URLs.

## Provider Requirements

The truth engine must use a real model path. Acceptable providers:

- Recursiv agent using `anthropic/claude-sonnet-4.6`.
- OpenRouter using `anthropic/claude-sonnet-4.6` with funded credits.
- Direct Anthropic API key.

If all providers fail, the site must show a provider-offline state. It must not pretend a local scaffold is Claude.

## Quality Bar

An article is not publishable unless it answers:

- What exactly is the claim?
- What is the best record supporting it?
- What is the best reason to doubt it?
- What changed recently?
- What should a serious researcher pull next?

The standard is not "conspiracy content." The standard is a research product conspiracy circles have to reference because it is faster, stranger, more sourced, and more intellectually honest than social feeds.
