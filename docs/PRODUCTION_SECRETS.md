# Production Secrets

Use Recursiv as the application backend and Infisical as the source of truth for backend/runtime secrets. Vercel should be a renderer for `www.inverted.world`, not the place that owns third-party API keys.

## Required Backend Keys

- `YOUTUBE_API_KEY`: required for the full Tales From The Inverted World upload history.
- `X_BEARER_TOKEN`: best source for fresh, metric-aware X posts.
- `BRAVE_SEARCH_API_KEY`: backup source for public web and X-result discovery.
- `OPENROUTER_API_KEY`: preferred model gateway for AI article generation.
- `RECURSIV_SERVER_API_KEY`: server-only Recursiv SDK access.

Keep these server-only inside Recursiv/Infisical. Do not prefix them with `NEXT_PUBLIC_`.

## Best Practice

1. Create or reuse an Infisical project/path for `inverted-world`.
2. Store production secrets under a production environment and a dedicated path such as `/inverted-world`.
3. Expose third-party keys only to Recursiv jobs/agents/API routes that need them.
4. Give Vercel only a narrowly scoped Recursiv app token if the frontend must call Recursiv directly. Prefer public, cacheable Recursiv-backed API endpoints instead.
4. Rotate any key that was pasted into chat, logs, or local notes.
5. Never commit `.env.local`.
6. Keep local `.env.local` for development only and keep it ignored by Git.

## Infisical Reuse

Yes, Infisical can be used for another project. The clean setup is either:

- one Infisical project named `inverted-world`, or
- the existing Recursiv Infisical workspace with a separate `/inverted-world` path.

The second option is fine if access controls are strict and only this app's production keys are exposed to Recursiv services for this project.

## Deployment Gap

As of the last check, the Vercel project had no environment variables configured. That is acceptable only if Recursiv becomes the live backend. Today the deployed Next app still fetches YouTube, news, and X directly from server routes, so it falls back to RSS plus seeded videos and cannot guarantee the full channel history. The next correction is to move ingestion, AI article generation, search, and X/news polling into Recursiv-backed jobs/endpoints.
