# Custom Domain Cutover

Do not move `www.inverted.world` until Recursiv hosting, public Recursiv data, and the custom-domain binding path are proven live.

## Proof Command

Run:

```bash
pnpm recursiv:cutover
```

When Recursiv API calls are rate-limited, run the public-only proof without consuming the Recursiv API budget:

```bash
pnpm recursiv:cutover:public
```

Public-only proof checks HTTP and DNS surfaces but skips Recursiv project, deployment, scheduled-job, provider-health, and pipeline database checks. It is useful evidence during API cooldowns, but it is not sufficient for DNS cutover.

The command prints a redacted JSON report with:

- latest Recursiv deployment status;
- HTTP proof for `https://invertedworld.on.recursiv.io`;
- `/news` source-board proof, including direct external source links and internal Inverted World context links;
- representative `/news/[articleId]` story-page proof, including on-page sources, Tales archive context, and Ask This Story;
- `/x/secret-programs` signal-page proof, including ranked posts, anchored post cards, and outbound X links;
- `/api/x/secret-programs` freshness proof, requiring at least 12 recent X posts from multiple source modes and a latest post inside 192 hours;
- release proof from `https://invertedworld.on.recursiv.io/api/release`, including the deployed feature marker;
- source-revision proof from `/api/release` when the hosted build exposes `deployment.sourceRevision` from a commit environment variable or the commit-shaped Next build id, or from authenticated Recursiv deployment metadata when the runtime cannot expose either;
- public provider-fallback audit proof from `pnpm audit:public-providers`;
- Recursiv deployment-domain proof that distinguishes the platform slug host from a configured custom-domain binding;
- Recursiv archive API proof, including `sourceMode`, data-source classification, archive count, required topic coverage, and dominant-topic balance;
- published article API proof from `/api/articles`, including Recursiv-backed source mode, direct external source links, generated thumbnails, topic spread, and clean non-templated full-story bodies;
- removed public source-shelf proof requiring `/documents` and `/api/documents` to return 404 until that experience is rebuilt;
- Ask This Story proof from `/api/dossiers/[slug]/chat` and `/api/articles/[articleId]/chat`, requiring no-write sourced Markdown with source and archive links;
- latest full-pipeline status and `sourceMode` from `/api/pipeline`, including a completion timestamp inside 36 hours;
- front-page edition and site ticker proof from `/api/front-page`, including direct news, X, archive targets, and an edition or pipeline timestamp inside 36 hours;
- daily autopost packet proof from `/api/autopost/daily`, including Recursiv-backed source mode, publish-ready status, source pack, headline variants, X thread copy, image prompts, guardrails, and direct story/X/archive links;
- removed public media-surface proof requiring `/media` and `/api/media` to return 404 until that experience is rebuilt;
- HTTP and DNS proof for `https://www.inverted.world`;
- active Recursiv scheduled job count and missing jobs;
- latest hosted provider-health blockers for the full AI product;
- separate `publicHostingReady`, `fullAiProductReady`, `dnsChangeReady`, and `dnsCutoverReady` decisions;
- a `dnsCutoverReady` boolean.

Save the same redacted proof packet when an operator needs an artifact for handoff:

```bash
pnpm recursiv:cutover -- --output=/private/tmp/inverted-world-cutover-proof.json
pnpm recursiv:cutover:public -- --output=/private/tmp/inverted-world-cutover-public-proof.json
```

The output file contains the same no-secret report printed to stdout.

## Cutover Rules

