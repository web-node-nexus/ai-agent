import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { pickUnusedIndianGallery } from "@/lib/character-cover";
import { createServiceClient } from "@/lib/supabase/server";
import type { Character } from "@/types/database";

const INDIAN_CITIES = [
  "Delhi",
  "Mumbai",
  "Bangalore",
  "Pune",
  "Jaipur",
  "Lucknow",
  "Chandigarh",
  "Hyderabad",
  "Kolkata",
  "Ahmedabad",
  "Indore",
  "Goa",
  "Surat",
  "Nagpur",
  "Bhopal",
  "Kochi",
];

const FEMALE_NAMES = [
  "Ishita",
  "Kavya",
  "Sana",
  "Diya",
  "Anvi",
  "Myra",
  "Zara",
  "Pari",
  "Aanya",
  "Riya",
  "Naina",
  "Meher",
  "Anaya",
  "Kaaya",
  "Radha",
  "Isha",
  "Trisha",
  "Nyra",
  "Kiara",
  "Aarohi",
  "Vanya",
  "Sara",
  "Mira",
  "Leela",
  "Pihu",
  "Anika",
  "Rhea",
  "Siya",
  "Tara",
  "Jiya",
  "Navya",
  "Aisha",
  "Inaaya",
  "Prisha",
  "Shanaya",
  "Keya",
  "Disha",
  "Mahika",
  "Ritika",
  "Saanvi",
];

const MALE_NAMES = [
  "Aarav",
  "Vivaan",
  "Reyansh",
  "Dev",
  "Yash",
  "Ishaan",
  "Neil",
  "Kian",
  "Arjun",
  "Kabir",
  "Rohan",
  "Vihaan",
  "Advait",
  "Shaurya",
  "Dhruv",
  "Kartik",
  "Ayaan",
  "Rudra",
  "Veer",
  "Atharv",
  "Krish",
  "Samar",
  "Arnav",
  "Rian",
  "Om",
  "Parth",
  "Harsh",
  "Kunal",
  "Raghav",
  "Madhav",
  "Agastya",
  "Yuven",
  "Darsh",
  "Ivaan",
  "Reyansh",
  "Shivansh",
];

export type GeneratedCharacterDraft = {
  name: string;
  age: number;
  city: string;
  bio: string;
  tags: string[];
  speaking_style: string;
  persona_prompt: string;
  sample_lines: string[];
  voice_name: string;
};

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `gen-${base || "companion"}-${suffix}`;
}

async function unusedName(
  gender: "male" | "female",
  taken: Set<string>
): Promise<string | null> {
  const pool = gender === "female" ? FEMALE_NAMES : MALE_NAMES;
  const free = pool.filter((n) => !taken.has(n.toLowerCase()));
  if (!free.length) return null;
  return free[Math.floor(Math.random() * free.length)]!;
}

function draftFromName(
  name: string,
  gender: "male" | "female"
): GeneratedCharacterDraft {
  const city = INDIAN_CITIES[Math.floor(Math.random() * INDIAN_CITIES.length)]!;
  const age = 22 + Math.floor(Math.random() * 8);
  const tags =
    gender === "female"
      ? ["chai", "music", "late nights"]
      : ["gym", "travel", "playlists"];
  return {
    name,
    age,
    city,
    bio: `${name} from ${city} — warm energy, light humour, real-talk vibes.`,
    tags,
    speaking_style: "Short, human, English, lightly flirty PG-13",
    persona_prompt: `You are ${name}, ${age}, from ${city}. Warm ${
      gender === "female" ? "girlfriend-style friend" : "boyfriend-style friend"
    } tone in natural English. You are a virtual companion on TaraWorld. PG-13 only. Never claim to be a real person or able to meet offline. Never guilt-trip or push spending. Crisis: Tele-MANAS 14416.`,
    sample_lines: [
      "Tell me — what's the mood today?",
      "Soft talk or spicy banter — you decide.",
      "I'm right here — no pressure, just vibe.",
    ],
    voice_name: gender === "female" ? "Aoede" : "Charon",
  };
}

async function loadTakenNames(
  service: ReturnType<typeof createServiceClient>
): Promise<Set<string>> {
  const { data } = await service.from("characters").select("name").eq("is_active", true);
  return new Set((data ?? []).map((r) => String(r.name).toLowerCase()));
}

async function loadTakenCovers(
  service: ReturnType<typeof createServiceClient>
): Promise<Set<string>> {
  const { data } = await service
    .from("characters")
    .select("cover_url")
    .eq("is_active", true);
  return new Set(
    (data ?? []).map((r) => String(r.cover_url || "")).filter(Boolean)
  );
}

function pickUniqueGallery(
  gender: "male" | "female",
  seed: string,
  takenCovers: Set<string>
): string[] {
  return pickUnusedIndianGallery(gender, seed, takenCovers);
}

