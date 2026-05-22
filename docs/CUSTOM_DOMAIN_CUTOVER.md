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
- Recursiv archive API proof, including `sourceMode` and archive count;
- HTTP and DNS proof for `https://www.inverted.world`;
- active Recursiv scheduled job count and missing jobs;
- latest hosted provider-health blockers for the full AI product;
- separate `publicHostingReady`, `fullAiProductReady`, and `dnsCutoverReady` decisions;
- a `dnsCutoverReady` boolean.

## Cutover Rules

- `recursivHostingProven` must be `true`.
- `recursivArchiveDataReady` must be `true`.
- `publicHostingReady` must be `true`.
- Recursiv custom-domain binding must be created and proven before changing DNS or removing the Vercel domain binding.
- `dnsCutoverReady` must be `true` before any DNS record is changed.
- If `keepDnsOnVercel` is `true`, leave DNS unchanged.

`fullAiProductReady` is stricter than public hosting readiness. Required hosted providers should still be green before calling the whole AI news product production-complete, especially `x-api` and `youtube-data-api`, but provider account failures are not DNS fixes.

## Current Expected State

The custom domain may still report Vercel headers while Recursiv is being proven on `invertedworld.on.recursiv.io`. That is acceptable until the cutover gates pass.

As of May 22, 2026, `invertedworld.on.recursiv.io` is proven live and the public archive API reads Recursiv database data. The known full-product blockers are provider/account-side: X API access returns `402`, and YouTube Data API access returns `403`. Fix those provider issues for the full AI news product, but do not treat them as DNS changes.
