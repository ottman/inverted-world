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
```

## Required Gates

### 1. Hosted URL

```bash
pnpm recursiv:domain:preflight -- --slug=<slug>.on.recursiv.io --custom-domain=www.example.com --expected-text="Product name"
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
pnpm recursiv:domain:preflight -- --slug=<slug>.on.recursiv.io --custom-domain=www.example.com --expected-text="Product name" --binding-proven
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
pnpm recursiv:domain:preflight -- --slug=<slug>.on.recursiv.io --custom-domain=www.example.com --expected-text="Product name" --binding-proven
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

## Inverted World Example

Current command:

```bash
pnpm recursiv:domain:preflight -- --slug=invertedworld.on.recursiv.io --custom-domain=www.inverted.world --expected-text="Inverted World"
```

As of May 23, 2026 at `13:56Z`, the Recursiv slug host returned HTTP 200, while `www.inverted.world` still returned Vercel headers. DNS should remain unchanged until the Recursiv custom-domain binding for `www.inverted.world` is created and proven.
