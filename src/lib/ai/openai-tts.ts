/** OpenAI gpt-4o-mini-tts — natural phone voice (Hindi via instructions). */

export type OpenAiAudio = {
  audio: Buffer;
  mimeType: string;
  sampleRate: number;
  voiceName: string;
  provider: "openai";
};

export function isOpenAiTtsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function pickVoice(gender?: string | null): string {
  if (gender === "male") {
    return process.env.OPENAI_TTS_VOICE_MALE?.trim() || "ash";
  }
  return process.env.OPENAI_TTS_VOICE_FEMALE?.trim() || "coral";
}

function instructions(gender?: string | null): string {
  const who =
    gender === "male"
      ? "young Indian man talking casually on a phone call"
      : "young Indian woman talking casually on a phone call";
  return [
    `You are a ${who}.`,
    "Speak natural conversational Hindi / Hinglish — warm, soft, imperfect, like a real friend.",
    "Indian accent. Not American. Not robotic. Not announcer-style.",
    "Slight smile in the voice. Short natural pauses. Say only the given line.",
  ].join(" ");
}

/**
 * Human-sounding TTS for calls. Prefer over Gemini; ElevenLabs still best for Hindi.
 */
export async function synthesizeOpenAi(params: {
  text: string;
  gender?: string | null;
}): Promise<OpenAiAudio> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const model =
    process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  const voice = pickVoice(params.gender);

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: params.text,
      instructions: instructions(params.gender),
      response_format: "mp3",
      speed: 1.05,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `OpenAI TTS ${res.status}: ${errText.slice(0, 240) || res.statusText}`
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("OpenAI TTS returned empty audio");

  return {
    audio: buf,
    mimeType: "audio/mpeg",
    sampleRate: 24000,
    voiceName: voice,
    provider: "openai",
  };
}
