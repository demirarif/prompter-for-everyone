import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  completeScript,
  createScript,
  editScript,
  loadLibrary,
  saveLibrary,
} from "../src/lib/storage.ts";

function memoryStorage(raw) {
  const state = { raw: raw ?? null, writes: 0 };
  return {
    state,
    getItem(key) { assert.equal(key, STORAGE_KEY); return state.raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); state.raw = value; state.writes += 1; },
  };
}

function library(overrides = {}) {
  return { scripts: [createScript("A script", "Words to read.")], settings: { ...DEFAULT_SETTINGS }, ...overrides };
}

function persisted(value) {
  return JSON.stringify({ version: 1, ...value });
}

test("first use starts empty with independent reading defaults and no writes", () => {
  const storage = memoryStorage();
  const first = loadLibrary(storage);
  const second = loadLibrary(storage);
  assert.deepEqual(first, { scripts: [], settings: { speed: 38, width: 92, color: "#FFFFFF" } });
  first.settings.width = 20;
  first.scripts.push(createScript("Local", "Only in the first result."));
  assert.equal(second.settings.width, 92);
  assert.equal(second.scripts.length, 0);
  assert.equal(storage.state.writes, 0);
});

test("creating scripts trims text and produces unique IDs and dates", () => {
  const first = createScript("  My script  ", "  A short speech.\n  ");
  const second = createScript("Another", "Another speech.");
  assert.equal(first.title, "My script");
  assert.equal(first.content, "A short speech.");
  assert.notEqual(first.id, second.id);
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  assert.equal(first.createdAt, first.updatedAt);
  assert.equal(first.completed, false);
  assert.equal(first.completedAt, null);
});

test("copy validation rejects blank, wrong-type and overlong input", () => {
  for (const [title, content] of [["", "Text"], ["Title", "  "], [null, "Text"], ["Title", 42], ["x".repeat(101), "Text"], ["Title", "x".repeat(12001)]]) {
    assert.throws(() => createScript(title, content), Error);
  }
  assert.equal(createScript("x".repeat(100), "x".repeat(12000)).content.length, 12000);
});

test("completion and editing preserve identity without mutating the original", () => {
  const first = createScript("Original", "Original words.");
  const completed = completeScript(first);
  assert.equal(first.completed, false);
  assert.equal(completed.completed, true);
  assert.ok(Number.isFinite(Date.parse(completed.completedAt)));
  const edited = editScript(completed, "  Updated  ", "  Updated words.  ");
  assert.equal(edited.id, first.id);
  assert.equal(edited.createdAt, first.createdAt);
  assert.equal(edited.title, "Updated");
  assert.equal(edited.content, "Updated words.");
  assert.equal(edited.completed, false);
  assert.equal(edited.completedAt, null);
  assert.equal(completed.completed, true);
});

test("a versioned library round-trips scripts, completion and settings", () => {
  const storage = memoryStorage();
  const state = library({ settings: { speed: 72, width: 20, color: "#BDF8DE" } });
  state.scripts[0] = completeScript(state.scripts[0]);
  saveLibrary(storage, state);
  assert.equal(JSON.parse(storage.state.raw).version, 1);
  assert.equal(storage.state.writes, 1);
  assert.deepEqual(loadLibrary(storage), state);
  const loaded = loadLibrary(storage);
  loaded.scripts[0].title = "Changed only in memory";
  assert.equal(loadLibrary(storage).scripts[0].title, state.scripts[0].title);
});

test("invalid JSON and unknown versions remain untouched instead of being reset", () => {
  for (const raw of ["{broken", "null", "[]", "", JSON.stringify({ version: 2, ...library() }), JSON.stringify(library())]) {
    const storage = memoryStorage(raw);
    assert.throws(() => loadLibrary(storage), /stored data has not been changed/);
    assert.equal(storage.state.raw, raw);
    assert.equal(storage.state.writes, 0);
  }
});

test("invalid script fields and duplicate IDs are rejected without overwriting data", () => {
  const valid = createScript("Title", "Words.");
  const invalidScripts = [
    null,
    [],
    { ...valid, id: "" },
    { ...valid, title: " " },
    { ...valid, content: 12 },
    { ...valid, createdAt: "not-a-date" },
    { ...valid, updatedAt: null },
    { ...valid, completed: "true" },
    { ...valid, completed: true, completedAt: null },
    { ...valid, completedAt: "2026-11-12T10:00:00Z" },
  ];
  for (const invalid of invalidScripts) {
    const storage = memoryStorage(persisted(library({ scripts: [invalid] })));
    const raw = storage.state.raw;
    assert.throws(() => loadLibrary(storage), /stored data has not been changed/);
    assert.equal(storage.state.raw, raw);
    assert.equal(storage.state.writes, 0);
  }
  const duplicate = memoryStorage(persisted(library({ scripts: [valid, valid] })));
  assert.throws(() => loadLibrary(duplicate), /duplicate IDs/);
});

test("settings validate numeric bounds and supported colors", () => {
  const invalidSettings = [
    null,
    { ...DEFAULT_SETTINGS, speed: 17 },
    { ...DEFAULT_SETTINGS, speed: 73 },
    { ...DEFAULT_SETTINGS, speed: "38" },
    { ...DEFAULT_SETTINGS, width: 19 },
    { ...DEFAULT_SETTINGS, width: 101 },
    { ...DEFAULT_SETTINGS, color: "red" },
  ];
  for (const settings of invalidSettings) {
    const storage = memoryStorage(persisted(library({ settings })));
    assert.throws(() => loadLibrary(storage), /stored data has not been changed/);
    assert.equal(storage.state.writes, 0);
  }
  for (const settings of [{ speed: 18, width: 20, color: "#FFFFFF" }, { speed: 72, width: 100, color: "#FFE7A3" }]) {
    const storage = memoryStorage(persisted(library({ settings })));
    assert.deepEqual(loadLibrary(storage).settings, settings);
  }
});

test("invalid state is never written", () => {
  const storage = memoryStorage(persisted(library()));
  const before = storage.state.raw;
  assert.throws(() => saveLibrary(storage, library({ settings: { ...DEFAULT_SETTINGS, width: Infinity } })), /width/);
  assert.equal(storage.state.raw, before);
  assert.equal(storage.state.writes, 0);
});

test("blocked reads and quota errors provide actionable messages", () => {
  assert.throws(() => loadLibrary({ getItem() { throw new DOMException("Blocked", "SecurityError"); } }), /storage may be blocked/);
  const state = library();
  const before = structuredClone(state);
  assert.throws(() => saveLibrary({ setItem() { throw new DOMException("Full", "QuotaExceededError"); } }, state), /storage may be full.*copy any unsaved text/);
  assert.deepEqual(state, before);
});

test("unknown stored fields are not copied into application state", () => {
  const state = library();
  const raw = persisted({ ...state, secret: "ignored", settings: { ...state.settings, secret: "ignored" }, scripts: [{ ...state.scripts[0], secret: "ignored" }] });
  assert.deepEqual(loadLibrary(memoryStorage(raw)), state);
});
