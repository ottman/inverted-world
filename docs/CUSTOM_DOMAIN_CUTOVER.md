# Custom Domain Cutover

Do not move `www.inverted.world` until Recursiv hosting, public Recursiv data, and the custom-domain binding path are proven live.

## Proof Command

Run:

```bash
pnpm recursiv:cutover
```

The command prints a redacted JSON report with:

- latest Recursiv deployment status;
- HTTP proof for `https://invertedworld.on.recursiv.io`;
- Recursiv archive API proof, including `sourceMode`, data-source classification, and archive count;
- source-document API proof for `https://invertedworld.on.recursiv.io/api/documents`;
- media-library detail proof for the UAP PDF route and JSON item route;
- HTTP and DNS proof for `https://www.inverted.world`;
- active Recursiv scheduled job count and missing jobs;
- latest hosted provider-health blockers for the full AI product;
- separate `publicHostingReady`, `fullAiProductReady`, and `dnsCutoverReady` decisions;
- a `dnsCutoverReady` boolean.

## Cutover Rules

- `recursivHostingProven` must be `true`.
- If `recursivHostedUrl` passes but `recursivDeploymentCompleted` is `unknown`, HTTP proof is good but deployment proof is incomplete. Do not treat that as a DNS-ready state.
- `recursivArchiveDataReady` must be `true`. This can be live `recursiv-database` or `recursiv-snapshot`, but it must not be `seed`, `static`, RSS, YouTube API, or direct provider fallback data.
- `documentsApi` must pass, proving the source shelf is available as machine-readable JSON from live `recursiv-database` or `recursiv-snapshot` data.
- `mediaItemPage` and `mediaItemApi` must pass, proving the hosted build includes shareable media pages and machine-readable item data for the official UAP PDF.
- `publicHostingReady` must be `true`.
- Recursiv custom-domain binding must be created and proven before changing DNS or removing the Vercel domain binding.
- `dnsCutoverReady` must be `true` before any DNS record is changed.
- If `keepDnsOnVercel` is `true`, leave DNS unchanged.

`recursiv-snapshot` means the public app is reading a generated export of persisted Recursiv database rows while the runtime database API key is unhealthy or rate-limited. This is acceptable proof that the public pages are not falling back to direct provider keys, seed-only data, or hand-authored static UI, but it is not the same as live database health.

Refresh that exported fallback with:

```bash
pnpm recursiv:snapshot
```

The command writes the news/archive/X/front-page snapshot and the media/document snapshot from Recursiv Postgres. Use `pnpm recursiv:snapshot -- --dry-run` to validate counts without rewriting files. It should be run only from a local/proof environment with a protected direct database URL; do not add that URL to the repo or to public runtime code.

Trigger or inspect the Recursiv deployment with:

```bash
pnpm recursiv:deploy
pnpm recursiv:deploy:status
```

The deploy command uses bounded direct Recursiv API calls and prints the selected local key source, not the key. If it returns `401`, rotate or select the correct local Recursiv key. If it returns `429`, wait for the rate limit to reset or use a healthy project/org key before retrying. A pushed commit is not enough for DNS cutover; the hosted URL must return the new route and the deployment status must be proven.

`fullAiProductReady` is stricter than public hosting readiness. Required hosted providers should still be green before calling the whole AI news product production-complete, especially `recursiv-database`, `x-api`, and `youtube-data-api`, but provider account failures are not DNS fixes.

## Current Expected State

The custom domain may still report Vercel headers while Recursiv is being proven on `invertedworld.on.recursiv.io`. That is acceptable until the cutover gates pass.

As of May 22, 2026, `invertedworld.on.recursiv.io` is proven live and the public archive/news APIs read Recursiv-backed exported snapshot data when the runtime Recursiv API key is rate-limited. The known full-product blockers are provider/account-side: the runtime Recursiv database key is rate-limited, X API access has returned `402`, and YouTube Data API access has returned `403`. Fix those provider issues for the full AI news product, but do not treat them as DNS changes. The app accepts `YOUTUBE_API_KEY`, `YOUTUBE_DATA_API_KEY`, `GOOGLE_YOUTUBE_API_KEY`, or `GOOGLE_API_KEY`; production should prefer `YOUTUBE_API_KEY` for clarity.
