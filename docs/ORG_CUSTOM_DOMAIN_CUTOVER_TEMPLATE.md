# Org Custom Domain Cutover Template

Use this template for every Recursiv-hosted org site before touching DNS. It is intentionally proof-first: the custom domain only moves after the Recursiv-hosted URL and the Recursiv custom-domain binding are both proven.

## Cutover Packet

```text
Site:
Org:
Recursiv project:
Recursiv slug host:
Custom host:
Apex host:
Current host:
DNS provider:
Registrar:
Legacy deployment provider:
Rollback owner:
Rollback DNS value:
Monitoring owner:
Proof artifact:
```

## Required Gates

### 1. Hosted URL

```bash
pnpm recursiv:domain:preflight -- \
  --slug=<slug>.on.recursiv.io \
  --custom-domain=www.example.com \
  --expected-text="Product name" \
  --output=/private/tmp/<org>-custom-domain-preflight.json \
  --require=hosted
```

The Recursiv slug host must return the expected app over HTTPS. If it does not, stop. Fix deployment, routing, app boot, or content before custom-domain work.

### 2. Recursiv Project Binding

Create the domain binding in Recursiv before changing DNS. The binding proof must show:

- project id and slug;
- custom hostname;
- target Recursiv host;
- ownership verification state, if required;
- TLS/certificate state, if available;
- latest deployment metadata or domain API output that includes the custom hostname.

For projects that use the deploy API:

```bash
pnpm recursiv:deploy -- --custom-domain=www.example.com
```

Then run the project-specific readiness command, or rerun:

```bash
pnpm recursiv:domain:preflight -- \
  --slug=<slug>.on.recursiv.io \
  --custom-domain=www.example.com \
  --expected-text="Product name" \
  --binding-proven \
  --output=/private/tmp/<org>-custom-domain-binding-proof.json \
  --require=dns-change
```

Do not treat `--binding-proven` as proof by itself. It is a local assertion that must be backed by Recursiv project/domain evidence.

### 3. DNS Preflight

Before editing records:

- export current DNS records;
- identify only the `A`, `AAAA`, or `CNAME` record for the intended host;
- preserve MX, TXT, email verification, analytics verification, and unrelated app records;
- lower TTL when the provider supports it;
- keep Cloudflare proxying DNS-only unless Recursiv explicitly supports proxied setup for that domain;
- write down rollback values.

Do not switch nameservers for an app cutover unless the task is explicitly a nameserver migration. For normal site cutover, change one host record.

### 4. DNS Change

Use the target Recursiv gives for that project. The common `www` shape is:

```text
www.example.com CNAME <slug>.on.recursiv.io
```

Cut over `www` first. Handle the apex only after `www` is green and the DNS provider supports the required apex behavior, such as ALIAS, ANAME, or CNAME flattening.

### 5. Post-Cutover Proof

Run live proof:

```bash
pnpm recursiv:domain:preflight -- \
  --slug=<slug>.on.recursiv.io \
  --custom-domain=www.example.com \
  --expected-text="Product name" \
  --binding-proven \
  --output=/private/tmp/<org>-custom-domain-cutover-proof.json \
  --require=cutover
curl -I -sS https://www.example.com
```

Required result:

- custom hostname returns HTTPS 200 or the intended redirect;
- custom hostname shows the Recursiv app content;
- custom hostname no longer shows legacy host headers;
- TLS certificate is valid for the custom hostname;
- app health/data endpoints return the expected Recursiv-backed state;
- canonical URLs and sitemap point to the desired production host.

### 6. Legacy Cleanup

After a monitoring window:

- remove the custom-domain binding from the legacy host;
- remove provider keys from the legacy host;
- confirm traffic no longer reaches the legacy host for the custom hostname;
- keep the rollback values in the cutover packet.

## Recursiv Product Requirement

Every Recursiv org/site should expose this flow through the platform, not only through local scripts:

- Domains tab on each project with the slug host, requested custom hosts, verification records, serving target, and TLS status.
- A pre-DNS gate that refuses to mark a domain ready until the project has a healthy hosted deployment and the custom-domain binding exists.
- A post-DNS gate that checks HTTPS, expected content, no legacy host headers, and app health/data endpoints.
- A final cleanup gate for removing the legacy host binding and legacy provider secrets after a monitoring window.
- Downloadable no-secret proof artifacts for support handoff and customer confidence.

## Inverted World Example

Current command:

```bash
pnpm recursiv:domain:preflight -- \
  --slug=invertedworld.on.recursiv.io \
  --custom-domain=www.inverted.world \
  --expected-text="Inverted World" \
  --output=/private/tmp/inverted-world-domain-preflight.json \
  --require=hosted
```

As of May 23, 2026 at `15:34Z`, the Recursiv slug host returned HTTP 200, while `www.inverted.world` still returned Vercel headers. DNS should remain unchanged until the Recursiv custom-domain binding for `www.inverted.world` is created and proven.
