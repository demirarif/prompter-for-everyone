import assert from "node:assert/strict";
import test from "node:test";
import { recordingFilename, saveRecording } from "../src/lib/save-recording.ts";

const recordingUrl = "blob:https://example.test/recording";

function browser(t, overrides = {}) {
  const events = [];
  const links = [];
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
      ...overrides,
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(tagName) {
        assert.equal(tagName, "a");
        const link = {
          href: "", download: "",
          click() { events.push("click"); },
          remove() { events.push("remove"); },
        };
        links.push(link);
        return link;
      },
      body: { appendChild(link) { assert.equal(link, links.at(-1)); events.push("append"); } },
    },
  });
  t.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else delete globalThis.document;
  });
  return { events, links };
}

function mobile(overrides = {}) {
  return { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1", platform: "iPhone", maxTouchPoints: 5, ...overrides };
}

function assertDownloaded(state, filename) {
  assert.equal(state.links.length, 1);
  assert.equal(state.links[0].href, recordingUrl);
  assert.equal(state.links[0].download, filename);
  assert.deepEqual(state.events, ["append", "click", "remove"]);
}

test("macOS bypasses native sharing and downloads the existing recording URL", async (t) => {
  const state = browser(t, {
    canShare() { assert.fail("Desktop must not consult file sharing support"); },
    async share() { assert.fail("Desktop must not invoke the share sheet"); },
  });
  assert.equal(await saveRecording(new Blob(["video"], { type: "video/mp4" }), recordingUrl, "My video"), "downloaded");
  assertDownloaded(state, "prompter-for-everyone-my-video.mp4");
});

test("a 64 MB desktop recording is downloadable without using the share sheet", async (t) => {
  const state = browser(t, {
    canShare() { assert.fail("Large desktop videos must bypass canShare"); },
    async share() { throw new DOMException("The data is too large", "DataError"); },
  });
  const blob = new Blob([new ArrayBuffer(64 * 1024 * 1024)], { type: "video/mp4" });
  assert.equal(blob.size, 64 * 1024 * 1024);
  assert.equal(await saveRecording(blob, recordingUrl, "Long recording"), "downloaded");
  assertDownloaded(state, "prompter-for-everyone-long-recording.mp4");
});

test("successful mobile sharing does not trigger a duplicate download", async (t) => {
  let shared;
  const state = browser(t, mobile({
    canShare: ({ files }) => files.length === 1,
    async share(payload) { shared = payload; },
  }));
  assert.equal(await saveRecording(new Blob(["video"], { type: "video/mp4" }), recordingUrl, "First video"), "shared");
  assert.equal(shared.title, "First video");
  assert.equal(shared.files[0].name, "prompter-for-everyone-first-video.mp4");
  assert.equal(state.links.length, 0);
});

test("iPad desktop mode still uses mobile sharing", async (t) => {
  let calls = 0;
  const state = browser(t, { maxTouchPoints: 5, canShare: () => true, async share() { calls += 1; } });
  assert.equal(await saveRecording(new Blob(["video"], { type: "video/mp4" }), recordingUrl, "Tablet"), "shared");
  assert.equal(calls, 1);
  assert.equal(state.links.length, 0);
});

test("a mobile DataError falls back to downloading the original video", async (t) => {
  const state = browser(t, mobile({
    canShare: () => true,
    async share() { throw new DOMException("The data is too large", "DataError"); },
  }));
  assert.equal(await saveRecording(new Blob(["video"], { type: "video/mp4" }), recordingUrl, "Video"), "downloaded");
  assertDownloaded(state, "prompter-for-everyone-video.mp4");
});

test("cancelling the share sheet does not start an unwanted download", async (t) => {
  const state = browser(t, mobile({
    canShare: () => true,
    async share() { throw new DOMException("User cancelled", "AbortError"); },
  }));
  assert.equal(await saveRecording(new Blob(["video"], { type: "video/mp4" }), recordingUrl, "Video"), "cancelled");
  assert.equal(state.links.length, 0);
});

for (const [name, canShare] of [
  ["false", () => false],
  ["an exception", () => { throw new TypeError("Unsupported file"); }],
]) {
  test(`canShare returning ${name} falls back to direct download`, async (t) => {
    const state = browser(t, mobile({ canShare, async share() { assert.fail("Unsupported files must not be shared"); } }));
    assert.equal(await saveRecording(new Blob(["video"], { type: "video/webm" }), recordingUrl, "Video"), "downloaded");
    assertDownloaded(state, "prompter-for-everyone-video.webm");
  });
}

test("shared File MIME type excludes recorder codec parameters", async (t) => {
  let sharedFile;
  browser(t, mobile({ canShare: () => true, async share({ files }) { sharedFile = files[0]; } }));
  const blob = new Blob(["video"], { type: "video/mp4;codecs=avc1.42E01E,mp4a.40.2" });
  assert.equal(await saveRecording(blob, recordingUrl, "Codec video"), "shared");
  assert.equal(sharedFile.type, "video/mp4");
  assert.equal(sharedFile.size, blob.size);
  assert.match(sharedFile.name, /\.mp4$/);
});

test("filenames are portable, sanitized and have an empty-title fallback", () => {
  assert.equal(recordingFilename("  Café / Video #1?! ", "video/mp4"), "prompter-for-everyone-cafe-video-1.mp4");
  assert.equal(recordingFilename("!!!", "video/webm"), "prompter-for-everyone-recording.webm");
  assert.ok(recordingFilename("a".repeat(300), "video/mp4").length < 150);
});
