import Anthropic from "@anthropic-ai/sdk";
import { getProfile, requireUser } from "@/lib/auth";
import { extractAndSaveMemories, loadMemoriesForPrompt } from "@/lib/ai/memories";
import { SAFETY_SYSTEM_ADDENDUM, moderateUserText } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { matchCharacterGender } from "@/lib/utils";
import type { AccessState, Character } from "@/types/database";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

const IMAGE_TOOL: Anthropic.Tool = {
  name: "generate_image",
  description:
    "Request a SFW photo/selfie of THIS fictional character when the user clearly asks for a picture/photo/selfie. Provide a short PG-13 brief. Do not call for casual chat.",
  input_schema: {
    type: "object",
    properties: {
      brief: {
        type: "string",
        description:
          "Short SFW visual brief (outfit casual/everyday, setting, expression). No lingerie/swimwear/suggestive poses.",
      },
    },
    required: ["brief"],
  },
};

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("chat", user.id);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { conversationId, message } = parsed.data;
  const moderation = moderateUserText(message);
  if (!moderation.ok) {
    const service = createServiceClient();
    await service.from("moderation_events").insert({
      user_id: user.id,
      source: "chat",
      category: moderation.category ?? "blocked_content",
      snippet: message.slice(0, 200),
    });
    return NextResponse.json(
      {
        error:
          "That message couldn't be sent. Let's keep things respectful and PG-13.",
      },
      { status: 400 }
    );
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.is_banned) {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  const service = createServiceClient();

  // Start 3-min free trial on first message (if eligible)
  let access: AccessState | null = null;
  if (!profile.trial_started_at) {
    const { data: subCheck } = await service
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!subCheck) {
      const { data: started, error: trialErr } = await service.rpc(
        "start_trial_if_needed",
        { p_user_id: user.id }
      );
      if (trialErr) {
        console.error("[chat] start_trial_if_needed", trialErr.message);
      } else if (started) {
        access = started as AccessState;
      }
    }
  }

  if (!access) {
    const { data: accessRaw, error: accessError } = await service.rpc(
      "get_access_state",
      { p_user_id: user.id }
    );
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 });
    }
    access = accessRaw as AccessState;
  }

  if (
    !access.can_chat &&
    !access.trial_active &&
    !access.trial_eligible &&
    !access.has_active_subscription
  ) {
    const trialUsed =
      Boolean(access.trial_started_at) && !access.trial_active;
    return NextResponse.json(
      {
        type: "paywall",
        offer: trialUsed ? "trial_end" : "subscribe",
        ...access,
      },
      { status: 402 }
    );
  }

  if (
    access.has_active_subscription &&
    access.daily_messages_used >= access.daily_message_cap
  ) {
    return NextResponse.json(
      {
        error: `Aaj ka message limit (${access.daily_message_cap}) poora ho gaya. Kal phir milte hain — ya thoda break le lo.`,
        type: "daily_cap",
        ...access,
      },
      { status: 429 }
    );
  }

  if (!access.can_chat) {
    return NextResponse.json(
      {
        error: "Chat not available. Complete onboarding or verify phone.",
        ...access,
      },
      { status: 403 }
    );
  }

  const { data: conversation, error: convError } = await service
    .from("conversations")
    .select("*, character:characters(*)")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }
  if (!conversation || conversation.user_id !== user.id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const character = conversation.character as Character | null;
  if (!character || !character.is_active) {
    return NextResponse.json({ error: "Character unavailable" }, { status: 404 });
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

  const { data: userMsg, error: userMsgError } = await service
    .from("messages")
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: message,
      kind: "text",
      source: "chat",
    })
    .select("id")
    .single();

  if (userMsgError || !userMsg) {
    return NextResponse.json(
      { error: userMsgError?.message ?? "Failed to save message" },
      { status: 500 }
    );
  }

  await service
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  const { data: history } = await service
    .from("messages")
    .select("role, content, kind")
    .eq("conversation_id", conversationId)
    .in("kind", ["text", "image"])
    .order("created_at", { ascending: false })
    .limit(30);

  const memories = await loadMemoriesForPrompt(user.id, character.id);
  const systemPrompt = [
    character.persona_prompt,
    character.speaking_style
      ? `Speaking style: ${character.speaking_style}`
      : "",
    SAFETY_SYSTEM_ADDENDUM,
    memories ? `What you remember about the user:\n${memories}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const anthropicMessages: Anthropic.MessageParam[] = [...(history ?? [])]
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        m.kind === "image"
          ? `[Shared a photo: ${m.content}]`
          : m.content,
    }));

  // Ensure last message is the current user message (already in history after insert)
  if (
    anthropicMessages.length === 0 ||
    anthropicMessages[anthropicMessages.length - 1]?.role !== "user"
  ) {
    anthropicMessages.push({ role: "user", content: message });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chat is temporarily unavailable" },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.CLAUDE_CHAT_MODEL || "claude-haiku-4-5";

  const freeImagesLeft = access.free_images_left ?? 0;
  const imagePrice = access.image_price_paise ?? 300;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(payload)));
      };

      try {
        send({ type: "access", ...access });

        const anthropicStream = anthropic.messages.stream({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          tools: [IMAGE_TOOL],
          messages: anthropicMessages,
        });

        let assistantText = "";
        let imageBrief: string | null = null;

        anthropicStream.on("text", (text) => {
          assistantText += text;
          send({ type: "token", text });
        });

        const finalMessage = await anthropicStream.finalMessage();

        for (const block of finalMessage.content) {
          if (block.type === "tool_use" && block.name === "generate_image") {
            const input = block.input as { brief?: string };
            if (input.brief?.trim()) {
              imageBrief = input.brief.trim();
            }
          }
        }

        if (imageBrief) {
          send({
            type: "image_request",
            brief: imageBrief,
            free: freeImagesLeft > 0 && access.trial_active,
            price_paise: imagePrice,
          });
          if (!assistantText.trim()) {
            const confirmLine =
              "Main ek photo bhej sakti/sakta hoon — bas confirm kar do.";
            assistantText = confirmLine;
            send({ type: "token", text: confirmLine });
          }
        }

        const { data: assistantMsg, error: asstError } = await service
          .from("messages")
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: "assistant",
            content: assistantText || "(…)",
            kind: "text",
            source: "chat",
            meta: imageBrief ? { pending_image_brief: imageBrief } : {},
          })
          .select("id")
          .single();

        if (asstError) {
          send({ type: "error", error: asstError.message });
          controller.close();
          return;
        }

        await service.rpc("increment_daily_message_count", {
          p_user_id: user.id,
        });

        await service
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);

        // Fire-and-forget memory extraction every ~10 messages
        void (async () => {
          const { count } = await service
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conversationId);
          if (count && count > 0 && count % 10 === 0) {
            await extractAndSaveMemories({
              userId: user.id,
              characterId: character.id,
              conversationId,
            });
          }
        })().catch((err) => console.error("memory extraction failed", err));

        send({ type: "done", messageId: assistantMsg.id });
      } catch (err) {
        console.error("chat stream error", err);
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Chat failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
