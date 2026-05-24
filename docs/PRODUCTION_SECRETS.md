# Production Secrets

Use Recursiv as the application host/backend and Infisical as the source of truth for backend/runtime secrets. Vercel is temporary legacy hosting and must not own third-party API keys.

## Required Backend Keys

- `YOUTUBE_API_KEY`: required for the full Tales From The Inverted World upload history. `YOUTUBE_DATA_API_KEY`, `GOOGLE_YOUTUBE_API_KEY`, and `GOOGLE_API_KEY` are also accepted by the app, but prefer `YOUTUBE_API_KEY` in production for clarity.
- `X_BEARER_TOKEN` or `X_API_BEARER_TOKEN`: best source for fresh, metric-aware X posts.
- `BRAVE_SEARCH_API_KEY`: backup source for public web and X-result discovery.
- `EXA_API_KEY`: AI-native article/source discovery for claim dossiers. `EXA_SEARCH_API_KEY` is also accepted.
- `FIRECRAWL_API_KEY`: preferred source-text extraction for dossier links and AI chat grounding.
- `JINA_API_KEY`: fallback source-text extraction via Jina Reader when Firecrawl cannot extract a page.
- `OPENROUTER_API_KEY`: preferred model gateway for AI article generation.
- `RECURSIV_SERVER_API_KEY`: server-only Recursiv SDK access.
- `CRON_SECRET`: required bearer token for Recursiv scheduled job endpoints.

Keep these server-only inside Recursiv/Infisical. Do not prefix them with `NEXT_PUBLIC_`.

## Best Practice

1. Create or reuse an Infisical project/path for `inverted-world`.
2. Store production secrets under a production environment and a dedicated path such as `/inverted-world`.
3. Expose third-party keys only to Recursiv jobs/agents/API routes that need them.
4. Give legacy Vercel no third-party provider keys. If Vercel must remain temporarily, it should only render fallback/public data until Recursiv hosting is live.
5. Rotate any key that was pasted into chat, logs, or local notes.
6. Never commit `.env.local`.
7. Keep local `.env.local` for development only and keep it ignored by Git.

## Infisical Reuse

Yes, Infisical can be used for another project. The clean setup is either:

- one Infisical project named `inverted-world`, or
- the existing Recursiv Infisical workspace with a separate `/inverted-world` path.

The second option is fine if access controls are strict and only this app's production keys are exposed to Recursiv services for this project.

## Deployment Gap

The Recursiv project and database are configured for `invertedworld`. Keep provider keys inside Recursiv/Infisical, prove `invertedworld.on.recursiv.io`, then cut over `www.inverted.world`. Do not remove the Vercel domain binding until Recursiv HTTP proof is green.

## Local Snapshot Refresh

The committed Recursiv snapshot is a public fallback, but refreshing it requires a protected direct Postgres URL from the Recursiv database. Keep that URL local-only:

```bash
chmod 600 /private/tmp/inverted-world-database-url
pnpm recursiv:snapshot:status
pnpm recursiv:snapshot
```

The snapshot exporter also accepts `RECURSIV_DATABASE_URL_FILE`, `DATABASE_URL_FILE`, `RECURSIV_DATABASE_URL`, `RECURSIV_DIRECT_DATABASE_URL`, `INVERTED_WORLD_DATABASE_URL`, `DATABASE_URL`, `POSTGRES_URL`, and `RECURSIV_POSTGRES_URL`. Prefer the file path form for proof runs so the URL does not appear in shell history, committed files, or command output.

When a direct Postgres URL is unavailable, `pnpm recursiv:snapshot -- --source=recursiv-api` can export the same persisted rows through the Recursiv database API using the local Recursiv key file or server API key. Use that only when `pnpm recursiv:snapshot:status` proves the Recursiv database query path is usable; key presence by itself is not enough. The status and export commands print only key source names, redacted provider errors, and row counts.

## Readiness Proof

- `pnpm recursiv:health` checks local/proof provider access without printing key values.
- `pnpm recursiv:readiness` compares local provider-key presence with the latest hosted `provider-health` run stored in Recursiv.
- `pnpm recursiv:readiness -- --run-hosted` runs the authenticated hosted provider-health job first, then prints the same redacted readiness matrix.
- `pnpm recursiv:readiness -- --persist-hosted` runs the authenticated hosted provider-health job and stores the redacted result in Recursiv so `pnpm recursiv:cutover` reads the current provider matrix.
- YouTube RSS is a non-keyed fallback only. If the valid public channel page resolves but the RSS endpoint returns 404, do not treat that as a custom-domain blocker; keep the public channel-page fallback for recent uploads and keep YouTube Data API plus persisted Recursiv archive rows as the archive-completeness gates.

Treat any required provider with `hostedStatus` other than `ok` as a production cutover blocker for the full AI news product. Current expected blockers are provider/account-side, not app code: X API access must stop returning `402`, and YouTube Data API must stop returning `403` before the archive and X/news velocity system can be considered fully production-ready.
