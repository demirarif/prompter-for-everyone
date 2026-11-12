# Architecture

Prompter for Everyone is a static React + TypeScript single-page application built by Vite. It has no server-side application, database, login layer or external API dependency.

## Data flow

```text
Script editor / library (App)
        │
        ├── validated library + settings ── localStorage
        │
        └── selected script + settings ── Studio
                                            │
                         camera/mic ── MediaRecorder
                                            │
                                      Blob preview
                                            │
                                  download / native share
```

`src/App.tsx` owns the library UI and selected script. It persists successful script and setting changes through `src/lib/storage.ts`. The studio receives a script, reading settings and callbacks; it does not know about accounts, HTTP endpoints or a database.

## Script storage

`src/lib/storage.ts` is the persistence and validation boundary:

- A versioned payload is stored under `prompter-for-everyone:v1`.
- Script IDs, titles, content, timestamps and completion status are stored with the reading settings.
- New and edited titles/content are trimmed and validated. The limits are 100 title characters and 12,000 content characters.
- Reading settings support speed 18–72, width 20–100 and the three supported text colors.
- Stored data is validated before use. Invalid or inaccessible data and write/quota failures are surfaced as errors rather than silently replacing an existing library.
- Editing a script resets its recorded/completed state; recording completion can mark it complete again.

The storage boundary is deliberately separate from the React interface. A fork can replace persistence without rewriting the recorder. Adding multi-device sync would require a deliberate data ownership and authorization design; it is not part of the default application.

Browser storage is scoped to the site's origin and browser profile. Moving to a different domain or changing the development port creates a different storage context. Browser data deletion removes the local library. No backup, remote sync or shared account is implied.

## Recording studio

`src/components/Studio.tsx` manages camera preparation, countdown, recording, preview and retry. Media helpers handle format support and cleanup where extracted. Scrolling text is a separate DOM overlay above the camera preview; MediaRecorder records the camera/microphone stream, not the page, so it does not include the overlay in the saved video.

The lifecycle must account for asynchronous permission requests and countdowns. Closing the studio invalidates pending work, stops any media tracks and recorder, cancels scheduled motion/timers and releases generated Blob URLs. Returning late from a permission dialog must not reactivate a closed studio.

Recordings are held in browser memory. They are available for preview and saving until the recording is discarded, the studio closes or the page exits. Script persistence does not persist the recorded video.

## File saving

`src/lib/save-recording.ts` owns filename construction and the save path:

- Desktop browsers download the existing Blob URL directly, avoiding native sharing limits on large files.
- Supported mobile browsers may use a native file share sheet.
- A failed mobile capability check or sharing data error falls back to direct download.
- An explicit user cancellation is respected without starting a download.
- A manual download link remains available when browser handling needs another user gesture.

The selected recording format determines the file extension. Recording and sharing support vary by browser; a `.webm` file is not renamed to `.mp4` without conversion.

## Build and deployment

`npm run build` produces static files in `dist/`. Vite's relative base supports hosting from a subdirectory. There are no environment variables or server secrets to provision.

Camera recording requires a secure browser context. Use HTTPS for published and phone-accessible deployments. A desktop can use its own localhost during development. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Verification boundaries

Tests cover persistence validation and media/save helpers. A production build checks TypeScript integration and bundling. Real device checks are still useful for camera permission UX, codec selection, long recordings and native file saving. Automated or synthetic tests should not be described as physical device testing.