- `recursivHostingProven` must be `true`.
- If `recursivHostedUrl` passes but `recursivDeploymentCompleted` is `unknown`, HTTP proof is good but deployment proof is incomplete. Do not treat that as a DNS-ready state.
- `newsPage` must pass, proving `/news` renders the source-board page with direct external source links and internal Inverted World context links.
- `articleStoryPage` must pass, proving a representative article detail page renders external source links, Tales archive context, and Ask This Story instead of a generic keep-reading dead end.
- `xSignalPage` must pass, proving `/x/secret-programs` renders ranked X posts with anchored cards, outbound X links, and no empty lane state.
- `xSignalApi` and `xSignalFreshness` must pass, proving `/api/x/secret-programs` has enough recent X posts from multiple persisted/source modes.
- `releaseCommit` must be `pass`. Full readiness may prove this from `/api/release` or from authenticated Recursiv deployment metadata. `unknown` means neither source exposes a revision yet, and `fail` means the deployed revision is not the expected commit.
- `publicProviderFallbackAudit` must be `pass`, proving public `app/` routes and pages do not call provider-capable helpers without `allowProviderFallbacks: false`.
- `recursivManifestAudit` must be `pass`, proving the desired Recursiv tables, scheduled job manifest, cutover expected jobs, job route files, and scheduler endpoint options are aligned.
- `recursivArchiveDataReady` must be `true`. This can be live `recursiv-database` or `recursiv-snapshot`, but it must not be `seed`, `static`, RSS, YouTube API, or direct provider fallback data.
- `recursivArchiveTopicCoverage` must pass, proving the archive has at least 12 videos in each core topic and no single topic is more than 70% of the archive.
- `articlesApi` must pass, proving `/api/articles` returns at least 12 Recursiv-backed full-story articles across at least four topics, with at least eight direct external source links, generated thumbnails, no repeated lane prefixes in headlines, and no templated `Signal` / `Source split` / `Viral frame` bodies.
- `pipelineApi` and `pipelineFreshness` must pass, proving `/api/pipeline` exposes a succeeded full-pipeline run from live Recursiv database rows or the committed Recursiv snapshot fallback completed inside 36 hours.
- `frontPageApi` and `frontPageFreshness` must pass, proving `/api/front-page` exposes a Recursiv-backed edition tied to an edition or pipeline timestamp inside 36 hours and direct ticker targets into stories, X signals, and archive items.
- `autopostApi` must pass, proving `/api/autopost/daily` exposes a Recursiv-backed, publish-ready daily distribution packet with enough sources, headlines, thread posts, image prompts, guardrails, and direct story/X/archive links.
- `publicSourceShelfRemoved` must pass, proving the disabled public source shelf is not reachable on the hosted build.
- `publicMediaSurfaceRemoved` must pass, proving the disabled public media library is not reachable on the hosted build.
- `dossierChatApi` and `articleChatApi` must pass, proving Ask This Story can return sourced Markdown without requiring a writable agent conversation on dossier-backed or article-only story pages.
- `publicHostingReady` must be `true`.
- Recursiv custom-domain binding must be created and proven before changing DNS or removing the Vercel domain binding.
- `customDomainBindingConfigured` must be `true` before any DNS record is changed. It proves the latest Recursiv deployment advertises both the slug host and the requested custom hostname.
- `dnsChangeReady` means it is safe to plan the `www` record change. It is not the same as finished cutover.
- `dnsCutoverReady` means the custom hostname itself is already serving the Recursiv app after DNS propagation.
- If `keepDnsOnVercel` is `true`, leave DNS unchanged.

`recursiv-snapshot` means the public app is reading a generated export of persisted Recursiv database rows while the runtime database API key is unhealthy or rate-limited. This is acceptable proof that the public pages are not falling back to direct provider keys, seed-only data, or hand-authored static UI, but it is not the same as live database health.

Refresh that exported fallback with:

```bash
pnpm recursiv:snapshot:status
pnpm recursiv:snapshot
```

The command writes the news/archive/X/front-page snapshot and the media/document snapshot from Recursiv Postgres. Use `pnpm recursiv:snapshot -- --dry-run` to validate counts without rewriting files. It should be run only from a local/proof environment with a protected direct database URL; do not add that URL to the repo or to public runtime code.

`pnpm recursiv:snapshot:status` is safe during API cooldowns because it reads only committed local snapshot files. It is the quick way to see when the snapshot-backed pipeline/front-page freshness gates will expire and whether a protected direct database URL is available to refresh them.

