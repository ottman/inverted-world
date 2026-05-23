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
- release proof from `https://invertedworld.on.recursiv.io/api/release`, including the deployed feature marker;
- Recursiv deployment-domain proof that distinguishes the platform slug host from a configured custom-domain binding;
- Recursiv archive API proof, including `sourceMode`, data-source classification, and archive count;
- source-document API proof for `https://invertedworld.on.recursiv.io/api/documents`;
- media-library detail proof for the UAP PDF route and JSON item route;
- latest full-pipeline status and `sourceMode` from `/api/pipeline`;
- HTTP and DNS proof for `https://www.inverted.world`;
- active Recursiv scheduled job count and missing jobs;
- latest hosted provider-health blockers for the full AI product;
- separate `publicHostingReady`, `fullAiProductReady`, `dnsChangeReady`, and `dnsCutoverReady` decisions;
- a `dnsCutoverReady` boolean.

## Cutover Rules

- `recursivHostingProven` must be `true`.
- If `recursivHostedUrl` passes but `recursivDeploymentCompleted` is `unknown`, HTTP proof is good but deployment proof is incomplete. Do not treat that as a DNS-ready state.
- `recursivArchiveDataReady` must be `true`. This can be live `recursiv-database` or `recursiv-snapshot`, but it must not be `seed`, `static`, RSS, YouTube API, or direct provider fallback data.
- `documentsApi` must pass, proving the source shelf is available as machine-readable JSON from live `recursiv-database` or `recursiv-snapshot` data.
- `mediaItemPage` and `mediaItemApi` must pass, proving the hosted build includes shareable media pages and machine-readable item data for the official UAP PDF.
- `publicHostingReady` must be `true`.
- Recursiv custom-domain binding must be created and proven before changing DNS or removing the Vercel domain binding.
- `customDomainBindingConfigured` must be `true` before any DNS record is changed. It proves the latest Recursiv deployment advertises both the slug host and the requested custom hostname.
- `dnsChangeReady` means it is safe to plan the `www` record change. It is not the same as finished cutover.
- `dnsCutoverReady` means the custom hostname itself is already serving the Recursiv app after DNS propagation.
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

Preview the deployment payload without calling Recursiv:

```bash
pnpm recursiv:deploy:dry-run
pnpm recursiv:deploy:dry-run -- --custom-domain=www.inverted.world
```

Create the pre-DNS custom-domain binding after public hosting and Recursiv API health are green:

```bash
pnpm recursiv:deploy:custom-domain
```

This still does not change DNS. It should make the latest Recursiv deployment metadata include both `invertedworld.on.recursiv.io` and `www.inverted.world`; rerun `pnpm recursiv:cutover` and require `customDomainBindingConfigured: true` plus `dnsChangeReady: true` before planning the DNS record edit.

`fullAiProductReady` is stricter than public hosting readiness. Required hosted providers should still be green before calling the whole AI news product production-complete, especially `recursiv-database`, `x-api`, and `youtube-data-api`, but provider account failures are not DNS fixes. YouTube RSS is an opportunistic public fallback; it should not block cutover when the public channel-page fallback and persisted Recursiv archive are live but the RSS endpoint returns 404.

## Current Expected State

As of May 23, 2026, `invertedworld.on.recursiv.io` is proven live on Recursiv. An earlier readiness run reported `publicHostingReady: true`, but the current runtime database key is temporarily rate-limited, so full cutover readiness should be rerun after the backoff clears.

Current live proof:

- `https://invertedworld.on.recursiv.io` returns the app.
- latest Recursiv deployment `019e550c-02c6-703c-8ca9-00eca7fee957` completed on May 23, 2026 at `13:38:29Z`.
- `/api/release` returns `release: "worldwire-persistence-v2"` and `worldwireJsonbPayloads: "dollar-quoted-sql-literals"`, proving the hosted build contains the compact Worldwire JSONB persistence path.
- current `/api/archive?limit=1000` proof returns `sourceMode: "recursiv-snapshot"` with 437 unique archive videos, no warnings, and `hasMore: false`; live database reads are temporarily rate-limited.
- earlier `/api/archive?limit=1000` proof returned `sourceMode: "recursiv-database"` with 437 archive rows and no warnings.
- earlier `/api/documents` proof returned `sourceMode: "recursiv-database"` with 37 source documents across all six topics.
- earlier `/media/war-uap-release-02-senior-usic-narrative` proof returned 200.
- earlier `/api/media/war-uap-release-02-senior-usic-narrative` proof returned `sourceMode: "recursiv-database"` with the official UAP PDF item and related media.
- earlier `/api/pipeline?limit=1` proof returned `sourceMode: "recursiv-database"` and latest `full-pipeline` status `succeeded`.
- the latest scheduled `full-pipeline` run completed on May 23, 2026 at `05:08:21Z` with seven successful steps: source documents, media library, YouTube archive sync, topic pulse, worldwire, publishing, and front-page edition.
- the successful full-pipeline run synced 37 source documents, 292 media items, 19 archive videos through the seed fallback, 93 X signals, six topic coverage snapshots, 11 worldwire snapshots, 85 worldwire items, and a published front-page edition.
- all 13 expected Recursiv scheduled jobs are active.

