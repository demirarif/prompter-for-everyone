# Prompter for Everyone

A small, open-source browser teleprompter (autocue) with camera recording. Write a script, adjust the scrolling speed, text width and color, then record and download your video on a phone or computer.

Built with React, TypeScript and Vite. No account, password, backend, database, API key or AI subscription is required. Your script library and reading settings stay in your browser's local storage; video recordings stay in memory until you save them.

[Türkçe kullanım kılavuzu](README.tr.md) · [Deployment](docs/DEPLOYMENT.md) · [Architecture](docs/ARCHITECTURE.md) · [Guide for coding agents](AGENTS.md)

## What it does

- Create, edit and delete scripts, and mark recorded scripts as complete.
- Read scrolling text over the camera preview while recording camera and microphone input. The text is not burned into the saved video.
- Adjust scrolling speed, text width from **20% to 100%**, and white, cream or mint text.
- Preview a recording, record it again, and download or share it using the browser's supported controls.
- Use a personal script library that persists across reloads in the same browser and on the same site address.

There is no shared public script library or automatic sync between devices. Opening the same site on your phone and laptop gives each browser its own library. Clearing the site's browser data removes the saved scripts and settings.

## Run locally

Install **Node.js 24 LTS**, then:

```sh
git clone https://github.com/demirarif/prompter-for-everyone.git
cd prompter-for-everyone
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`, and allow camera and microphone access when you want to record.

```sh
npm test          # Regression tests
npm run build     # Type-check and build the static app into dist/
npm run preview   # Preview the production build locally
```

Do not open `index.html` directly from your file manager. Serve the app using the development server or a static web host.

## Use it on a phone

Publish the `dist/` directory to an **HTTPS** static host and open that URL on your iPhone or Android phone. See [deployment instructions](docs/DEPLOYMENT.md) for GitHub Pages, Netlify and Vercel.

Camera access requires a secure context: HTTPS, or the browser's local `localhost` exception. A phone visiting `http://192.168.x.x:5173` is not visiting its own localhost; adding Vite's `--host` option alone does not make that connection secure. For phone development, use an HTTPS deployment or an HTTPS development tunnel.

Browser support for recording formats and file sharing varies. The app chooses a supported recording format, so a saved file may be MP4 or WebM. On desktop, saving uses direct download; on supported mobile browsers it can use the native share sheet, with download as a fallback. Large recordings also depend on the device's available memory. Keep the page open until the recording has been saved.

## Use this repository with ChatGPT, Claude, Gemini or another coding agent

Give your coding tool the repository URL and a narrow change request. It can reuse the existing script library, recording lifecycle and download handling instead of rebuilding a teleprompter from scratch. The application itself does not call an AI model or spend model tokens.

Example prompt:

```text
Use https://github.com/demirarif/prompter-for-everyone as the starting project.
Read AGENTS.md, README.md and docs/ARCHITECTURE.md first.
I want to change: [describe your change].
Keep scripts and settings local to each browser, preserve camera/recording cleanup,
and do not add authentication, a backend or paid APIs unless I request them.
Run npm test and npm run build, then explain how I can run or deploy the result.
```

For a first deployment without code changes, ask the tool to follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). No environment variables or secrets need to be configured.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Script library, editor and navigation into the recording studio |
| `src/components/Studio.tsx` | Camera preview, scrolling text, recording, playback and save controls |
| `src/lib/storage.ts` | Versioned local storage, validation and script changes |
| `src/lib/save-recording.ts` | Filenames, desktop download and mobile share fallback |
| `src/lib/recorder.ts` | Recording support and lifecycle helpers, when used by the studio |
| `tests/` | Regression tests |

The app is a static single-page application. You can change its UI or deploy it to a different static host without provisioning server infrastructure. Read [Architecture](docs/ARCHITECTURE.md) before changing persistence or camera behavior.

## Privacy and scope

The app does not upload scripts or recordings, include analytics, or require a user account. Your browser handles camera permissions, downloads and any native sharing you choose. A public deployment serves the same app to everyone, while each visitor's scripts remain separate in that visitor's browser. Local storage is not an encrypted vault or a backup service.

This repository provides reusable source code and documentation. Public availability helps people and coding tools inspect it, but search-engine or AI search indexing is not guaranteed.

## License

[MIT](LICENSE). You may use, modify and redistribute the project under that license.
