import { GoogleGenAI, Modality } from "@google/genai";
import { getProfile, requireUser } from "@/lib/auth";
import { seedCallFromChat } from "@/lib/call/conversation-memory";
import { SAFETY_SYSTEM_ADDENDUM } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { getAppSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveVoiceName } from "@/lib/ai/voice";
import { applyFreeMediaAccess, isTestingFreeMedia } from "@/lib/testing";
import { matchCharacterGender } from "@/lib/utils";
import type { AccessState, Character } from "@/types/database";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    characterId: z.string().uuid().optional(),
    conversationId: z.string().uuid().optional(),
    slug: z.string().optional(),
    characterSlug: z.string().optional(),
  })
  .transform((d) => ({
    characterId: d.characterId,
    conversationId: d.conversationId,
    slug: d.slug || d.characterSlug,
  }));

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("call", user.id);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many call attempts — wait a few seconds and try again" },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.is_banned) {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  const service = createServiceClient();
  const settings = await getAppSettings();
  const freeTesting = isTestingFreeMedia();

  const { data: accessRaw } = await service.rpc("get_access_state", {
    p_user_id: user.id,
  });
  const access = applyFreeMediaAccess(accessRaw as AccessState);

  if (!freeTesting && !access.can_call) {
    return NextResponse.json(
      {
        error: "Cannot start call — add wallet balance first",
        type: "paywall",
        ...access,
      },
      { status: 402 }
    );
  }

  let character: Character | null = null;
  let conversationId = parsed.data.conversationId ?? null;

  if (conversationId) {
    const { data: conv } = await service
      .from("conversations")
      .select("*, character:characters(*)")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    character = conv.character as Character;
  } else {
    let q = service.from("characters").select("*").eq("is_active", true);
    if (parsed.data.characterId) q = q.eq("id", parsed.data.characterId);
    else if (parsed.data.slug) q = q.eq("slug", parsed.data.slug);
    else {
      return NextResponse.json(
        { error: "characterId, slug, or conversationId required" },
        { status: 400 }
      );
    }
    const { data: char } = await q.maybeSingle();
    character = char as Character | null;

    if (character) {
      const { data: existing } = await service
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("character_id", character.id)
        .maybeSingle();
      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: created } = await service
          .from("conversations")
          .insert({ user_id: user.id, character_id: character.id })
          .select("id")
          .single();
        conversationId = created?.id ?? null;
      }
    }
  }

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (
    !matchCharacterGender(
      profile.gender,
      character.gender as "male" | "female"
    )
  ) {
    return NextResponse.json(
      { error: "Character not available for your profile" },
      { status: 403 }
    );
  }

  // Close any stale open sessions so retry works
  await service
    .from("call_sessions")
    .update({
      ended_at: new Date().toISOString(),
      end_reason: "abandoned",
    })
    .eq("user_id", user.id)
    .is("ended_at", null);

  const maxSeconds = settings.max_call_seconds;
  const { data: session, error: sessionError } = await service
    .from("call_sessions")
    .insert({
      user_id: user.id,
      character_id: character.id,
      conversation_id: conversationId,
      max_seconds: maxSeconds,
    })
    .select("*")
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: sessionError?.message ?? "Failed to create session" },
      { status: 500 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model =
    process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-09-2025";

  const systemInstruction = [
    character.persona_prompt,
    character.speaking_style
      ? `Speaking style: ${character.speaking_style}`
      : "",
    `Voice name hint: ${character.voice_name}`,
    SAFETY_SYSTEM_ADDENDUM,
    "This is a live voice call. Keep replies short and warm in natural English. PG-13 only.",
  ]
    .filter(Boolean)
    .join("\n\n");

  let tokenName: string | null = null;
  // While testing free media, prefer stable browser-voice demo.
  // Gemini Live often opens then drops with the current key/model.
  let demo = freeTesting;
  const forceLive = process.env.FORCE_GEMINI_LIVE === "true";

  if ((!freeTesting || forceLive) && apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        apiVersion: "v1alpha",
      });

      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(
            Date.now() + 2 * 60 * 1000
          ).toISOString(),
          liveConnectConstraints: {
            model,
            config: {
              responseModalities: [Modality.AUDIO],
              systemInstruction,
              sessionResumption: {},
              contextWindowCompression: {
                slidingWindow: {},
              },
            },
          },
          lockAdditionalFields: ["systemInstruction"],
        },
      });
      tokenName = token.name ?? null;
      if (!tokenName) throw new Error("Empty token");
      demo = false;
    } catch (err) {
      console.error("Gemini ephemeral token failed", err);
      if (!freeTesting) {
        await service
          .from("call_sessions")
          .update({
            ended_at: new Date().toISOString(),
            end_reason: "error",
          })
          .eq("id", session.id);
        return NextResponse.json(
          { error: "Could not create call token" },
          { status: 502 }
        );
      }
      demo = true;
      tokenName = null;
    }
  } else if (!apiKey && !freeTesting) {
    await service
      .from("call_sessions")
      .update({
        ended_at: new Date().toISOString(),
        end_reason: "error",
      })
      .eq("id", session.id);
    return NextResponse.json(
      { error: "Voice calls temporarily unavailable" },
      { status: 503 }
    );
  }

  const voiceName = resolveVoiceName({
    gender: character.gender,
    name: character.name,
    preferred: character.voice_name,
  });

  // Soft pickup — warm hello, never "bol/bolo" command tone
  const femaleGreets = ["हेलो…", "हाय…", "अरे हेलो", "हम्म हेलो…"];
  const maleGreets = ["हेलो…", "हाय", "अरे हेलो", "हेलो यार…"];
  const greets = character.gender === "male" ? maleGreets : femaleGreets;
  const greeting = greets[Math.floor(Math.random() * greets.length)]!;

  // Seed prior chat into call memory so replies can continue those topics
  if (conversationId) {
    const { data: prior } = await service
      .from("messages")
      .select("role, content, kind")
      .eq("conversation_id", conversationId)
      .eq("kind", "text")
      .order("created_at", { ascending: false })
      .limit(10);
    if (prior?.length) {
      seedCallFromChat(
        session.id,
        [...prior].reverse().map((m) => ({
          role: String(m.role),
          content: String(m.content || ""),
        }))
      );
    }
  }

  // Don't block call connect on Kie TTS (5–15s) — client fetches /speak for greeting
  // Blocking here made start slow + remount races cancelled the call on answer
  return NextResponse.json({
    sessionId: session.id,
    token: tokenName,
    demo,
    maxSeconds,
    model,
    conversationId,
    characterId: character.id,
    gender: character.gender,
    voiceName,
    greeting,
    greetingAudioBase64: null,
    greetingSampleRate: 24000,
    greetingMimeType: null,
    greetingProvider: null,
    coverUrl: character.cover_url,
    referenceImageUrls: character.reference_image_urls ?? [],
    wsUrl:
      "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained",
    video_paise_per_min: freeTesting ? 0 : access.video_paise_per_min,
    wallet_balance: access.wallet_balance,
    free_testing: freeTesting,
  });
}
