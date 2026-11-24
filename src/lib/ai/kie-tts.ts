/**
 * ElevenLabs TTS via Kie.ai marketplace (uses KIE_API_KEY).
 * Models: turbo-2-5 (fast calls) / multilingual-v2 (best Hindi).
 * Docs: https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5
 */

import { isKieConfigured } from "@/lib/ai/kie-video";

const KIE_BASE = "https://api.kie.ai";

export type KieTtsAudio = {
  audio: Buffer;
  mimeType: string;
  sampleRate: number;
  voiceId: string;
  provider: "kie-elevenlabs";
};

function apiKey(): string {
  const key = process.env.KIE_API_KEY?.trim();
  if (!key) throw new Error("KIE_API_KEY missing");
  return key;
}

function ttsModel(): string {
  // turbo-2-5 = lower latency for live calls (race with Gemini)
  return (
    process.env.KIE_TTS_MODEL?.trim() || "elevenlabs/text-to-speech-turbo-2-5"
  );
}

function pickVoice(gender?: string | null, preferred?: string | null): string {
  if (preferred && /^[a-zA-Z0-9]{16,}$/.test(preferred.trim())) {
    return preferred.trim();
  }
  if (gender === "male") {
    return (
      process.env.KIE_TTS_VOICE_MALE?.trim() ||
      // Daniel — clear conversational male (verified on Kie)
      "onwK4e9ZLuTAKqWW03F9"
    );
  }
  return (
    process.env.KIE_TTS_VOICE_FEMALE?.trim() ||
    // Sarah — warm mature female (verified on Kie)
    "EXAVITQu4vr4xnSDxMaL"
  );
}

export function isKieTtsConfigured(): boolean {
  return isKieConfigured();
}

type KieEnvelope<T> = { code?: number; msg?: string; data?: T };

async function kieFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${KIE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as KieEnvelope<T>;
  const code = json.code ?? res.status;
  if (!res.ok || (typeof code === "number" && code !== 200)) {
    throw new Error(
      `Kie TTS ${code}: ${json.msg || res.statusText || "request failed"}`
    );
  }
  if (json.data === undefined || json.data === null) {
    throw new Error(`Kie TTS ${path}: empty data`);
  }
  return json.data;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createTask(params: {
  text: string;
  voiceId: string;
}): Promise<string> {
  const data = await kieFetch<{ taskId: string }>("/api/v1/jobs/createTask", {
    method: "POST",
    body: JSON.stringify({
      model: ttsModel(),
      input: {
        text: params.text,
        voice: params.voiceId,
        stability: 0.4,
        similarity_boost: 0.75,
        style: 0.2,
        speed: 1.05,
        timestamps: false,
        language_code: "hi",
      },
    }),
  });
  if (!data.taskId) throw new Error("Kie TTS: no taskId");
  return data.taskId;
}

async function waitForAudioUrl(
  taskId: string,
  timeoutMs = 6_500
): Promise<string> {
  const started = Date.now();
  let delay = 300;
  while (Date.now() - started < timeoutMs) {
    await sleep(delay);
    const info = await kieFetch<{
      taskId: string;
      state: string;
      resultJson?: string | null;
      failMsg?: string | null;
    }>(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);

    if (info.state === "success") {
      let urls: string[] = [];
      if (info.resultJson) {
        try {
          const parsed = JSON.parse(info.resultJson) as {
            resultUrls?: string[];
          };
          urls = parsed.resultUrls ?? [];
        } catch {
          urls = [];
        }
      }
      const url = urls[0];
      if (!url) throw new Error("Kie TTS success but no audio URL");
      return url;
    }
    if (info.state === "fail") {
      throw new Error(info.failMsg || "Kie TTS failed");
    }
    delay = Math.min(900, Math.round(delay * 1.15));
  }
  throw new Error(`Kie TTS timed out (taskId=${taskId})`);
}

/** Human ElevenLabs voice through Kie — preferred call TTS when direct EL key missing. */
export async function synthesizeKieElevenLabs(params: {
  text: string;
  gender?: string | null;
  voiceId?: string | null;
}): Promise<KieTtsAudio> {
  if (!isKieTtsConfigured()) throw new Error("KIE_API_KEY missing");

  const voiceId = pickVoice(params.gender, params.voiceId);
  const taskId = await createTask({ text: params.text, voiceId });
  const audioUrl = await waitForAudioUrl(taskId);

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Kie TTS download ${audioRes.status}`);
  }
  const buf = Buffer.from(await audioRes.arrayBuffer());
  if (buf.length < 200) throw new Error("Kie TTS empty audio");

  const ctype = audioRes.headers.get("content-type") || "";
  const mimeType = ctype.includes("wav")
    ? "audio/wav"
    : ctype.includes("mpeg") || ctype.includes("mp3")
      ? "audio/mpeg"
      : "audio/mpeg";

  return {
    audio: buf,
    mimeType,
    sampleRate: 44100,
    voiceId,
    provider: "kie-elevenlabs",
  };
}
