# Monetization setup — Google Ads + Stripe (Inverted World+)

Both are **scaffolded and shipped but OFF**. Each activates by setting env vars (and, for Stripe, a
little more wiring). Nothing renders/charges until you do.

## Google Ads (AdSense) — ready

**To turn on:**
1. Get your AdSense publisher id (`ca-pub-XXXXXXXXXXXXXXXX`).
2. Set env `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXX…` (Coolify env) and redeploy.
   - The loader script (`components/ads/adsense-loader.tsx`) and `/ads.txt` (`app/ads.txt/route.ts`)
     turn on automatically; CSP already allowlists the AdSense domains.
3. Create ad units in the AdSense dashboard and drop `<AdUnit slot="THE_SLOT_ID" />`
   (`components/ads/ad-unit.tsx`) where you want them — e.g. in-feed on `/news`, in-article on story
   pages. Off-state renders nothing, so they're safe to place now.
4. (Later) hide ads for members: gate `<AdUnit>` on `!(await isMember())`.

## Stripe — "Inverted World+" membership — scaffolded, needs wiring

Shipped: the pricing page (`/plus`), the upgrade button, an env-gated checkout route
(`app/api/checkout/route.ts`, returns 503 until configured), and `lib/membership.ts`.

**To turn on:**
1. **Fix the install blocker first:** `npm i stripe` currently fails with `EOVERRIDE` (a pre-existing
   `postcss` override in `package.json` conflicts with a direct dep). Resolve that override, then
   `npm i stripe`.
2. Set env: `STRIPE_SECRET_KEY`, `STRIPE_PLUS_PRICE_ID` (a recurring Price in Stripe), and
   `STRIPE_WEBHOOK_SECRET`.
3. Uncomment the session-creation block in `app/api/checkout/route.ts`.
4. Add the success + webhook handlers:
   - `app/plus/success/route.ts` — verify `session_id` is paid via Stripe, then set the signed
     `iw_plus` membership cookie and redirect home.
   - `app/api/stripe/webhook/route.ts` — verify the signature, handle
     `customer.subscription.deleted` to revoke.
5. Gate premium surfaces on `await isMember()` (ad-free, full archive, unlimited research).

**Design note (decide before launch):** the site has **no user accounts**, so the MVP membership is a
per-browser cookie (no cross-device, easy to lose). A durable paywall needs login (email magic-link or
OAuth) so entitlements attach to a user, not a device. Recommend adding lightweight auth before
charging real money — otherwise members lose access on a new device/cleared cookies.
