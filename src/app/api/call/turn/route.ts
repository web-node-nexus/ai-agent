import { synthesizeCallSpeech } from "@/lib/ai/call-tts";
import {
  generateHumanCallReply,
  looksLikeBadHear,
} from "@/lib/call/human-reply";
import {
  getAssistantCount,
  getCallTurns,
  getChatContext,
  pushCallTurn,
  stripForSpeech,
} from "@/lib/call/conversation-memory";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 30;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().trim().min(1).max(500),
  characterSlug: z.string().optional(),
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        console.error("[call/turn]", e);
        resolve(null);
      });
  });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("call_turn", user.id);
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
    return NextResponse.json(
      { error: "Pehle user ki baat bhejo (userText)" },
      { status: 400 }
    );
  }

  const userText = stripForSpeech(parsed.data.userText);
  if (userText.length < 1) {
    return NextResponse.json({ error: "Empty speech" }, { status: 400 });
  }
  if (looksLikeBadHear(userText)) {
    console.info("[call/turn] weak STT", userText);
  }

  const service = createServiceClient();
  const { data: session } = await service
    .from("call_sessions")
    .select("*, character:characters(*)")
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session || session.ended_at) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const character = session.character as {
    name: string;
    gender: string;
    city: string | null;
    voice_name: string;
    persona_prompt: string;
    speaking_style: string | null;
    bio: string | null;
  } | null;

  if (!character) {
    return NextResponse.json({ error: "Character missing" }, { status: 404 });
  }

  pushCallTurn(parsed.data.sessionId, "user", userText);
  const history = getCallTurns(parsed.data.sessionId);
  const historyBlock = history
    .slice(-8)
    .map((t) => `${t.role === "user" ? "User" : character.name}: ${t.text}`)
    .join("\n");
  const recentAssistant = history
    .filter((t) => t.role === "assistant")
    .slice(-3)
    .map((t) => t.text);
  const turnIndex = getAssistantCount(parsed.data.sessionId);

  // Chat context only if already seeded at start — don't block turn on DB
  const chat = getChatContext(parsed.data.sessionId);

  const started = Date.now();
  const generated = await generateHumanCallReply({
    name: character.name,
    gender: character.gender,
    city: character.city,
    persona: character.persona_prompt,
    style: character.speaking_style,
    bio: character.bio,
    history: historyBlock,
    chatContext: chat,
    userText,
    recentAssistant,
    turnIndex,
  });
  const reply = generated.text;

  pushCallTurn(parsed.data.sessionId, "assistant", reply);

  const audio = await withTimeout(
    synthesizeCallSpeech({
      text: reply,
      gender: character.gender,
      name: character.name,
    }),
    8000
  );

  const payload = {
    text: reply,
    heard: userText,
    language: "hi" as const,
    gender: character.gender,
    replyProvider: generated.provider,
    latencyMs: Date.now() - started,
  };

  if (audio) {
    return NextResponse.json({
      ...payload,
      audioBase64: audio.pcm.toString("base64"),
      mimeType: audio.mimeType,
      sampleRate: audio.sampleRate,
      voiceName: audio.voiceName,
      provider: audio.provider ?? "gemini",
    });
  }

  return NextResponse.json({
    ...payload,
    voiceFallback: true,
  });
}
