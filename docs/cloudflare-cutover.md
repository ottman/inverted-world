# inverted.world — Cloudflare cutover & domain hardening

Operator runbook for putting `inverted.world` behind Cloudflare (hide the origin,
add WAF/cache/Always-Online) and decoupling the public site from the Coolify
"every deploy drops www" bug.

## Current state (pre-staged — live site untouched)

- A Cloudflare zone for `inverted.world` exists in the **Recursiv** account
  (`0f1e7d77d741efe733cb683bf905d1d0` — the same account as `recursiv.io`),
  status **pending** (nameservers not switched yet, so nothing is live).
- DNS in that zone:
  - `www.inverted.world` → CNAME → `invertedworld.on.recursiv.io` **(proxied)** — the app; proxying hides the origin IP, adds WAF + cache + Always-Online.
  - `inverted.world` (apex) → `A 192.0.2.1` **(proxied)** — a placeholder so the edge answers and the apex redirect rule fires (the origin is never contacted).
  - `CAA` `issue` for `letsencrypt.org`, `pki.goog`, `sectigo.com`.
- Zone settings: SSL **Full**, Always Use HTTPS, Auto HTTPS Rewrites, Min TLS 1.2,
  Brotli, **HSTS** (max-age 31536000, includeSubDomains).
- Cloudflare nameservers assigned: `konnor.ns.cloudflare.com`, `lovisa.ns.cloudflare.com`.

The credential that manages this zone is in Infisical (`prod`):
`CLOUDFLARE_DNS_API_TOKEN` + `CLOUDFLARE_DNS_ACCOUNT_ID`. NOTE: that token is an
account-owned token (`cfat_…`), so the Cloudflare **Page Rules** and **Rulesets**
APIs reject it — the redirect/origin rules below must be created in the dashboard
or with a user-owned token that has Dynamic-Redirect / Transform-Rules edit.

## Step 1 — Apex → www redirect (REQUIRED before cutover)

Without this, apex visitors hit the `192.0.2.1` placeholder and dead-end after
cutover (`www` works regardless, but bare `inverted.world` would break).

Dashboard → **Rules → Redirect Rules → Create rule**:
- When incoming requests match: **URI Full** … or **Hostname `equals` `inverted.world`**
- Then: **Static/Dynamic redirect** → Type **301**, target `https://www.inverted.world` + preserve path & query
  (equivalent Single Redirect expression: `(http.host eq "inverted.world")` →
  `concat("https://www.inverted.world", http.request.uri.path)`).

## Step 2 — Origin Rule (RECOMMENDED — immunizes against the deploy-drops-www bug)

Dashboard → **Rules → Origin Rules → Create rule**:
- When: Hostname `equals` `www.inverted.world`
- Then: **Host Header → Rewrite to** `invertedworld.on.recursiv.io`

This makes Cloudflare always talk to the Coolify **native** host (which never
drops) instead of depending on the `www.inverted.world` binding that every deploy
currently wipes. With this in place the public site stays up even mid-deploy.
(After this, you can safely tighten SSL to **Full (strict)** — the native host
always has a valid cert.)

## Step 3 — Nameserver cutover (at the registrar)

Set `inverted.world`'s nameservers at the registrar to:

```
konnor.ns.cloudflare.com
lovisa.ns.cloudflare.com
```

(Same pair as `recursiv.io`, since the zone is in the same account.) Propagation
is seamless — old resolvers use Vercel, new ones use Cloudflare, and both point
`www` at the same working origin, so there's no downtime window.

## Step 4 — Verify

```bash
dig +short NS inverted.world                                   # → the two cloudflare.com NS
curl -sI https://www.inverted.world/ | grep -i 'cf-ray\|server'  # → server: cloudflare, cf-ray present
curl -sI https://inverted.world/ | grep -i location              # → 301 to https://www.inverted.world/
```

Once `cf-ray` appears, the origin IP (`34.71.80.160`) is no longer reachable from
public DNS.

## Rollback

Nothing is committed until the nameservers are switched. To back out: at the
registrar, point the nameservers back to Vercel (`ns1.vercel-dns.com`,
`ns2.vercel-dns.com`), or delete the Cloudflare zone. No origin changes are
involved.

## Follow-ups

- **SSL strict:** after Step 2 (Origin Rule), switch SSL/TLS mode to **Full (strict)**.
  Optionally install a **Cloudflare Origin Certificate** on the Coolify origin to
  remove any dependency on Let's Encrypt renewing through the proxy.
- **Root-cause fix:** PR `recursivlabs/recursiv#1498`
  ("preserve custom domain across redeploys") stops Coolify from dropping `www`
  on every build at the source — complementary to the Origin Rule above.
- **Rotate the token** if its value was ever exposed: roll
  `recursiv-dns-waf` token in the Cloudflare dashboard, then update
  `CLOUDFLARE_DNS_API_TOKEN` in Infisical (`prod`).
