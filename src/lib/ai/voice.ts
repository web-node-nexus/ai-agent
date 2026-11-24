/** Gemini prebuilt voices — pick the warmest phone-like ones first. */

const FEMALE_VOICES = ["Aoede", "Leda", "Zephyr", "Kore"] as const;
const MALE_VOICES = ["Charon", "Orus", "Fenrir", "Puck"] as const;

const ALL = new Set<string>([...FEMALE_VOICES, ...MALE_VOICES]);

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function resolveVoiceName(params: {
  gender?: string | null;
  name?: string | null;
  preferred?: string | null;
}): string {
  const preferred = (params.preferred || "").trim();
  if (preferred && ALL.has(preferred)) return preferred;

  const female = params.gender !== "male";
  const pool = female ? FEMALE_VOICES : MALE_VOICES;
  const seed = params.name || preferred || "companion";
  return pool[hash(seed) % pool.length]!;
}

export function voiceGenderLabel(voiceName: string): "female" | "male" {
  return (MALE_VOICES as readonly string[]).includes(voiceName)
    ? "male"
    : "female";
}