The custom domain still reports Vercel headers. Keep it there until the Recursiv custom-domain binding for `www.inverted.world` is created and proven. `dnsCutoverReady` is still `false` because custom-domain proof is missing, not because the Recursiv hosted app is unproven.

Fresh proof on May 23, 2026 at `13:38Z` still shows `https://www.inverted.world` returning `server: Vercel` and `x-vercel-id`. DNS remains intentionally unchanged.

The hosted runtime database key is currently rate-limited/backed off. `/api/pipeline?limit=1` returned `sourceMode: "unavailable"` with `lastErrorStatus: 429` and backoff until May 23, 2026 at `14:38:52Z`. Do not run wide hosted ingestion or Worldwire proof until that backoff clears or a healthy Recursiv key is installed.

The direct custom-domain binding attempt on May 23, 2026 at `13:44Z` used `pnpm recursiv:deploy:custom-domain` and returned `429 rate_limit_exceeded` with the API message `per-day`. The local deploy helper recorded a cooldown until May 23, 2026 at `14:44:34Z`. Do not retry the binding path until a healthy Recursiv key is installed or the actual daily limit is known to have reset.

The known full-product blockers are provider/account-side, not DNS fixes. A fresh hosted provider-readiness check on May 23, 2026 reports `recursiv-database` as live and narrows the required blocking providers to `x-api` and `youtube-data-api`. The configured YouTube channel ID still resolves through the public channel page, but the YouTube RSS endpoint returns 404; treat RSS as non-blocking while recent upload refresh can use the public channel-page fallback and archive completeness is enforced through YouTube Data API plus persisted Recursiv rows. The app accepts `YOUTUBE_API_KEY`, `YOUTUBE_DATA_API_KEY`, `GOOGLE_YOUTUBE_API_KEY`, or `GOOGLE_API_KEY`; production should prefer `YOUTUBE_API_KEY` for clarity.

## Current Decision

As of the successful May 23, 2026 readiness run, before the current key backoff:

- `publicHostingReady: true`
- `fullAiProductReady: false`
- `customDomainBindingConfigured: false`
- `dnsChangeReady: false`
- `customDomainRecursivProven: false`
- `dnsCutoverReady: false`
- `keepDnsOnVercel: true`

Next step is not a DNS change. Create and prove the Recursiv custom-domain binding for `www.inverted.world`, then rerun `pnpm recursiv:cutover`. Only after `customDomainBindingConfigured` and `dnsChangeReady` are true should the DNS host change be planned. Only after `customDomainRecursivProven` and `dnsCutoverReady` are true should the cutover be called complete.

As of the fresh May 23, 2026 `13:44Z` checks, the immediate next step is to restore Recursiv API health or wait for the true daily limit reset, then rerun the custom-domain binding command and `pnpm recursiv:cutover`. DNS cutover remains blocked.

## Reusable Org Custom-Domain Process

Use this sequence for every Recursiv-hosted org site. The goal is a repeatable cutover with proof at each step, not a one-off DNS guess.

For new orgs, copy the operator packet in [ORG_CUSTOM_DOMAIN_CUTOVER_TEMPLATE.md](./ORG_CUSTOM_DOMAIN_CUTOVER_TEMPLATE.md) and attach the final command output to the customer or internal handoff. The no-secret preflight command is:

```bash
pnpm recursiv:domain:preflight -- --slug=<slug>.on.recursiv.io --custom-domain=www.customer.com --expected-text="Customer"
```

That command proves the current HTTP/DNS posture without calling Recursiv deploy/status APIs. It does not replace the Recursiv custom-domain binding proof.