Trigger or inspect the Recursiv deployment with:

```bash
pnpm recursiv:deploy
pnpm recursiv:deploy:status
```

The deploy command uses bounded direct Recursiv API calls and prints the selected local key source, not the key. If it returns `401`, rotate or select the correct local Recursiv key. If it returns `429`, wait for the rate limit to reset or use a healthy project/org key before retrying. A pushed commit is not enough for DNS cutover; the hosted URL must return the new route and the deployment status must be proven.

Preview the deployment payload without calling Recursiv:

```bash
pnpm recursiv:migration:status
pnpm recursiv:migration:next
pnpm recursiv:deploy:window
pnpm recursiv:deploy:dry-run
pnpm recursiv:deploy:dry-run -- --custom-domain=www.inverted.world
```

`recursiv:migration:status` is the fastest operator packet during cooldowns. It does not call Recursiv; it combines the deploy window, snapshot freshness, latest local proof, latest public proof, and DNS decision into one no-secret JSON report. `recursiv:migration:next` turns that status into a guarded resume plan with exact commands for snapshot refresh, build, slug deploy, no-secret hosted-route preflight, full hosted proof, custom-domain binding, no-secret binding preflight, full binding proof, and the final manual DNS step. It marks which commands call the Recursiv API and keeps DNS as an explicit last manual action. `recursiv:deploy:window` is the narrower deploy-only check; it prints whether the local deploy guard is ready, the exact current commit payload for `www.inverted.world`, the next allowed retry time, the next command to run, and whether the committed Recursiv snapshot is fresh enough for a deployment proof. The deploy helper refuses an actual deploy when the local snapshot freshness gate is already failed unless an operator deliberately passes `--skip-snapshot-preflight`.

Create the pre-DNS custom-domain binding after public hosting and Recursiv API health are green:

```bash
pnpm recursiv:deploy:custom-domain
pnpm recursiv:deploy:custom-domain:wait
```

This still does not change DNS. The `:wait` variant polls deployment status until the latest deployment is completed or fails, without printing secrets. It should make the latest Recursiv deployment metadata include both `invertedworld.on.recursiv.io` and `www.inverted.world`; rerun `pnpm recursiv:cutover` and require `customDomainBindingConfigured: true` plus `dnsChangeReady: true` before planning the DNS record edit.

`fullAiProductReady` is stricter than public hosting readiness. Required hosted providers should still be green before calling the whole AI news product production-complete, especially `recursiv-database`, `x-api`, and `youtube-data-api`, but provider account failures are not DNS fixes. YouTube RSS is an opportunistic public fallback; it should not block cutover when the public channel-page fallback and persisted Recursiv archive are live but the RSS endpoint returns 404.

## Current Expected State

As of the latest public-only proof, `invertedworld.on.recursiv.io` is live but the hosted build has not yet caught up to the latest pushed repo commit. Treat the Recursiv slug as available, not DNS-ready.

Current live proof:

