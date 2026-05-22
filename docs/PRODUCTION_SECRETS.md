# Production Secrets

Use Recursiv as the application host/backend and Infisical as the source of truth for backend/runtime secrets. Vercel is temporary legacy hosting and must not own third-party API keys.

## Required Backend Keys

- `YOUTUBE_API_KEY`: required for the full Tales From The Inverted World upload history.
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

## Readiness Proof

- `pnpm recursiv:health` checks local/proof provider access without printing key values.
- `pnpm recursiv:readiness` compares local provider-key presence with the latest hosted `provider-health` run stored in Recursiv.
- `pnpm recursiv:readiness -- --run-hosted` runs the authenticated hosted provider-health job first, then prints the same redacted readiness matrix.

Treat any required provider with `hostedStatus` other than `ok` as a production cutover blocker for the full AI news product. Current expected blockers are provider/account-side, not app code: X API access must stop returning `402`, and YouTube Data API must stop returning `403` before the archive and X/news velocity system can be considered fully production-ready.
