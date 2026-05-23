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
- latest full-pipeline status and `sourceMode` from `/api/pipeline`;
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

`fullAiProductReady` is stricter than public hosting readiness. Required hosted providers should still be green before calling the whole AI news product production-complete, especially `recursiv-database`, `x-api`, and `youtube-data-api`, but provider account failures are not DNS fixes. YouTube RSS is an opportunistic public fallback; it should not block cutover when the channel page and persisted Recursiv archive are live but the RSS endpoint returns 404.

## Current Expected State

As of May 23, 2026, `invertedworld.on.recursiv.io` is proven live on Recursiv and `pnpm recursiv:cutover` reports `publicHostingReady: true`.

Current live proof:

- `https://invertedworld.on.recursiv.io` returns the app.
- `/api/archive?limit=1000` returns `sourceMode: "recursiv-database"` with 437 archive rows and no warnings.
- `/api/documents` returns `sourceMode: "recursiv-database"` with 37 source documents across all six topics.
- `/media/war-uap-release-02-senior-usic-narrative` returns 200.
- `/api/media/war-uap-release-02-senior-usic-narrative` returns `sourceMode: "recursiv-database"` with the official UAP PDF item and related media.
- `/api/pipeline?limit=1` returns `sourceMode: "recursiv-database"` and latest `full-pipeline` status `succeeded`.
- the latest scheduled `full-pipeline` run completed on May 23, 2026 at `05:08:21Z` with seven successful steps: source documents, media library, YouTube archive sync, topic pulse, worldwire, publishing, and front-page edition.
- the successful full-pipeline run synced 37 source documents, 292 media items, 19 archive videos through the seed fallback, 93 X signals, six topic coverage snapshots, 11 worldwire snapshots, 85 worldwire items, and a published front-page edition.
- all 13 expected Recursiv scheduled jobs are active.

The custom domain still reports Vercel headers. Keep it there until the Recursiv custom-domain binding for `www.inverted.world` is created and proven. `dnsCutoverReady` is still `false` because custom-domain proof is missing, not because the Recursiv hosted app is unproven.

The known full-product blockers are provider/account-side, not DNS fixes. A fresh hosted provider-readiness check on May 23, 2026 reports `recursiv-database` as live and narrows the required blocking providers to `x-api` and `youtube-data-api`. The configured YouTube channel ID still resolves through the public channel page, but the YouTube RSS endpoint returns 404; treat RSS as a non-blocking fallback while archive completeness is enforced through YouTube Data API and persisted Recursiv rows. The app accepts `YOUTUBE_API_KEY`, `YOUTUBE_DATA_API_KEY`, `GOOGLE_YOUTUBE_API_KEY`, or `GOOGLE_API_KEY`; production should prefer `YOUTUBE_API_KEY` for clarity.

## Current Decision

As of the May 23, 2026 readiness run:

- `publicHostingReady: true`
- `fullAiProductReady: false`
- `customDomainRecursivProven: false`
- `dnsCutoverReady: false`
- `keepDnsOnVercel: true`

Next step is not a DNS change. Create and prove the Recursiv custom-domain binding for `www.inverted.world`, then rerun `pnpm recursiv:cutover`. Only after `customDomainRecursivProven` and `dnsCutoverReady` are true should the DNS host change be planned.
