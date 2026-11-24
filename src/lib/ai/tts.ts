import {
  synthesizeElevenLabs,
  isElevenLabsConfigured,
} from "@/lib/ai/elevenlabs-tts";
import {
  synthesizeKieElevenLabs,
  isKieTtsConfigured,
} from "@/lib/ai/kie-tts";
import {
  synthesizeOpenAi,
  isOpenAiTtsConfigured,
} from "@/lib/ai/openai-tts";
import { toSpeechScript } from "@/lib/call/speech-script";
import { resolveVoiceName } from "@/lib/ai/voice";

export type TtsResult = {
  pcm: Buffer;
  mimeType: string;
  sampleRate: number;
  voiceName: string;
  provider?: "elevenlabs" | "kie-elevenlabs" | "openai" | "gemini" | "fal";
};

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

function errorMessage(json: Record<string, unknown>, status: number) {
  if (
    typeof json.error === "object" &&
    json.error &&
    "message" in (json.error as object)
  ) {
    return String((json.error as { message: string }).message);
  }
  return `TTS HTTP ${status}`;
}

async function synthesizeGemini(params: {
  text: string;
  gender?: string | null;
  name?: string | null;
  voiceName?: string | null;
  style?: string;
  language?: "hi" | "en";
}): Promise<TtsResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const voiceName = resolveVoiceName({
    gender: params.gender,
    name: params.name,
    preferred: params.voiceName,
  });

  const model =
    process.env.GEMINI_TTS_MODEL?.includes("pro")
      ? "gemini-2.5-flash-preview-tts"
      : process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";

  const lang = params.language || "hi";
  const genderWord = params.gender === "male" ? "male" : "female";
  const style =
    params.style ||
    (lang === "hi"
      ? "Speak natural conversational Hindi with a clear Indian accent, like a young friend on a phone call. Soft, warm, not robotic, not American."
      : "Speak like a real friend on a phone call. Soft, warm, casual. Not robotic.");

  const prompt = `${style}
Use a natural ${genderWord} Indian phone voice.
Say exactly this line and nothing else:
${params.text}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    }),
  });
  let json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["AUDIO"] },
      }),
    });
    json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }

  if (!res.ok) throw new Error(errorMessage(json, res.status));

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

/**
 * Call TTS — Gemini first (fast, ~2s), then Kie/OpenAI fallback.
 * Do NOT race every provider: racing burned Gemini quota after 2–3 turns
 * and left only slow Kie (~5–7s).
 */
export async function synthesizeSpeech(params: {
  text: string;
  gender?: string | null;
  name?: string | null;
  voiceName?: string | null;
  style?: string;
  language?: "hi" | "en";
}): Promise<TtsResult> {
  const spoken = toSpeechScript(params.text);
  const next = { ...params, text: spoken };

  if (isElevenLabsConfigured()) {
    try {
      const el = await synthesizeElevenLabs({
        text: next.text,
        gender: next.gender,
        voiceId: next.voiceName,
      });
      return {
        pcm: el.audio,
        mimeType: el.mimeType,
        sampleRate: el.sampleRate,
        voiceName: el.voiceId,
        provider: "elevenlabs",
      };
    } catch (e) {
      console.error("[tts] elevenlabs failed", e);
    }
  }

  // Fast path for live calls
  try {
    return await withTimeout(synthesizeGemini(next), 4500);
  } catch (e) {
    console.warn("[tts] gemini fast path missed", e);
  }

  if (isKieTtsConfigured()) {
    try {
      const kie = await withTimeout(
        synthesizeKieElevenLabs({
          text: next.text,
          gender: next.gender,
          voiceId: next.voiceName,
        }),
        10000
      );
      return {
        pcm: kie.audio,
        mimeType: kie.mimeType,
        sampleRate: kie.sampleRate,
        voiceName: kie.voiceId,
        provider: "kie-elevenlabs",
      };
    } catch (e) {
      console.error("[tts] kie-elevenlabs failed", e);
    }
  }

  if (isOpenAiTtsConfigured()) {
    try {
      const oa = await withTimeout(
        synthesizeOpenAi({ text: next.text, gender: next.gender }),
        6000
      );
      return {
        pcm: oa.audio,
        mimeType: oa.mimeType,
        sampleRate: oa.sampleRate,
        voiceName: oa.voiceName,
        provider: "openai",
      };
    } catch (e) {
      console.error("[tts] openai failed", e);
    }
  }

  // Last try Gemini without short timeout
  return synthesizeGemini(next);
}
