import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Studio from "./components/Studio";
import { completeScript, createScript, DEFAULT_SETTINGS, editScript, loadLibrary, saveLibrary } from "./lib/storage";
import type { LibraryState, PromptSettings, Script } from "./lib/storage";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function App() {
  const [library, setLibrary] = useState<LibraryState>({ scripts: [], settings: { ...DEFAULT_SETTINGS } });
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Script | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [studioScript, setStudioScript] = useState<Script | null>(null);

  useEffect(() => {
    try { setLibrary(loadLibrary(window.localStorage)); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "Your saved scripts could not be loaded.";
      setLoadError(message);
      setError(message);
    }
    finally { setLoaded(true); }
  }, []);

  function persist(next: LibraryState) {
    // Never replace unreadable saved data with the initial empty library.
    if (loadError) { setError(loadError); return false; }
    try {
      saveLibrary(window.localStorage, next);
      setLibrary(next);
      setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your changes could not be saved on this device.");
      return false;
    }
  }

  function openEditor(script?: Script) {
    setEditing(script || "new");
    setTitle(script?.title || "");
    setContent(script?.content || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveScript(event: FormEvent) {
    event.preventDefault();
    try {
      const script = editing && editing !== "new" ? editScript(editing, title, content) : createScript(title, content);
      const scripts = editing === "new" ? [script, ...library.scripts] : library.scripts.map(item => item.id === script.id ? script : item);
      if (persist({ ...library, scripts })) setEditing(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your script could not be saved."); }
  }

  function removeScript(script: Script) {
    if (!window.confirm(`Delete “${script.title}” from this device?`)) return;
    if (persist({ ...library, scripts: library.scripts.filter(item => item.id !== script.id) }) && editing !== "new" && editing?.id === script.id) setEditing(null);
  }

  function updateSettings(settings: PromptSettings) {
    // Keep controls responsive even if browser storage has become unavailable.
    setLibrary(previous => ({ ...previous, settings }));
    persist({ ...library, settings });
  }

  function markComplete() {
    if (!studioScript) return;
    const scripts = library.scripts.map(script => script.id === studioScript.id ? completeScript(script) : script);
    if (persist({ ...library, scripts })) setStudioScript(null);
    else throw new Error("The completion status could not be saved. Your video is still available to download.");
  }

  if (!loaded) return <main className="splash-screen"><p>Opening your scripts…</p></main>;
  if (studioScript) return <><Studio script={studioScript} settings={library.settings} onSettingsChange={updateSettings} onClose={() => setStudioScript(null)} onComplete={markComplete} />{error ? <p className="storage-notice" role="alert">{error}</p> : null}</>;

  return (
    <main className="app-shell library-shell">
      <header className="app-header">
        <div className="app-brand"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><span>Prompter for Everyone</span></div>
        <a className="text-button source-link" href="https://github.com/demirarif/prompter-for-everyone" target="_blank" rel="noreferrer">Source code ↗</a>
        <p className="welcome-line">Your scripts. Your camera. Your device.</p>
      </header>
      <section className="dashboard-intro">
        <div><p className="eyebrow">Write. Read. Record.</p><h1>Ready when you are.</h1></div>
        <button className="compact-primary" type="button" onClick={() => openEditor()}>+ New script</button>
      </section>
      <p className="local-note">Scripts stay in this browser on this device. Videos are only kept when you download or save them.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {editing ? (
        <form className="editor-card" onSubmit={saveScript}>
          <div className="editor-card-head"><div className="avatar" aria-hidden="true">Aa</div><div><h2>{editing === "new" ? "New script" : "Edit script"}</h2><p>Saved only on this device</p></div><button className="editor-close" type="button" onClick={() => setEditing(null)} aria-label="Close editor">×</button></div>
          <label htmlFor="script-title">Title</label>
          <input className="title-input" id="script-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={100} placeholder="A name for your next video" required />
          <label htmlFor="script-content">Script</label>
          <textarea id="script-content" value={content} onChange={event => setContent(event.target.value)} maxLength={12000} placeholder="Write or paste the words you want to read…" required />
          <div className="editor-meta"><span>{content.length.toLocaleString()} / 12,000 characters</span></div>
          <button className="primary-button publish-button" type="submit">Save script</button>
        </form>
      ) : null}
      <section className="library-section" aria-label="Your scripts">
        <div className="section-heading"><h2>Your scripts</h2><span>{library.scripts.length} {library.scripts.length === 1 ? "script" : "scripts"}</span></div>
        {library.scripts.length ? <div className="script-list">{library.scripts.map(script => <article className="script-card" key={script.id}>
          <div className="script-card-head"><span className={`status-badge ${script.completed ? "completed" : "pending"}`}><i />{script.completed ? "Recorded" : "Ready to record"}</span><span>{dateLabel(script.updatedAt)}</span></div>
          <h3>{script.title}</h3><p>{script.content}</p>
          <div className="card-actions"><button type="button" onClick={() => openEditor(script)}>Edit</button><button className="danger-action" type="button" onClick={() => removeScript(script)}>Delete</button></div>
          <button className="primary-button start-button" type="button" onClick={() => setStudioScript(script)}><span className="camera-glyph" aria-hidden="true" />{script.completed ? "Record again" : "Start recording"}</button>
        </article>)}</div> : <div className="empty-card"><div className="empty-symbol" aria-hidden="true">Aa</div><h2>Your next video starts with a script.</h2><p>Add your first script to get started. No account needed.</p></div>}
      </section>
    </main>
  );
}
