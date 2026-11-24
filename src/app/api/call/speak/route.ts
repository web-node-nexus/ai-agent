import { synthesizeCallSpeech } from "@/lib/ai/call-tts";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(500),
  characterId: z.string().uuid().optional(),
  slug: z.string().optional(),
  characterSlug: z.string().optional(),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("call_speak", user.id);
  if (!limited.success) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const slug = parsed.data.slug || parsed.data.characterSlug;
  const service = createServiceClient();

  let gender: string | null = null;
  let name: string | null = null;
  let voiceName: string | null = null;

  if (parsed.data.characterId || slug) {
    let q = service.from("characters").select("name, gender, voice_name").eq("is_active", true);
    if (parsed.data.characterId) q = q.eq("id", parsed.data.characterId);
    else q = q.eq("slug", slug!);
    const { data: character } = await q.maybeSingle();
    if (character) {
      gender = character.gender;
      name = character.name;
      voiceName = character.voice_name;
    }
  }

  try {
    const audio = await synthesizeCallSpeech({
      text: parsed.data.text,
      gender,
      name,
    });

    return NextResponse.json({
      audioBase64: audio.pcm.toString("base64"),
      mimeType: audio.mimeType,
      sampleRate: audio.sampleRate,
      voiceName: audio.voiceName,
      provider: audio.provider ?? "gemini",
      language: "hi",
      gender,
    });
  } catch (e) {
    console.error("[call/speak]", e);
    // Client can still speak Hindi via browser voice fallback
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "TTS failed",
        voiceFallback: true,
        text: parsed.data.text,
        language: "hi",
        gender,
      },
      { status: 200 }
    );
  }
}
