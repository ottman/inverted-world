# Production Secrets

Use Infisical as the source of truth and Vercel as the runtime target.

## Required Runtime Keys

- `YOUTUBE_API_KEY`: required for the full Tales From The Inverted World upload history.
- `X_BEARER_TOKEN`: best source for fresh, metric-aware X posts.
- `BRAVE_SEARCH_API_KEY`: backup source for public web and X-result discovery.
- `OPENROUTER_API_KEY`: preferred model gateway for AI article generation.
- `RECURSIV_SERVER_API_KEY`: server-only Recursiv SDK access.

Keep these server-only. Do not prefix them with `NEXT_PUBLIC_`.

## Best Practice

1. Create or reuse an Infisical project for `inverted-world`.
2. Store production secrets under a production environment and a dedicated path such as `/inverted-world`.
3. Give Vercel only the secrets needed by this app, scoped to the production environment.
4. Rotate any key that was pasted into chat, logs, or local notes.
5. Add secrets to Vercel from Infisical or by secure CLI prompt, never by committing `.env.local`.
6. Keep local `.env.local` for development only and keep it ignored by Git.

## Infisical Reuse

Yes, Infisical can be used for another project. The clean setup is either:

- one Infisical project named `inverted-world`, or
- the existing Recursiv Infisical workspace with a separate `/inverted-world` path.

The second option is fine if access controls are strict and only this app's production keys are exposed to the Vercel project.

## Deployment Gap

As of the last check, the Vercel project had no environment variables configured. Without `YOUTUBE_API_KEY`, the live site falls back to RSS plus seeded videos and cannot guarantee the full channel history. Without `X_BEARER_TOKEN` or `BRAVE_SEARCH_API_KEY`, X posts rely on the no-key Shane Cashman public embed fallback.
