/** Play Gemini PCM (L16) as a real WAV via HTMLAudioElement — clearer than raw AudioContext queues. */

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** Decode base64 audio — supports PCM L16, WAV, and MP3 (ElevenLabs). */
export function audioBase64ToBlob(
  b64: string,
  mimeType?: string | null,
  sampleRate = 24000
): Blob | null {
  try {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const mime = (mimeType || "").toLowerCase();
    if (mime.includes("mpeg") || mime.includes("mp3")) {
      return new Blob([bytes], { type: "audio/mpeg" });
    }
    if (mime.includes("wav") || mime.includes("wave")) {
      return new Blob([bytes], { type: "audio/wav" });
    }

    // Already a WAV?
    if (
      bytes.length > 44 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      return new Blob([bytes], { type: "audio/wav" });
    }

    // MP3 frame sync without declared mime (FF FB / FF F3 / ID3)
    if (
      (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) ||
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
    ) {
      return new Blob([bytes], { type: "audio/mpeg" });
    }

    return pcmBytesToWavBlob(bytes, sampleRate);
  } catch {
    return null;
  }
}

export function pcmBase64ToWavBlob(
  b64: string,
  sampleRate = 24000
): Blob | null {
  return audioBase64ToBlob(b64, "audio/L16", sampleRate);
}

function pcmBytesToWavBlob(bytes: Uint8Array, sampleRate = 24000): Blob | null {
  try {
    // Already a WAV?
    if (
      bytes.length > 44 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      return new Blob([bytes], { type: "audio/wav" });
    }

    const dataSize = bytes.byteLength - (bytes.byteLength % 2);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(bytes.subarray(0, dataSize));
    return new Blob([buffer], { type: "audio/wav" });
  } catch {
    return null;
  }
}

/** Play mp3/wav/any browser-supported audio blob. */
export function playAudioBlob(blob: Blob): {
  audio: HTMLAudioElement;
  done: Promise<boolean>;
  stop: () => void;
} {
  return playWavBlob(blob);
}

export function playWavBlob(blob: Blob): {
  audio: HTMLAudioElement;
  done: Promise<boolean>;
  stop: () => void;
} {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = "auto";
  let stopped = false;

  const done = new Promise<boolean>((resolve) => {
    let settled = false;
    let started = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* noop */
      }
      resolve(ok && started && !stopped);
    };
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.onplaying = () => {
      started = true;
    };
    audio.onloadedmetadata = () => {
      const ms = Number.isFinite(audio.duration)
        ? audio.duration * 1000 + 800
        : 15000;
      window.setTimeout(() => finish(started), Math.min(45000, ms));
    };
    void audio
      .play()
      .then(() => {
        started = true;
      })
      .catch(() => finish(false));
    window.setTimeout(() => finish(started), 20000);
  });

  return {
    audio,
    done,
    stop: () => {
      stopped = true;
      try {
        audio.pause();
        audio.src = "";
      } catch {
        /* noop */
      }
      URL.revokeObjectURL(url);
    },
  };
}
