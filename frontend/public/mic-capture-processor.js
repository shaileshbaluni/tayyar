/**
 * AudioWorkletProcessor: captures mic input, downsamples to 16kHz PCM 16-bit mono,
 * and posts Int16Array buffers to the main thread.
 *
 * Batches ~100ms of audio per message (1600 samples at 16kHz).
 */
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this._targetRate = 16000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    const ratio = sampleRate / this._targetRate;

    const merged = new Float32Array(this._buffer.length + samples.length);
    merged.set(this._buffer);
    merged.set(samples, this._buffer.length);

    const outLen = Math.floor(merged.length / ratio);
    if (outLen < 1) {
      this._buffer = merged;
      return true;
    }

    const downsampled = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIdx = i * ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, merged.length - 1);
      const frac = srcIdx - lo;
      downsampled[i] = merged[lo] * (1 - frac) + merged[hi] * frac;
    }

    const consumed = Math.floor(outLen * ratio);
    this._buffer = merged.slice(consumed);

    const pcm16 = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const BATCH_SIZE = 1600;
    for (let offset = 0; offset < pcm16.length; offset += BATCH_SIZE) {
      const chunk = pcm16.slice(offset, offset + BATCH_SIZE);
      if (chunk.length > 0) {
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
      }
    }

    return true;
  }
}

registerProcessor("mic-capture-processor", MicCaptureProcessor);