### 1. Intake

Capture the site owner, Recursiv organization, Recursiv project, canonical host, apex host, current host, DNS provider, registrar, current deployment provider, and rollback owner.

For most customer sites, cut over `www` first. Only cut over the apex after the `www` host is proven and the DNS provider supports the required apex behavior, such as ALIAS, ANAME, or CNAME flattening.

### 2. Recursiv Hosted URL Proof

Create or verify the Recursiv project slug, then prove the platform URL:

```bash
curl -I -sS https://<slug>.on.recursiv.io
```

Required proof:

- HTTP 200 or expected redirect;
- correct page title or core product text;
- deployment status is `completed`;
- production app reads Recursiv-backed data or a Recursiv export snapshot;
- scheduled jobs needed for the public experience are active;
- no third-party provider secrets are required in the legacy host.

Do not continue to DNS if the hosted URL is still using direct legacy provider keys, seeded-only data, or a failed/stale deployment.

### 3. Custom-Domain Binding

Create the custom-domain binding in Recursiv for the project before changing DNS. If the API/UI does not expose custom-domain binding yet, the required platform work is:

- project-scoped domain record, such as `www.customer.com`;
- ownership verification value, usually a TXT record or equivalent;
- serving target, usually the project slug host;
- TLS certificate provisioning status;
- binding status exposed through a project/domains API or admin UI.

Until that binding exists and returns a verifiable target, DNS cutover is blocked.

For projects using the Recursiv deploy API, the desired production bind step is:

```bash
pnpm recursiv:deploy -- --custom-domain=www.customer.com
```

Do not paste the API key into logs or docs. The deploy helper reads the protected local key file or environment and prints only the key source. After the deploy completes, the latest deployment metadata should include both `<slug>.on.recursiv.io` and `www.customer.com`; that is the pre-DNS custom-domain binding proof.

### 4. DNS Preflight

Before changing records:

- export the current DNS records;
- identify existing `A`, `AAAA`, or `CNAME` records for the host;
- lower TTL if the provider supports it;
- keep Cloudflare proxying disabled until Recursiv TLS is green unless Recursiv explicitly supports proxied setup;
- preserve MX, TXT, verification, email, and unrelated app records;
- document rollback values.

Do not switch nameservers as part of an app cutover unless the task is specifically a nameserver migration. For normal custom-domain cutover, change only the target host record.

### 5. Cutover

After Recursiv provides the exact target, update only the intended host record. Typical shape:

```text
www.customer.com CNAME <slug>.on.recursiv.io
```

If the DNS provider uses an alias UI, use the equivalent DNS-only target. Do not remove the legacy provider binding yet.

### 6. Post-Cutover Proof

Run live proof from outside assumptions:

```bash
curl -I -sS https://www.customer.com
curl -sS https://www.customer.com | head
```

Required proof:

- HTTP 200 or intended redirect;
- no legacy host headers, such as `server: Vercel`, when the target should be Recursiv;
- TLS certificate is valid for the custom domain;
- page content matches the Recursiv-hosted app;
- app health endpoints return Recursiv-backed data;
- canonical links and sitemap do not point users back to the legacy host unless intentional.

For Inverted World, rerun:

```bash
pnpm recursiv:cutover
```

Only call the cutover successful when `customDomainRecursivProven` and `dnsCutoverReady` are both true.

### 7. Legacy Cleanup

Wait until the custom domain has served the Recursiv app cleanly for a monitoring window, then:

- remove the domain binding from the legacy host;
- remove provider keys from the legacy host;
- keep the rollback record values in the cutover artifact;
- confirm the legacy host no longer receives traffic for the custom domain.

### 8. Rollback

If Recursiv TLS, routing, or app health fails after DNS cutover:

1. restore the previous DNS record;
2. verify the legacy host returns the app;
3. leave the Recursiv binding in place for debugging unless it is actively harming traffic;
4. document the failure and rerun hosted URL proof before attempting again.

## Inverted World Status

As of a live check on May 23, 2026:

- `https://www.inverted.world` returns `server: Vercel` and `x-vercel-id`, so the custom domain is still on Vercel.
- `https://invertedworld.on.recursiv.io` returns the Recursiv-hosted app.
- The next platform step is a Recursiv custom-domain binding for `www.inverted.world`.
- DNS should stay unchanged until that binding is created and proven.