- `https://invertedworld.on.recursiv.io` returns HTTP 200 with the Inverted World app.
- `https://www.inverted.world` returns HTTP 200 with `server: Vercel` and `x-vercel-id`, so the custom domain is still on the legacy host.
- The repo no longer exposes public `/documents`, `/api/documents`, `/media`, or `/api/media` endpoints. The stale Recursiv slug can still show the old shelves until the next Recursiv deploy; do not treat that stale hosted surface as DNS-ready.
- `/x/secret-programs` returns HTTP 200 with 26 outbound X links, 19 anchored post cards, and 38 ticker anchor links.
- `/api/x/secret-programs?limit=24` returns 19 recent Declassified X posts from two source modes, with the latest post age inside the freshness window.
- `/api/archive?limit=1000` returns `sourceMode: "recursiv-snapshot"`, 437 archive videos, no warnings, all six core topics above the minimum coverage threshold, no topic above the 70% dominance threshold, and `hasMore: false`.
- `/api/articles` currently returns 8 articles and 8 generated thumbnails on the hosted build, but it does not expose Recursiv `sourceMode`, does not meet the 12-article cutover gate, does not prove direct external source links, and can still surface templated briefs. The current local built proof returns `sourceMode: "recursiv-snapshot"` with 13 full-story articles, 13 direct external source links, 13 generated thumbnails, six topics, and `templatedArticleCount: 0`; deploy the latest pushed build before considering the article gate live.
- The repo exposes `/api/front-page` with `sourceMode` and direct Recursiv-backed ticker items, but the hosted build must be redeployed before this can pass publicly.
- The stale hosted build still returns `/documents`, `/api/documents`, `/media`, and `/api/media`; the next deploy must make all four return 404.
- `/api/release` still returns `pipelineSnapshotFallback: false` and release `worldwire-persistence-v2` on the hosted app, so the current hosted build is older than the pushed repo.
- `releaseCommit` is `unknown` because the hosted app does not expose `deployment.sourceRevision` yet.
- `/api/pipeline?limit=1` returns `sourceMode: "unavailable"` with `readHealthLastErrorStatus: 429`, so the hosted pipeline status fallback and 36-hour freshness proof are not live until the newer commit is deployed.
- `/api/front-page` exposes the latest pipeline timestamp, but the hosted build still returns zero ticker items and no `sourceMode`, so `frontPageApi` remains blocked until redeploy.

Earlier full readiness runs proved the Recursiv database, scheduled jobs, provider-health row, and successful full-pipeline run, but those authenticated checks are not current while the Recursiv key is under a per-day deploy/status cooldown. Use them as historical context only; rerun full `pnpm recursiv:cutover` after API health returns.

The current local build includes the expected `/api/release` marker, `/api/pipeline` snapshot fallback, article pages with visible source and Tales context, sourced Markdown Ask This Story routes for dossiers and article-only stories, and Recursiv-backed article API. The next required platform step is to deploy the latest repo commit to Recursiv, create the custom-domain binding for `www.inverted.world`, and rerun full cutover proof.

The direct custom-domain binding attempt on May 23, 2026 at `13:44Z` used `pnpm recursiv:deploy:custom-domain` and returned `429 rate_limit_exceeded` with the API message `per-day`. The deploy helper normalizes that to a daily guard from the recorded time. Do not retry the binding path with the same key until a healthy Recursiv key is installed or the actual daily limit is known to have reset.

The known full-product blockers are provider/account-side, not DNS fixes. A fresh hosted provider-readiness check on May 23, 2026 reports `recursiv-database` as live and narrows the required blocking providers to `x-api` and `youtube-data-api`. The configured YouTube channel ID still resolves through the public channel page, but the YouTube RSS endpoint returns 404; treat RSS as non-blocking while recent upload refresh can use the public channel-page fallback and archive completeness is enforced through YouTube Data API plus persisted Recursiv rows. The app accepts `YOUTUBE_API_KEY`, `YOUTUBE_DATA_API_KEY`, `GOOGLE_YOUTUBE_API_KEY`, or `GOOGLE_API_KEY`; production should prefer `YOUTUBE_API_KEY` for clarity.

## Current Decision

As of the latest public-only proof:

- `publicHostingReady: false`
- `fullAiProductReady: false`
- `customDomainBindingConfigured: false`
- `dnsChangeReady: false`
- `customDomainRecursivProven: false`
- `dnsCutoverReady: false`
- `keepDnsOnVercel: true`

Next step is not a DNS change. Restore Recursiv API health or wait for the true daily limit reset, deploy the latest pushed commit, create and prove the Recursiv custom-domain binding for `www.inverted.world`, then rerun `pnpm recursiv:cutover`. Only after `customDomainBindingConfigured` and `dnsChangeReady` are true should the DNS host change be planned. Only after `customDomainRecursivProven` and `dnsCutoverReady` are true should the cutover be called complete.

