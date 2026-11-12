# Working on Prompter for Everyone

This is a small React + TypeScript + Vite browser teleprompter. Read `README.md` and `docs/ARCHITECTURE.md` before changing behavior.

## Commands

Use Node.js 24 LTS and the committed npm lockfile:

```sh
npm ci
npm run dev
npm test
npm run build
```

The app builds to `dist/` and runs on a static HTTPS host. `npm run preview` serves a local production preview. Deployment instructions are in `docs/DEPLOYMENT.md`.

## Boundaries to preserve

- Each visitor owns a separate, browser-local script library. There is no backend, authentication, global script pool or automatic device sync.
- Do not add accounts, remote storage, telemetry, paid APIs or AI runtime calls unless the user asks for them.
- Keep validation and the storage format/version in `src/lib/storage.ts`. Treat stored data as untrusted input. Surface persistence errors rather than silently dropping or overwriting data.
- Keep scripts, names, credentials and URLs from private deployments out of source code, fixtures and documentation.
- The camera video is saved without the on-screen prompter text. Videos are not uploaded or persisted automatically.
- Clean up media tracks, active recording, animation frames, timers and Blob URLs on exit, cancellation, retry and unmount. A late camera permission result must not leave a live stream after the studio has closed.
- Preserve direct desktop downloads and the mobile sharing fallback. A mobile share cancellation should not start an unwanted download.
- Camera permissions require HTTPS or localhost. Do not suggest disabling browser security or treating an HTTP LAN address as secure.
- Keep the Vite base path relative so the static app can be deployed under a subdirectory such as GitHub Pages.

## Verification

Run `npm test` and `npm run build` after functional changes. Add focused regression tests for changed persistence or media behavior. Use synthetic or disposable local data for browser tests; do not change real user scripts to demonstrate a feature.

When reporting browser testing, distinguish simulated devices or automated tests from physical iPhone, Android or Mac/Safari testing. Do not claim deployment or device verification that was not performed.

Keep changes within the request. Favor a short, clear implementation over new infrastructure or abstractions that the app does not need.
