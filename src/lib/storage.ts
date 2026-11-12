export interface Script {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  completed: boolean;
  completedAt: string | null;
}

export interface PromptSettings {
  speed: number;
  width: number;
  color: string;
}

export interface LibraryState {
  scripts: Script[];
  settings: PromptSettings;
}

export const DEFAULT_SETTINGS: PromptSettings = Object.freeze({
  speed: 38,
  width: 92,
  color: "#FFFFFF",
});

export const STORAGE_KEY = "prompter-for-everyone:v1";
const STORAGE_VERSION = 1;
const TEXT_COLORS = new Set(["#FFFFFF", "#FFE7A3", "#BDF8DE"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateCopy(titleValue: unknown, contentValue: unknown) {
  if (typeof titleValue !== "string" || typeof contentValue !== "string") {
    throw new Error("The title and script must be text.");
  }
  const title = titleValue.trim();
  const content = contentValue.trim();
  if (!title || !content) throw new Error("Enter both a title and a script.");
  if (title.length > 100) throw new Error("The title must be 100 characters or fewer.");
  if (content.length > 12000) throw new Error("The script must be 12,000 characters or fewer.");
  return { title, content };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validateScript(value: unknown): Script {
  if (!isRecord(value)) throw new Error("A saved script has an invalid format.");
  if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 128) {
    throw new Error("A saved script has an invalid ID.");
  }
  validateCopy(value.title, value.content);
  if (!validDate(value.createdAt) || !validDate(value.updatedAt)) {
    throw new Error("A saved script has an invalid date.");
  }
  if (typeof value.completed !== "boolean") {
    throw new Error("A saved script has an invalid completion status.");
  }
  if ((value.completed && !validDate(value.completedAt)) || (!value.completed && value.completedAt !== null)) {
    throw new Error("A saved script has an invalid completion date.");
  }
  // Read only known fields. Never merge arbitrary stored objects into app state.
  return {
    id: value.id,
    title: value.title as string,
    content: value.content as string,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completed: value.completed,
    completedAt: value.completedAt as string | null,
  };
}

function validateSettings(value: unknown): PromptSettings {
  if (!isRecord(value)) throw new Error("Saved reading settings have an invalid format.");
  if (typeof value.speed !== "number" || !Number.isFinite(value.speed) || value.speed < 18 || value.speed > 72) {
    throw new Error("Reading speed must be between 18 and 72.");
  }
  if (typeof value.width !== "number" || !Number.isFinite(value.width) || value.width < 20 || value.width > 100) {
    throw new Error("Text width must be between 20% and 100%.");
  }
  if (typeof value.color !== "string" || !TEXT_COLORS.has(value.color)) {
    throw new Error("Choose one of the supported text colors.");
  }
  return { speed: value.speed, width: value.width, color: value.color };
}

function validateLibrary(value: unknown): LibraryState {
  if (!isRecord(value) || !Array.isArray(value.scripts)) {
    throw new Error("The script library has an invalid format.");
  }
  const scripts = value.scripts.map(validateScript);
  if (new Set(scripts.map((script) => script.id)).size !== scripts.length) {
    throw new Error("The script library contains duplicate IDs.");
  }
  return { scripts, settings: validateSettings(value.settings) };
}

/** Returns an empty library on first use; never repairs or overwrites invalid data. */
export function loadLibrary(storage: Pick<Storage, "getItem">): LibraryState {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (cause) {
    throw new Error("Could not read your scripts. Browser storage may be blocked or unavailable.", { cause });
  }
  if (raw === null) return { scripts: [], settings: { ...DEFAULT_SETTINGS } };

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== STORAGE_VERSION) {
      throw new Error("The saved library version is not supported.");
    }
    return validateLibrary(value);
  } catch (cause) {
    const detail = cause instanceof Error ? ` ${cause.message}` : "";
    throw new Error(`Could not load your saved scripts.${detail} Your stored data has not been changed.`, { cause });
  }
}

/** Commit storage first, then update UI state so failed writes cannot look saved. */
export function saveLibrary(storage: Pick<Storage, "setItem">, state: LibraryState): void {
  const validated = validateLibrary(state);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...validated }));
  } catch (cause) {
    throw new Error("Could not save your scripts. Browser storage may be full or unavailable. Keep this page open and copy any unsaved text.", { cause });
  }
}

export function createScript(title: string, content: string): Script {
  const copy = validateCopy(title, content);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...copy,
    createdAt: now,
    updatedAt: now,
    completed: false,
    completedAt: null,
  };
}

export function editScript(script: Script, title: string, content: string): Script {
  const original = validateScript(script);
  const copy = validateCopy(title, content);
  return { ...original, ...copy, updatedAt: new Date().toISOString(), completed: false, completedAt: null };
}

export function completeScript(script: Script): Script {
  const original = validateScript(script);
  const now = new Date().toISOString();
  return { ...original, completed: true, completedAt: now, updatedAt: now };
}
