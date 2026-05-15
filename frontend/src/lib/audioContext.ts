/**
 * Helpers for setting up AudioContext with worklet processors
 * for mic capture (PCM 16kHz) and response playback (PCM 24kHz).
 */

export interface AudioPipeline {
  ctx: AudioContext;
  captureNode: AudioWorkletNode;
  playbackNode: AudioWorkletNode;
  micStream: MediaStream;
  close: () => void;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export { arrayBufferToBase64 };

export async function createAudioPipeline(
  micStream: MediaStream,
  onAudioChunk: (b64: string) => void,
  onPlaybackState: (playing: boolean) => void,
): Promise<AudioPipeline> {
  const ctx = new AudioContext({ sampleRate: 48000 });

  await ctx.audioWorklet.addModule("/mic-capture-processor.js");
  await ctx.audioWorklet.addModule("/playback-processor.js?v=2");

  const source = ctx.createMediaStreamSource(micStream);
  const captureNode = new AudioWorkletNode(ctx, "mic-capture-processor");
  source.connect(captureNode);

  captureNode.port.onmessage = (e: MessageEvent) => {
    const b64 = arrayBufferToBase64(e.data);
    onAudioChunk(b64);
  };

  const playbackNode = new AudioWorkletNode(ctx, "playback-processor");
  playbackNode.connect(ctx.destination);

  await ctx.resume().catch(() => {});

  playbackNode.port.onmessage = (e: MessageEvent) => {
    if (e.data && typeof e.data.playing === "boolean") {
      onPlaybackState(e.data.playing);
    }
  };

  const close = () => {
    try { captureNode.disconnect(); } catch {}
    try { playbackNode.disconnect(); } catch {}
    try { source.disconnect(); } catch {}
    micStream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };

  return { ctx, captureNode, playbackNode, micStream, close };
}

/** Parse e.g. audio/pcm;rate=24000 — Gemini Live sends this on each chunk. */
export function parsePcmSampleRate(mimeType?: string): number | null {
  if (!mimeType) return null;
  const m = /(?:^|[;,])\s*rate\s*=\s*(\d+)/i.exec(mimeType);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 6000 && n <= 96000 ? n : null;
}

export function feedPlayback(
  playbackNode: AudioWorkletNode,
  pcmB64: string,
  mimeType?: string,
): void {
  let binary = atob(pcmB64);
  if (binary.length % 2 !== 0) {
    binary = binary.slice(0, binary.length - 1);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const rate = parsePcmSampleRate(mimeType);
  if (rate != null) {
    playbackNode.port.postMessage({ type: "setSourceRate", rate });
  }
  playbackNode.port.postMessage(bytes.buffer, [bytes.buffer]);
}

export function clearPlayback(playbackNode: AudioWorkletNode): void {
  playbackNode.port.postMessage("clear");
}
