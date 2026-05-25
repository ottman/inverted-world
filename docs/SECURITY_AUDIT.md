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
- Public article and dossier chat POSTs now have request body caps, local burst limits, durable Recursiv-backed budgets, and per-conversation daily caps.
- Baseline security headers are configured globally.
- Production builds now run TypeScript validation instead of ignoring build errors.
- Next.js is upgraded to `16.2.6`, the lint stack is on ESLint flat config, and `bun audit --json` returns `{}`.
- Public release/status APIs no longer expose Recursiv project IDs, deployment IDs, build IDs, source revisions, full pipeline errors, or public read-health internals.
- `.env.example` uses placeholders for Recursiv IDs instead of concrete org/project/agent identifiers.

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

   Follow-up fix:
   Added the Recursiv `public_rate_limits` table and API enforcement for cross-instance public chat budgets. Dossier chat enforces an IP minute budget and a per-conversation daily budget before calling the Recursiv agent. If the durable budget store is unavailable, the route returns a source-context fallback instead of making an agent call.

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

6. Next.js dependency advisories

   Previous behavior:
   The app shipped `next@14.2.25`, and `bun audit --json` reported active high-severity Next.js advisories.

   Fix:
   Upgraded to `next@16.2.6` and `eslint-config-next@16.2.6`, moved linting to ESLint 9 flat config, updated App Router dynamic params for the current Next contract, and verified `pnpm build`.

7. Transitive dependency advisories

   Previous behavior:
   The audit also reported `lodash`, `picomatch`, `postcss`, and `ws` advisories.

   Fix:
   Removed the unused Recharts chart helper that pulled in Lodash, refreshed patched transitives, and added package overrides for `picomatch@4.0.4`, `postcss@8.5.15`, and `ws@8.21.0`.

8. Public operational metadata exposure

   Previous behavior:
   `/api/release` exposed deployment/project/build metadata, and `/api/pipeline` exposed read-health internals plus full recent pipeline records.

   Fix:
   `/api/release` now returns only the product release payload and timestamp. `/api/pipeline` now allows only safe public jobs, caps public history, and returns summarized status without IDs, step errors, metadata, or read-health internals.

9. Example environment identifiers

   Previous behavior:
   `.env.example` included concrete Recursiv org/project/agent IDs.

   Fix:
   Replaced those values with placeholders.

## Remaining Follow-Up

No audit blocker remains from this pass.

Recommended future hardening:

- Add a private/admin diagnostics endpoint for deployment and pipeline internals if operators need richer status in production.
- Add auth, CAPTCHA, or proof-of-work to public agent-backed chat if traffic or abuse grows beyond the current durable budget model.
- Consider a stricter CSP after embedded media, analytics, and generated asset hosts are fully enumerated.

## Checks Run

- `pnpm audit:public-providers`: passed.
- tracked-file secret pattern scan: no committed provider key found; only false positives from normal URLs and IDs.
- `bun audit --json`: passed with `{}` after the dependency upgrade and overrides.
- `pnpm lint`: passed.
- `pnpm exec tsc --noEmit --incremental false`: passed.
- `pnpm build`: passed with type validation enabled.
- `pnpm recursiv:provision`: passed; schema now includes `public_rate_limits`.
- `pnpm recursiv:db:probe`: passed; Recursiv database query path is usable.
- Local HTTP probe confirmed:
  - dossier chat GET without `conversationId` returns zero messages;
  - dossier chat GET with a scoped `conversationId` returns only that conversation;
  - dossier chat POST with `contextOnly` works;
  - new security headers are present.
