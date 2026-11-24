/**
 * Captures mic input as Int16 PCM frames for Gemini Live (16 kHz expected).
 * AudioContext should be created at 16000 Hz when supported; otherwise
 * the main thread resamples before sending.
 */
class Pcm16CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      const pcm = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        const s = Math.max(-1, Math.min(1, channel[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm16-capture", Pcm16CaptureProcessor);
