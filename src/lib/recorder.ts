export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: true,
  video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
};

export function chooseRecorder(stream: MediaStream, Recorder = globalThis.MediaRecorder) {
  if (typeof Recorder !== "function") throw new Error("This browser does not support video recording.");
  const types = [
    "video/mp4",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const mimeType of types) {
    try {
      if (Recorder.isTypeSupported?.(mimeType)) {
        return new Recorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      }
    } catch { /* A claimed format can still fail; try the next supported one. */ }
  }
  return new Recorder(stream);
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* Release the other tracks even if one fails. */ }
  });
}

export function disposeRecorder(recorder: MediaRecorder | null) {
  if (!recorder) return;
  recorder.onstop = null;
  recorder.ondataavailable = null;
  recorder.onerror = null;
  if (recorder.state !== "inactive") {
    try { recorder.stop(); } catch { /* It may already be stopping. */ }
  }
}

export async function acquireCamera(
  signal: AbortSignal,
  requestStream: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
) {
  if (signal.aborted) return null;
  const stream = await requestStream(CAMERA_CONSTRAINTS);
  if (signal.aborted) {
    stopStream(stream);
    return null;
  }
  return stream;
}

function countdownDelay(signal: AbortSignal, milliseconds: number) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) { resolve(false); return; }
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve(!signal.aborted);
    }, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export async function runCountdown(signal: AbortSignal, onTick: (value: number) => void, milliseconds = 900) {
  for (let value = 3; value >= 1; value -= 1) {
    if (signal.aborted) return false;
    onTick(value);
    if (!await countdownDelay(signal, milliseconds)) return false;
  }
  return !signal.aborted;
}

export function cameraErrorMessage(error: unknown, secureContext = true) {
  if (!secureContext) return "Camera access needs a secure connection. Open this page over HTTPS or use localhost.";
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera and microphone permission is required. Allow both in your browser's site settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera or microphone was found. Connect a device, then try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera or microphone is busy. Close other apps using it, then try again.";
  }
  return "The camera could not start. Check your browser's camera and microphone permissions, then try again.";
}
