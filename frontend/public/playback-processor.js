/**
 * AudioWorkletProcessor: receives PCM Int16 chunks (rate from mimeType, default 24kHz),
 * resamples to the AudioContext sample rate.
 *
 * Ring buffer (~4s at current source rate) absorbs WebSocket jitter.
 */
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._sourceRate = 24000;
    this._ringSeconds = 30;
    this._ringSize = Math.floor(this._sourceRate * this._ringSeconds);
    this._ring = new Float32Array(this._ringSize);
    this._writePos = 0;
    this._readPos = 0;
    this._available = 0;
    /** Avoid spamming main thread — was causing UI/audio glitches */
    this._lastPlayingPosted = false;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d === "clear") {
        this._writePos = 0;
        this._readPos = 0;
        this._available = 0;
        if (this._lastPlayingPosted) {
          this._lastPlayingPosted = false;
          this.port.postMessage({ playing: false });
        }
        return;
      }

      if (d && typeof d === "object" && d.type === "setSourceRate") {
        const r = Number(d.rate);
        if (r >= 6000 && r <= 96000 && r !== this._sourceRate) {
          this._sourceRate = r;
          this._ringSize = Math.floor(r * this._ringSeconds);
          this._ring = new Float32Array(this._ringSize);
          this._writePos = 0;
          this._readPos = 0;
          this._available = 0;
        }
        return;
      }

      const int16 = new Int16Array(d);
      // Drop oldest buffered samples if full (old logic corrupted read/write pointers)
      if (this._available + int16.length > this._ringSize) {
        const drop = this._available + int16.length - this._ringSize;
        this._readPos = (this._readPos + drop) % this._ringSize;
        this._available -= drop;
      }
      for (let i = 0; i < int16.length; i++) {
        this._ring[this._writePos] = int16[i] / 32768;
        this._writePos = (this._writePos + 1) % this._ringSize;
      }
      this._available += int16.length;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const outBuf = output[0];
    const ratio = this._sourceRate / sampleRate;

    for (let i = 0; i < outBuf.length; i++) {
      if (this._available <= 0) {
        outBuf[i] = 0;
        continue;
      }

      const srcIdx = i * ratio;
      const lo = Math.floor(srcIdx);

      if (lo >= this._available) {
        outBuf[i] = 0;
        continue;
      }

      const rLo = (this._readPos + lo) % this._ringSize;
      // Last available sample: duplicate instead of wrapping into unread ring (reduces clicks / corruption)
      const rHi =
        lo + 1 < this._available
          ? (this._readPos + lo + 1) % this._ringSize
          : rLo;
      const frac = srcIdx - lo;
      outBuf[i] = this._ring[rLo] * (1 - frac) + this._ring[rHi] * frac;
    }

    const consumed = Math.min(
      Math.floor(outBuf.length * ratio),
      this._available
    );
    this._readPos = (this._readPos + consumed) % this._ringSize;
    this._available -= consumed;

    const playing = this._available > 0;
    if (playing !== this._lastPlayingPosted) {
      this._lastPlayingPosted = playing;
      this.port.postMessage({ playing });
    }

    return true;
  }
}

registerProcessor("playback-processor", PlaybackProcessor);
