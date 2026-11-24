/**
 * Call TTS — ElevenLabs first (human). Gemini only if EL missing/fails.
 * Do NOT race Gemini against EL: Gemini often wins and sounds robotic.
 */

import {
  synthesizeElevenLabs,
  isElevenLabsConfigured,
} from "@/lib/ai/elevenlabs-tts";
import {
  synthesizeKieElevenLabs,
  isKieTtsConfigured,
} from "@/lib/ai/kie-tts";
import { toSpeechScript } from "@/lib/call/speech-script";
import { resolveVoiceName } from "@/lib/ai/voice";
import type { TtsResult } from "@/lib/ai/tts";

function pickAudioPart(payload: unknown): {
  data: string;
  mimeType: string;
} | null {
  const candidates =
    (payload as { candidates?: Array<{ content?: { parts?: unknown[] } }> })
      ?.candidates ?? [];
  for (const c of candidates) {
    for (const part of c.content?.parts ?? []) {
      const p = part as {
        inlineData?: { data?: string; mimeType?: string };
        inline_data?: { data?: string; mime_type?: string };
      };
      const data = p.inlineData?.data || p.inline_data?.data;
      const mime =
        p.inlineData?.mimeType ||
        p.inline_data?.mime_type ||
        "audio/L16;rate=24000";
      if (data) return { data, mimeType: mime };
    }
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("tts timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function synthesizeGeminiCall(params: {
  text: string;
  gender?: string | null;
  name?: string | null;
}): Promise<TtsResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const spoken = params.text;
  const voiceName = resolveVoiceName({
    gender: params.gender,
    name: params.name,
    preferred: null,
  });
  const genderWord = params.gender === "male" ? "male" : "female";
  const model =
    process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";

  const prompt = `You are a ${genderWord} Indian person on a casual phone call.
Speak natural Hindi with a clear Indian accent — warm, soft, slightly imperfect, like a real friend.
Not American. Not robotic. Not newsreader.
Say exactly this line only:
${spoken}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const makeBody = (withVoice: boolean) =>
    JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: withVoice
        ? {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          }
        : { responseModalities: ["AUDIO"] },
    });

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: makeBody(true),
  });
  let json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: makeBody(false),
    });
    json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }
  if (!res.ok) {
    const msg =
      typeof json.error === "object" &&
      json.error &&
      "message" in (json.error as object)
        ? String((json.error as { message: string }).message)
        : `TTS HTTP ${res.status}`;
    throw new Error(msg);
  }

  const audio = pickAudioPart(json);
  if (!audio) throw new Error("TTS returned no audio");
  const pcm = Buffer.from(audio.data, "base64");
  if (pcm.length < 500) throw new Error("TTS audio too short");
  const rateMatch = /rate=(\d+)/i.exec(audio.mimeType);

  return {
    pcm,
    mimeType: audio.mimeType,
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    voiceName,
    provider: "gemini",
  };
}

export async function synthesizeCallSpeech(params: {
  text: string;
  gender?: string | null;
  name?: string | null;
}): Promise<TtsResult> {
  const spoken = toSpeechScript(params.text);

  // 1) Direct ElevenLabs — exclusive when configured (don't let Gemini beat it)
  if (isElevenLabsConfigured()) {
    try {
      const el = await withTimeout(
        synthesizeElevenLabs({
          text: spoken,
          gender: params.gender,
        }),
        4000
      );
      console.info("[call-tts] provider=elevenlabs voice=", el.voiceId);
      return {
        pcm: el.audio,
        mimeType: el.mimeType,
        sampleRate: el.sampleRate,
        voiceName: el.voiceId,
        provider: "elevenlabs",
      };
    } catch (e) {
      console.warn("[call-tts] elevenlabs failed, falling back", e);
    }
  }

  // 2) Kie → ElevenLabs (only if no direct EL)
  if (isKieTtsConfigured() && !isElevenLabsConfigured()) {
    try {
      const kie = await withTimeout(
        synthesizeKieElevenLabs({
          text: spoken,
          gender: params.gender,
        }),
        7000
      );
      console.info("[call-tts] provider=kie-elevenlabs");
      return {
        pcm: kie.audio,
        mimeType: kie.mimeType,
        sampleRate: kie.sampleRate,
        voiceName: kie.voiceId,
        provider: "kie-elevenlabs",
      };
    } catch (e) {
      console.warn("[call-tts] kie failed", e);
    }
  }

  // 3) Gemini last resort
  const gem = await withTimeout(
    synthesizeGeminiCall({
      text: spoken,
      gender: params.gender,
      name: params.name,
    }),
    5000
  );
  console.info("[call-tts] provider=gemini");
  return gem;
}
