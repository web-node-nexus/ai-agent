/** Client helpers for Gemini Live constrained WebSocket + PCM audio. */

export const GEMINI_LIVE_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function resampleInt16(
  input: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const t = src - i0;
    out[i] = (input[i0] * (1 - t) + input[i1] * t) | 0;
  }
  return out as Int16Array;
}

export type PlaybackQueue = {
  enqueue: (pcm16: Int16Array, sampleRate?: number) => void;
  interrupt: () => void;
  dispose: () => void;
  getAnalyser: () => AnalyserNode | null;
};

export function createPlaybackQueue(
  ctx: AudioContext,
  onSpeakingChange?: (speaking: boolean) => void
): PlaybackQueue {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.connect(ctx.destination);

  let nextTime = 0;
  const sources: AudioBufferSourceNode[] = [];
  let speaking = false;

  const setSpeaking = (v: boolean) => {
    if (speaking === v) return;
    speaking = v;
    onSpeakingChange?.(v);
  };

  return {
    getAnalyser: () => analyser,
    enqueue(pcm16, sampleRate = 24000) {
      if (pcm16.length === 0) return;
      const buffer = ctx.createBuffer(1, pcm16.length, sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channel[i] = pcm16[i] / 32768;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(analyser);
      const startAt = Math.max(ctx.currentTime, nextTime);
      src.start(startAt);
      nextTime = startAt + buffer.duration;
      sources.push(src);
      setSpeaking(true);
      src.onended = () => {
        const idx = sources.indexOf(src);
        if (idx >= 0) sources.splice(idx, 1);
        if (sources.length === 0) setSpeaking(false);
      };
    },
    interrupt() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      sources.length = 0;
      nextTime = ctx.currentTime;
      setSpeaking(false);
    },
    dispose() {
      this.interrupt();
      try {
        analyser.disconnect();
      } catch {
        /* noop */
      }
    },
  };
}

export async function startMicCapture(
  onPcm: (pcm16: Int16Array, sampleRate: number) => void
): Promise<{
  ctx: AudioContext;
  stream: MediaStream;
  stop: () => void;
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
    video: false,
  });

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: 16000 });
  } catch {
    ctx = new AudioContext();
  }

  const source = ctx.createMediaStreamSource(stream);
  let workletOk = false;
  let processor: ScriptProcessorNode | null = null;
  let workletNode: AudioWorkletNode | null = null;

  try {
    await ctx.audioWorklet.addModule("/audio-worklet-processor.js");
    workletNode = new AudioWorkletNode(ctx, "pcm16-capture");
    workletNode.port.onmessage = (ev) => {
      const buf = ev.data as ArrayBuffer;
      const raw = new Int16Array(buf);
      const pcm =
        ctx.sampleRate === 16000
          ? raw
          : resampleInt16(raw, ctx.sampleRate, 16000);
      onPcm(pcm, 16000);
    };
    source.connect(workletNode);
    // Keep graph alive without feedback
    const mute = ctx.createGain();
    mute.gain.value = 0;
    workletNode.connect(mute);
    mute.connect(ctx.destination);
    workletOk = true;
  } catch {
    workletOk = false;
  }

  if (!workletOk) {
    processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const out =
        ctx.sampleRate === 16000
          ? pcm
          : resampleInt16(pcm, ctx.sampleRate, 16000);
      onPcm(out, 16000);
    };
    source.connect(processor);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    processor.connect(mute);
    mute.connect(ctx.destination);
  }

  if (ctx.state === "suspended") await ctx.resume();

  return {
    ctx,
    stream,
    stop: () => {
      workletNode?.disconnect();
      processor?.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

export function connectGeminiLive(
  token: string,
  handlers: {
    onOpen?: () => void;
    onAudio?: (pcm16: Int16Array, mimeType: string) => void;
    onText?: (text: string) => void;
    onInterrupted?: () => void;
    onClose?: (ev: CloseEvent) => void;
    onError?: (err: Event) => void;
  }
) {
  const url = `${GEMINI_LIVE_WS}?access_token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => handlers.onOpen?.();
  ws.onerror = (e) => handlers.onError?.(e);
  ws.onclose = (e) => handlers.onClose?.(e);

  ws.onmessage = async (ev) => {
    try {
      let raw: string;
      if (typeof ev.data === "string") {
        raw = ev.data;
      } else if (ev.data instanceof Blob) {
        raw = await ev.data.text();
      } else if (ev.data instanceof ArrayBuffer) {
        raw = new TextDecoder().decode(ev.data);
      } else {
        return;
      }
      const msg = JSON.parse(raw) as Record<string, unknown>;

      if (msg.serverContent) {
        const sc = msg.serverContent as Record<string, unknown>;
        if (sc.interrupted) handlers.onInterrupted?.();

        const modelTurn = sc.modelTurn as
          | { parts?: Array<Record<string, unknown>> }
          | undefined;
        for (const part of modelTurn?.parts ?? []) {
          if (typeof part.text === "string") handlers.onText?.(part.text);
          const inline = part.inlineData as
            | { data?: string; mimeType?: string }
            | undefined;
          if (inline?.data) {
            const buf = base64ToArrayBuffer(inline.data);
            handlers.onAudio?.(
              new Int16Array(buf),
              inline.mimeType ?? "audio/pcm;rate=24000"
            );
          }
        }
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  const sendRealtimePcm = (pcm16: Int16Array) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: arrayBufferToBase64(pcm16.buffer as ArrayBuffer),
            },
          ],
        },
      })
    );
  };

  const sendClientContent = (text: string) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true,
        },
      })
    );
  };

  return { ws, sendRealtimePcm, sendClientContent };
}
