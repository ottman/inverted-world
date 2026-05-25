# Inverted World Security Audit

Date: 2026-05-25

## Scope

Audited the Recursiv-hosted Next app in `/Users/billottman/dev/inverted_world`, including public API routes, scheduled job routes, Recursiv database access, chat flows, provider fallback policy, secrets handling, dependency advisories, and production headers.

## Current Result

The app is materially safer after this audit pass:

- Public provider fallback audit is green: public pages and public API routes do not directly call third-party provider APIs.
- Tracked secret scan did not find committed provider keys. Local `.env.local` and `.vercel/.env.development.local` exist but are ignored.
- Scheduled Recursiv job routes require `CRON_SECRET`, and comparison is now constant-time.
- Dossier chat history is now scoped by `conversationId`; unauthenticated visitors no longer receive the latest global chat messages for a story.
- Public article and dossier chat POSTs now have request body caps and in-memory IP rate limits.
- Baseline security headers are configured globally.
- Production builds now run TypeScript validation instead of ignoring build errors.

## Fixed In This Pass

1. Public dossier chat history leak

   Previous behavior:
   `/api/dossiers/[slug]/chat?limit=6` returned the latest stored chat rows for the whole dossier, regardless of visitor or conversation.

   Fix:
   The client now uses a browser-local conversation ID, and the API only returns rows for an explicit `conversationId`. Requests without one return an empty history.

2. Public chat cost and spam surface

   Previous behavior:
   Public chat POSTs could call the Recursiv agent or write chat rows without rate limiting or body-size caps.

   Fix:
   Added per-route IP rate limits and 16 KB JSON body caps for dossier and article chat endpoints.

3. Cron secret comparison

   Previous behavior:
   `CRON_SECRET` was compared with direct string equality.

   Fix:
   Switched to `timingSafeEqual` with equal-length buffer checks.

4. Missing baseline browser hardening headers

   Previous behavior:
   No global CSP/frame/object/base/referrer/permissions/content-type headers were configured.

   Fix:
   Added conservative global headers:

   - `Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'self'`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`

5. Type checking disabled in production build

   Previous behavior:
   `next.config.mjs` set `typescript.ignoreBuildErrors = true`.

   Fix:
   Removed that setting. `pnpm build` now checks TypeScript validity.

## Open Findings

### High: Next.js version has active advisories

`bun audit --json` reports multiple advisories against `next@14.2.25`, including high-severity Server Components DoS and SSRF/cache-related advisories. This app is self-hosted, public, and App Router based, so this should be treated as a production security upgrade item.

Recommended fix:
Upgrade Next and `eslint-config-next` to a patched line, then rerun build and live proof. Because this may be a major framework upgrade, do it as a separate controlled deployment.

### Medium: Public AI chat still needs durable abuse controls

The new in-memory limiter is a local guard, not a distributed production abuse system. It resets on process restart and does not coordinate across instances.

Recommended fix:
Move rate limiting to a durable Recursiv/edge-backed store, add a per-session daily budget, and consider auth or proof-of-work/CAPTCHA for agent-backed responses.

### Medium: Markdown link rendering should include `noopener`

The chat Markdown renderer limits links to `http(s)` and relative URLs and React escapes text, which reduces XSS risk. External links currently use `rel="noreferrer"`; add `noopener` explicitly for defense in depth.

### Medium: Public release/status endpoints expose operational metadata

`/api/release` and `/api/pipeline` intentionally expose project/release/read-health information. This is useful for operations but gives attackers reconnaissance data.

Recommended fix:
Keep public payloads minimal and add a private/admin variant for deeper diagnostics if the site grows.

### Low: `.env.example` includes concrete Recursiv org/project/agent IDs

These are not provider secrets and are already public-ish in release metadata, but they increase environment specificity in a public repo.

Recommended fix:
Replace concrete IDs with placeholders in `.env.example` and keep real IDs in Recursiv/Infisical/operator docs.

## Checks Run

- `pnpm audit:public-providers`: passed.
- tracked-file secret pattern scan: no committed provider key found; only false positives from normal URLs and IDs.
- `bun audit --json`: found dependency advisories, primarily `next@14.2.25`.
- `pnpm lint`: passed.
- `pnpm exec tsc --noEmit --incremental false`: passed.
- `pnpm build`: passed with type validation enabled.
- Local HTTP probe confirmed:
  - dossier chat GET without `conversationId` returns zero messages;
  - dossier chat GET with a scoped `conversationId` returns only that conversation;
  - dossier chat POST with `contextOnly` works;
  - new security headers are present.
