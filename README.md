# Inverted World

Standalone Expo app for Inverted World, backed by Recursiv auth, API keys,
database, and agent infrastructure.

## Run

```bash
npm install
npm run web
```

## Environment

Copy `.env.example` to `.env.local` and keep secrets out of git.

The Expo app uses public Recursiv organization/project identifiers and creates
per-user API keys after sign-up or sign-in. API keys are stored locally with
SecureStore on native and AsyncStorage on web.

## Product Shape

- First screen: Inverted World research prompt, animated full-bleed background,
  latest YouTube embed, and signal lanes.
- Archive: indexable episode dossier routes under `/archive/[videoId]`.
- Research: Recursiv-backed agent desk using a Claude model through the
  platform agent layer.
- Auth: email sign-up/sign-in flow adapted from Kempt-style standalone apps.

## Notes

This repo is intentionally separate from the Recursiv monorepo so it can be
owned, versioned, and deployed as the Inverted World product.