async function draftWithClaude(
  gender: "male" | "female",
  taken: Set<string>
): Promise<GeneratedCharacterDraft> {
  const key = process.env.ANTHROPIC_API_KEY;
  const fallbackName = await unusedName(gender, taken);
  if (!key) {
    if (!fallbackName) throw new Error("No unique names left");
    return draftFromName(fallbackName, gender);
  }

  const client = new Anthropic({ apiKey: key });
  const model = process.env.CLAUDE_UTILITY_MODEL || "claude-haiku-4-5";
  const avoid = [...taken].slice(0, 40).join(", ");

  const msg = await client.messages.create({
    model,
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Create one unique Indian companion character as JSON only (no markdown).
Gender: ${gender}
Avoid these names (already used): ${avoid || "none"}
Rules: age 22-29, Indian city, 3 short tags, warm English persona, PG-13 romantic-friendly, NOT sexual.
Fields: name, age, city, bio, tags (string[3]), speaking_style, persona_prompt (120-200 words including safety: virtual companion on TaraWorld not a real person, no meetups, no guilt/spend pressure, Tele-MANAS 14416), sample_lines (string[3] in English), voice_name (female: Aoede|Kore|Leda|Zephyr ; male: Charon|Fenrir|Orus|Puck).
Name MUST be unique and not in the avoid list.`,
      },
    ],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    if (!fallbackName) throw new Error("No unique names left");
    return draftFromName(fallbackName, gender);
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as GeneratedCharacterDraft;
    if (!parsed.name || !parsed.city) {
      if (!fallbackName) throw new Error("No unique names left");
      return draftFromName(fallbackName, gender);
    }
    if (taken.has(parsed.name.toLowerCase())) {
      if (!fallbackName) throw new Error("No unique names left");
      return draftFromName(fallbackName, gender);
    }
    parsed.age = Math.min(29, Math.max(22, Number(parsed.age) || 24));
    parsed.tags = (parsed.tags || []).slice(0, 4);
    parsed.sample_lines = (parsed.sample_lines || []).slice(0, 3);
    return parsed;
  } catch {
    if (!fallbackName) throw new Error("No unique names left");
    return draftFromName(fallbackName, gender);
  }
}

async function generateCoverBuffer(
  draft: GeneratedCharacterDraft,
  gender: "male" | "female"
): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
    const prompt = `Photorealistic vertical portrait of a young Indian ${gender} named ${draft.name}, age ${draft.age}, from ${draft.city}. Natural Indian / South Asian features and warm brown skin only — not European, not East Asian. Soft premium lighting, tasteful PG-13 Indian urban fashion, warm smile, editorial app cover, shallow depth of field. No text, no watermark, SFW. Unique face, not a celebrity.`;
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
  } catch (e) {
    console.error("[generate-character] image", e);
  }
  return null;
}

export async function createAiCharacter(
  gender: "male" | "female",
  opts?: { fast?: boolean }
): Promise<Character> {
  const service = createServiceClient();
  const takenNames = await loadTakenNames(service);
  const takenCovers = await loadTakenCovers(service);

  const draft = opts?.fast
    ? (() => {
        // sync path needs unused name — throw if exhausted
        const pool = gender === "female" ? FEMALE_NAMES : MALE_NAMES;
        const free = pool.filter((n) => !takenNames.has(n.toLowerCase()));
        if (!free.length) throw new Error("No unique names left");
        const name = free[Math.floor(Math.random() * free.length)]!;
        return draftFromName(name, gender);
      })()
    : await draftWithClaude(gender, takenNames);

  const slug = slugify(draft.name);

  let gallery = pickUniqueGallery(gender, slug, takenCovers);
  let coverUrl = gallery[0]!;

  if (!opts?.fast) {
    const buf = await generateCoverBuffer(draft, gender);
    if (buf) {
      const path = `generated/${slug}/cover.jpg`;
      const { error: upErr } = await service.storage
        .from("characters")
        .upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (!upErr) {
        const { data: pub } = service.storage.from("characters").getPublicUrl(path);
        if (pub?.publicUrl) {
          coverUrl = pub.publicUrl;
          // Keep matching stock variants as extra angles of a similar look,
          // with the generated cover first.
          gallery = [coverUrl, ...gallery.filter((u) => u !== coverUrl)];
        }
      }
    }
  }

  const { data: maxRow } = await service
    .from("characters")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? 100) + 1;

  const row = {
    slug,
    name: draft.name,
    gender,
    age: draft.age,
    city: draft.city,
    bio: draft.bio,
    tags: draft.tags,
    persona_prompt: draft.persona_prompt,
    speaking_style: draft.speaking_style,
    voice_name: draft.voice_name || (gender === "female" ? "Aoede" : "Charon"),
    avatar_vrm_url: null,
    cover_url: coverUrl,
    reference_image_urls: gallery,
    sample_lines: draft.sample_lines,
    is_active: true,
    sort_order: sortOrder,
  };

  const { data, error } = await service
    .from("characters")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as Character;
}