## Reusable Org Custom-Domain Process

Use this sequence for every Recursiv-hosted org site. The goal is a repeatable cutover with proof at each step, not a one-off DNS guess.

For new orgs, copy the operator packet in [ORG_CUSTOM_DOMAIN_CUTOVER_TEMPLATE.md](./ORG_CUSTOM_DOMAIN_CUTOVER_TEMPLATE.md) and attach the final command output to the customer or internal handoff. The no-secret preflight command is:

```bash
pnpm recursiv:domain:preflight -- \
  --slug=<slug>.on.recursiv.io \
  --custom-domain=www.customer.com \
  --expected-text="Customer" \
  --path=/health::ok \
  --path=/dashboard::"Customer" \
  --json-check=/api/status::sourceMode::eq::recursiv-database \
  --json-check=/api/status::itemCount::gte::12 \
  --output=/private/tmp/<org>-custom-domain-preflight.json \
  --require=hosted
```

That command proves the current HTTP/DNS posture and required product routes without calling Recursiv deploy/status APIs. It does not replace the Recursiv custom-domain binding proof. Use `--path=/route::expected text` for app-specific health, dashboard, or rendered content routes. Use `--status-check=/route::status` for status-code contracts such as intentionally removed public routes, disabled legacy endpoints, redirects, auth gates, or health routes. Use `--json-check=/api/path::json.path::operator::expected` for structured API gates such as source mode, item counts, direct-source counts, freshness booleans, and ticker breadth. Supported operators are `exists`, `truthy`, `falsy`, `eq`, `neq`, `contains`, `includes`, `gt`, `gte`, `lt`, and `lte`; use `.length` for array, string, or object counts. Use `--require=dns-change` after the binding is proven and `--require=cutover` after DNS is changed to make the same proof suitable for CI or support handoff.

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
- app-specific product routes, APIs, or data surfaces return expected content;
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

Do not paste the API key into logs or docs. The deploy helper reads the protected local key file or environment and prints only the key source. After the deploy completes, the latest deployment metadata should include both `<slug>.on.recursiv.io` and `www.customer.com`; that is the pre-DNS custom-domain binding proof. Save the proof artifact with `--output` and keep it with the cutover packet.

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
pnpm recursiv:domain:preflight -- \
  --slug=<slug>.on.recursiv.io \
  --custom-domain=www.customer.com \
  --expected-text="Customer" \
  --path=/health::ok \
  --path=/dashboard::"Customer" \
  --json-check=/api/status::sourceMode::eq::recursiv-database \
  --json-check=/api/status::itemCount::gte::12 \
  --binding-proven \
  --output=/private/tmp/<org>-custom-domain-cutover-proof.json \
  --require=cutover
curl -I -sS https://www.customer.com
```

Required proof:

- HTTP 200 or intended redirect;
- no legacy host headers, such as `server: Vercel`, when the target should be Recursiv;
- TLS certificate is valid for the custom domain;
- page content matches the Recursiv-hosted app;
- app health endpoints, product routes, and data APIs return Recursiv-backed data;
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

As of a live check on May 23, 2026 at `23:36Z`:

- `https://www.inverted.world` returns HTTP 200 with `server: Vercel` and `x-vercel-id`, so the custom domain is still on Vercel.
- `https://www.inverted.world` currently resolves to legacy Vercel IPs such as `64.29.17.1` and `216.198.79.65`.
- `https://invertedworld.on.recursiv.io` returns HTTP 200 with the Recursiv-hosted Inverted World app.
- Route-aware public proof shows the Recursiv slug host serves `/news`, `/x/secret-programs`, and `/api/release`, but `/api/release` is stale and the custom domain still fails route-aware cutover proof because it is on the legacy host.
- The next platform step is a Recursiv custom-domain binding for `www.inverted.world`.
- DNS should stay unchanged until that binding is created and proven.
