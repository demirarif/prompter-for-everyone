import assert from "node:assert/strict";
import test from "node:test";
import { acquireCamera, cameraErrorMessage, chooseRecorder, disposeRecorder, runCountdown, stopStream } from "../src/lib/recorder.ts";

test("recorder prefers a supported MP4 format", () => {
  const stream = {};
  class Recorder {
    static isTypeSupported(type) { return type === "video/mp4"; }
    constructor(receivedStream, options) { this.stream = receivedStream; this.options = options; }
  }
  const recorder = chooseRecorder(stream, Recorder);
  assert.equal(recorder.stream, stream);
  assert.equal(recorder.options.mimeType, "video/mp4");
  assert.equal(recorder.options.videoBitsPerSecond, 6_000_000);
});

test("a claimed format that fails construction falls back to the next usable format", () => {
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(_stream, options) {
      if (options?.mimeType.startsWith("video/mp4")) throw new Error("Unsupported encoder");
      this.options = options;
    }
  }
  assert.equal(chooseRecorder({}, Recorder).options.mimeType, "video/webm;codecs=vp8,opus");
});

test("browsers without format probing use their default recorder", () => {
  class Recorder {
    constructor(_stream, options) { this.options = options; }
  }
  assert.equal(chooseRecorder({}, Recorder).options, undefined);
});

test("missing MediaRecorder is reported gracefully", () => {
  assert.throws(() => chooseRecorder({}, null), /does not support video recording/);
});

test("closing while camera permission is pending stops the late stream", async () => {
  const controller = new AbortController();
  let resolveCamera;
  let stopped = 0;
  const pending = acquireCamera(controller.signal, (constraints) => {
    assert.equal(constraints.audio, true);
    assert.equal(constraints.video.facingMode, "user");
    return new Promise(resolve => { resolveCamera = resolve; });
  });
  controller.abort();
  resolveCamera({ getTracks: () => [{ stop() { stopped += 1; } }, { stop() { stopped += 1; } }] });
  assert.equal(await pending, null);
  assert.equal(stopped, 2);
});

test("already cancelled camera acquisition never requests permission", async () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(await acquireCamera(controller.signal, () => { assert.fail("Permission prompt must not open"); }), null);
});

test("an active camera request returns its stream without stopping it", async () => {
  const stream = { getTracks() { assert.fail("Active stream must not be stopped"); } };
  assert.equal(await acquireCamera(new AbortController().signal, async () => stream), stream);
});

test("countdown cancellation ends immediately and never reaches another tick", async () => {
  const controller = new AbortController();
  const ticks = [];
  const pending = runCountdown(controller.signal, value => ticks.push(value), 1000);
  controller.abort();
  assert.equal(await pending, false);
  assert.deepEqual(ticks, [3]);
});

test("a completed countdown emits 3, 2, 1 and permits recording", async () => {
  const ticks = [];
  assert.equal(await runCountdown(new AbortController().signal, value => ticks.push(value), 0), true);
  assert.deepEqual(ticks, [3, 2, 1]);
});

test("a pre-cancelled countdown does not emit or permit recording", async () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(await runCountdown(controller.signal, () => assert.fail("No countdown tick expected"), 0), false);
});

test("disposing an active recorder detaches callbacks before stopping", () => {
  let stopCalls = 0;
  const recorder = {
    state: "recording", onstop() {}, ondataavailable() {}, onerror() {},
    stop() {
      stopCalls += 1;
      assert.equal(this.onstop, null);
      assert.equal(this.ondataavailable, null);
      assert.equal(this.onerror, null);
    },
  };
  disposeRecorder(recorder);
  assert.equal(stopCalls, 1);
  disposeRecorder({ ...recorder, state: "inactive", stop() { assert.fail("Inactive recorder must not stop again"); } });
});

test("track cleanup continues even when one device throws", () => {
  let otherStopped = false;
  stopStream({ getTracks: () => [{ stop() { throw new Error("Device gone"); } }, { stop() { otherStopped = true; } }] });
  assert.equal(otherStopped, true);
  stopStream(null);
});

test("camera errors use browser-neutral permission and HTTPS guidance", () => {
  assert.match(cameraErrorMessage(null, false), /HTTPS or use localhost/);
  assert.match(cameraErrorMessage(new DOMException("Blocked", "NotAllowedError")), /site settings/);
  assert.match(cameraErrorMessage(new DOMException("Missing", "NotFoundError")), /No camera or microphone/);
  assert.match(cameraErrorMessage(new DOMException("Busy", "NotReadableError")), /Close other apps/);
  assert.doesNotMatch(cameraErrorMessage(new Error("Private implementation detail")), /Private implementation detail/);
});
