import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptSettings, Script } from "../lib/storage";
import { acquireCamera, cameraErrorMessage, chooseRecorder, disposeRecorder, runCountdown, stopStream } from "../lib/recorder";
import { recordingFilename, saveRecording } from "../lib/save-recording";

type StudioProps = {
  script: Script;
  settings: PromptSettings;
  onSettingsChange: (settings: PromptSettings) => void;
  onClose: () => void;
  onComplete: () => void;
};
type Stage = "preparing" | "ready" | "countdown" | "recording" | "preview" | "error";

const TEXT_COLORS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#FFE7A3", label: "Cream" },
  { value: "#BDF8DE", label: "Mint" },
];

export default function Studio({ script, settings, onSettingsChange, onClose, onComplete }: StudioProps) {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const operationRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const recordingUrlRef = useRef("");
  const epochRef = useRef(0);
  const speedRef = useRef(settings.speed);
  const [stage, setStage] = useState<Stage>("preparing");
  const [countdown, setCountdown] = useState(3);
  const [seconds, setSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [downloadReady, setDownloadReady] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => { speedRef.current = settings.speed; }, [settings.speed]);

  const stopMotion = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    if (timerRef.current !== null) clearInterval(timerRef.current);
    animationRef.current = null;
    timerRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (cameraRef.current) cameraRef.current.srcObject = null;
  }, []);

  const releaseRecording = useCallback(() => {
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = "";
  }, []);

  const cancelOperations = useCallback(() => {
    epochRef.current += 1;
    operationRef.current?.abort();
    operationRef.current = null;
    stopMotion();
    disposeRecorder(recorderRef.current);
    recorderRef.current = null;
    stopCamera();
  }, [stopCamera, stopMotion]);

  const startCamera = useCallback(async () => {
    cancelOperations();
    const operation = new AbortController();
    operationRef.current = operation;
    setStage("preparing");
    setError("");
    try {
      if (!window.isSecureContext) {
        setError(cameraErrorMessage(null, false));
        setStage("error");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== "function") {
        setError("This browser does not support camera recording. Try a current browser with camera and microphone access.");
        setStage("error");
        return;
      }
      const stream = await acquireCamera(operation.signal, navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices));
      if (!stream) return;
      if (!mountedRef.current || operation.signal.aborted || operationRef.current !== operation) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      setStage("ready");
    } catch (cameraError) {
      if (!mountedRef.current || operation.signal.aborted) return;
      stopCamera();
      setError(cameraErrorMessage(cameraError));
      setStage("error");
    }
  }, [cancelOperations, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    const startup = setTimeout(() => void startCamera(), 0);
    return () => {
      mountedRef.current = false;
      clearTimeout(startup);
      cancelOperations();
      releaseRecording();
    };
  }, [cancelOperations, releaseRecording, startCamera]);

  useEffect(() => {
    if (stage !== "ready" || !cameraRef.current || !streamRef.current) return;
    const camera = cameraRef.current;
    camera.srcObject = streamRef.current;
    void camera.play().catch(() => {
      if (!mountedRef.current || camera.srcObject !== streamRef.current) return;
      setError("The camera preview could not play. Check camera permission and try again.");
      stopCamera();
      setStage("error");
    });
  }, [stage, stopCamera]);

  useEffect(() => {
    if (stage !== "preview" || !recordingUrl || !previewRef.current) return;
    const video = previewRef.current;
    const preparePreview = () => {
      if (Number.isFinite(video.duration) && video.duration > 0.05) video.currentTime = 0.01;
      void video.play().catch(() => { if (mountedRef.current) setPreviewPlaying(false); });
    };
    video.addEventListener("loadedmetadata", preparePreview, { once: true });
    video.load();
    return () => video.removeEventListener("loadedmetadata", preparePreview);
  }, [recordingUrl, stage]);

  function startPromptMotion() {
    const startedAt = performance.now();
    const frame = (now: number) => {
      if (!mountedRef.current) return;
      const offset = ((now - startedAt) / 1000) * speedRef.current;
      if (promptRef.current) promptRef.current.style.transform = `translate3d(0, -${offset}px, 0)`;
      animationRef.current = requestAnimationFrame(frame);
    };
    animationRef.current = requestAnimationFrame(frame);
  }

  function finishRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMotion();
  }

  async function beginRecording() {
    if (stage !== "ready" || !streamRef.current) return;
    operationRef.current?.abort();
    const operation = new AbortController();
    operationRef.current = operation;
    const epoch = ++epochRef.current;
    const active = () => mountedRef.current && !operation.signal.aborted && epochRef.current === epoch;
    setStage("countdown");
    if (!await runCountdown(operation.signal, (value) => { if (active()) setCountdown(value); })) return;
    if (!active() || !streamRef.current) return;
    if (promptRef.current) promptRef.current.style.transform = "translate3d(0, 0, 0)";

    try {
      const recorder = chooseRecorder(streamRef.current);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (active() && event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => {
        if (!active()) return;
        cancelOperations();
        setError("Recording stopped unexpectedly. Please try recording again.");
        setStage("error");
      };
      recorder.onstop = () => {
        if (!active()) return;
        stopMotion();
        const type = recorder.mimeType || chunks[0]?.type || "video/mp4";
        const blob = new Blob(chunks, { type });
        disposeRecorder(recorder);
        recorderRef.current = null;
        stopCamera();
        if (!blob.size) {
          setError("No video data was recorded. Please try again.");
          setStage("error");
          return;
        }
        releaseRecording();
        const url = URL.createObjectURL(blob);
        recordingUrlRef.current = url;
        setRecordingBlob(blob);
        setRecordingUrl(url);
        setPreviewPlaying(false);
        setStage("preview");
      };
      recorder.start(1000);
      setSeconds(0);
      setStage("recording");
      timerRef.current = setInterval(() => { if (active()) setSeconds((value) => value + 1); }, 1000);
      startPromptMotion();
    } catch {
      if (!active()) return;
      cancelOperations();
      setError("Video recording could not start. Check your browser's recording support and try again.");
      setStage("error");
    }
  }

  async function playPreview() {
    try { await previewRef.current?.play(); }
    catch { if (mountedRef.current) setSaveMessage("Use the video's play button to start the preview."); }
  }

  async function saveVideo() {
    if (!recordingBlob) return;
    setSaveMessage("");
    setDownloadReady(false);
    try {
      const result = await saveRecording(recordingBlob, recordingUrl, script.title);
      if (!mountedRef.current) return;
      if (result === "shared") setSaveMessage("The share sheet opened. Choose Save Video or save it to your device.");
      if (result === "downloaded") {
        setDownloadReady(true);
        setSaveMessage("Your video download has started.");
      }
    } catch {
      if (!mountedRef.current) return;
      setDownloadReady(true);
      setSaveMessage("Your video is ready. Use the direct download link below.");
    }
  }

  function closeStudio() {
    mountedRef.current = false;
    cancelOperations();
    releaseRecording();
    onClose();
  }

  function markComplete() {
    setCompleting(true);
    setSaveMessage("");
    try { onComplete(); }
    catch {
      setCompleting(false);
      setSaveMessage("The completion status could not be saved. Please try again.");
    }
  }

  async function retake() {
    releaseRecording();
    setRecordingUrl("");
    setRecordingBlob(null);
    setSaveMessage("");
    setDownloadReady(false);
    setSeconds(0);
    await startCamera();
  }

  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const settingsLocked = stage === "recording" || stage === "countdown";

  return (
    <main className="studio-shell">
      {stage !== "preview" ? <video ref={cameraRef} className="camera-preview" autoPlay playsInline muted /> : (
        <video key={recordingUrl} ref={previewRef} className="recording-preview" src={recordingUrl} controls autoPlay playsInline preload="metadata" onPlay={() => setPreviewPlaying(true)} onPause={() => setPreviewPlaying(false)} onEnded={() => setPreviewPlaying(false)} onError={() => setSaveMessage("The preview could not play. Download the video to review it on your device.")} />
      )}
      <div className="camera-shade" />
      <header className="studio-header">
        <button className="round-button" type="button" onClick={closeStudio} aria-label="Close studio">×</button>
        <div className={`recording-status ${stage === "recording" ? "is-recording" : ""}`}><span /> {stage === "recording" ? timeLabel : "PROMPTER FOR EVERYONE"}</div>
        <div className="round-button ghost-round" aria-hidden="true" />
      </header>
      {stage !== "preview" ? (
        <>
          <div className="prompter-window" aria-live="off" style={{ width: `${settings.width}%` }}><div ref={promptRef} className="prompter-copy" style={{ color: settings.color }}>{script.content}</div></div>
          {stage === "preparing" ? <div className="center-message">Starting camera…</div> : null}
          {stage === "countdown" ? <div className="countdown">{countdown}</div> : null}
          {stage === "error" ? <div className="camera-error-card"><h2>Camera unavailable</h2><p>{error}</p><button type="button" onClick={() => void startCamera()}>Try again</button></div> : null}
          <section className="studio-controls">
            <div className="settings-row">
              <label className="speed-control"><span>Speed</span><input type="range" min="18" max="72" value={settings.speed} onChange={(event) => onSettingsChange({ ...settings, speed: Number(event.target.value) })} disabled={settingsLocked} aria-label="Text speed" /></label>
              <div className="color-control" aria-label="Text color">{TEXT_COLORS.map((color) => <button key={color.value} type="button" className={settings.color.toUpperCase() === color.value ? "selected" : ""} style={{ backgroundColor: color.value }} onClick={() => onSettingsChange({ ...settings, color: color.value })} disabled={settingsLocked} aria-label={color.label} aria-pressed={settings.color.toUpperCase() === color.value} />)}</div>
              <label className="width-control" htmlFor="prompter-width"><span>Text width</span><input id="prompter-width" type="range" min="20" max="100" step="1" value={settings.width} onChange={(event) => onSettingsChange({ ...settings, width: Number(event.target.value) })} disabled={settingsLocked} aria-label="Text width" /><output htmlFor="prompter-width">{settings.width}%</output></label>
            </div>
            {stage === "recording" ? <button className="record-button recording" type="button" onClick={finishRecording} aria-label="Stop recording"><span /></button> : <button className="record-button" type="button" onClick={() => void beginRecording()} disabled={stage !== "ready"} aria-label="Start recording"><span /></button>}
            <p>{stage === "recording" ? "Stop recording" : "Start recording"}</p>
          </section>
        </>
      ) : (
        <>
          {!previewPlaying ? <button className="preview-play-button" type="button" onClick={() => void playPreview()} aria-label="Play preview"><span /></button> : null}
          <section className="preview-panel">
            <div className="preview-copy"><p className="eyebrow">Recording ready</p><h1>{script.title}</h1></div>
            {saveMessage ? <p className="save-message" role="status">{saveMessage}{downloadReady && recordingBlob ? <> <a href={recordingUrl} download={recordingFilename(script.title, recordingBlob.type)}>Download directly</a></> : null}</p> : null}
            <div className="preview-actions">
              <button className="secondary-button" type="button" onClick={() => void retake()}>Retake</button>
              <button className="secondary-button" type="button" onClick={() => void saveVideo()}>Save video</button>
              <button className="primary-button complete-button" type="button" onClick={markComplete} disabled={completing}>{completing ? "Saving…" : "Mark as recorded"}</button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
