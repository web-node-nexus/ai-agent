/** ElevenLabs TTS — fast call voice (turbo) with emotional settings. */

export type ElevenAudio = {
  audio: Buffer;
  mimeType: string;
  sampleRate: number;
  voiceId: string;
  provider: "elevenlabs";
};

function isElevenVoiceId(v?: string | null): boolean {
  if (!v) return false;
  return /^[a-zA-Z0-9]{16,}$/.test(v.trim());
}

function pickVoiceId(gender?: string | null, preferred?: string | null): string {
  if (isElevenVoiceId(preferred)) return preferred!.trim();
  if (gender === "male") {
    return (
      process.env.ELEVENLABS_VOICE_MALE?.trim() || "TX3LPaxmHKxFdv7VOQHJ"
    );
  }
  return (
    process.env.ELEVENLABS_VOICE_FEMALE?.trim() || "cgSgspJ2msm6clMCkdW9"
  );
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

/**
 * Call TTS — turbo for low latency (multilingual_v2 was 2–4s too slow).
 */
export async function synthesizeElevenLabs(params: {
  text: string;
  gender?: string | null;
  voiceId?: string | null;
}): Promise<ElevenAudio> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");

  const voiceId = pickVoiceId(params.gender, params.voiceId);
  // turbo_v2_5 ≈ low latency + Hindi OK; override via env if needed
  const model =
    process.env.ELEVENLABS_MODEL?.trim() || "eleven_turbo_v2_5";
  const outputFormat =
    process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128";

  const text = params.text.replace(/\s+/g, " ").trim();

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    voiceId
  )}?output_format=${encodeURIComponent(outputFormat)}&optimize_streaming_latency=3`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: model,
      language_code: "hi",
      voice_settings: {
        stability: 0.25,
        similarity_boost: 0.85,
        style: 0.55,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs ${res.status}: ${errText.slice(0, 240) || res.statusText}`
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("ElevenLabs returned empty audio");

  const isPcm = outputFormat.startsWith("pcm_");
  const sampleRate = isPcm
    ? Number(outputFormat.replace("pcm_", "")) || 24000
    : 44100;

  return {
    audio: buf,
    mimeType: isPcm ? `audio/L16;rate=${sampleRate}` : "audio/mpeg",
    sampleRate,
    voiceId,
    provider: "elevenlabs",
  };
}
