export type SaveRecordingResult = "shared" | "downloaded" | "cancelled";

export function recordingFilename(title: string, mimeType: string) {
  const safeTitle = title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/g, "");
  return `prompter-for-everyone-${safeTitle || "recording"}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
}

function downloadRecording(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); }
}

export async function saveRecording(blob: Blob, url: string, title: string): Promise<SaveRecordingResult> {
  const filename = recordingFilename(title, blob.type);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Desktop share sheets may reject a large recording despite canShare=true.
  // Download its existing Blob URL directly, without making a File copy.
  if (isMobile && navigator.share && navigator.canShare) {
    try {
      const mimeType = blob.type.split(";")[0] || (filename.endsWith(".mp4") ? "video/mp4" : "video/webm");
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return "shared";
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      // Data/size/permission failures still leave the original video available.
    }
  }

  downloadRecording(url, filename);
  return "downloaded";
}
