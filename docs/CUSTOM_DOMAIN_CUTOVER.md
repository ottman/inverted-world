# Custom Domain Cutover

Do not move `www.inverted.world` until Recursiv hosting and backend readiness are both proven live.

## Proof Command

Run:

```bash
pnpm recursiv:cutover
```

The command prints a redacted JSON report with:

- latest Recursiv deployment status;
- HTTP proof for `https://invertedworld.on.recursiv.io`;
- HTTP and DNS proof for `https://www.inverted.world`;
- active Recursiv scheduled job count and missing jobs;
- latest hosted provider-health blockers;
- a `dnsCutoverReady` boolean.

## Cutover Rules

- `recursivHostingProven` must be `true`.
- `backendReady` must be `true`.
- `dnsCutoverReady` must be `true`.
- Required hosted providers must be green, especially `x-api` and `youtube-data-api`.
- Recursiv custom-domain binding must be created and proven before removing the Vercel domain binding.
- If `keepDnsOnVercel` is `true`, leave DNS unchanged.

## Current Expected State

The custom domain may still report Vercel headers while Recursiv is being proven on `invertedworld.on.recursiv.io`. That is acceptable until the cutover gates pass.

Provider/account failures are not DNS problems. Fix provider access first, then re-run the proof command before changing records.
