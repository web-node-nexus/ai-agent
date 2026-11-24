import { generateImage } from "@/lib/ai/images";
import { getProfile, requireUser } from "@/lib/auth";
import { moderateImageBrief } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { getAppSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { applyFreeMediaAccess, isTestingFreeMedia } from "@/lib/testing";
import type { AccessState, Character } from "@/types/database";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  brief: z.string().trim().min(3).max(500),
  confirm: z.boolean(),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("image", user.id);
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

  const { conversationId, brief, confirm } = parsed.data;
  const profile = await getProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.is_banned) {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: accessRaw } = await service.rpc("get_access_state", {
    p_user_id: user.id,
  });
  const access = applyFreeMediaAccess(accessRaw as AccessState);
  const settings = await getAppSettings();
  const freeTesting = isTestingFreeMedia();
  const price = freeTesting
    ? 0
    : (access.image_price_paise ?? settings.image_price_paise);

  const { data: conversation } = await service
    .from("conversations")
    .select("*, character:characters(*)")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const character = conversation.character as Character;
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  const canUseFree =
    freeTesting ||
    (access.trial_active && (access.free_images_left ?? 0) > 0);
  const canPay =
    !freeTesting &&
    access.has_active_subscription &&
    (access.wallet_balance ?? 0) >= price;

  if (!canUseFree && !canPay) {
    return NextResponse.json(
      {
        error: "Cannot generate image",
        type: "paywall",
        price_paise: price,
        ...access,
      },
      { status: 402 }
    );
  }

  // Paid path requires explicit confirm (skipped in free testing)
  if (!freeTesting && !canUseFree && canPay && !confirm) {
    return NextResponse.json({
      needs_confirmation: true,
      price_paise: price,
      free: false,
    });
  }

  const mod = moderateImageBrief(brief);
  if (!mod.ok) {
    await service.from("moderation_events").insert({
      user_id: user.id,
      source: "image_brief",
      category: mod.category ?? "image_safety",
      snippet: brief.slice(0, 200),
    });
    return NextResponse.json(
      { error: "That image request isn't allowed. Keep it PG-13." },
      { status: 400 }
    );
  }

  let wasFree = false;
  let holdId: string | null = null;

  if (freeTesting) {
    wasFree = true;
  } else if (canUseFree) {
    const { data: consumed } = await service.rpc("consume_free_image", {
      p_user_id: user.id,
    });
    if (!consumed) {
      // Race: free image no longer available
      if (!canPay) {
        return NextResponse.json(
          { error: "No free images left", price_paise: price },
          { status: 402 }
        );
      }
      if (!confirm) {
        return NextResponse.json({
          needs_confirmation: true,
          price_paise: price,
          free: false,
        });
      }
    } else {
      wasFree = true;
    }
  }

  if (!wasFree) {
    const { data: hold, error: holdError } = await service.rpc("wallet_hold", {
      p_user_id: user.id,
      p_amount_paise: price,
      p_purpose: "image",
      p_ref_id: conversationId,
    });
    if (holdError || !hold) {
      return NextResponse.json(
        { error: holdError?.message ?? "Insufficient balance" },
        { status: 402 }
      );
    }
    holdId = hold as string;
  }

  const { data: imageRow, error: imgInsertError } = await service
    .from("generated_images")
    .insert({
      user_id: user.id,
      conversation_id: conversationId,
      character_id: character.id,
      prompt_brief: brief,
      status: "pending",
      price_paise: wasFree ? 0 : price,
      was_free: wasFree,
      hold_id: holdId,
    })
    .select("*")
    .single();

  if (imgInsertError || !imageRow) {
    if (holdId) {
      await service.rpc("wallet_release", { p_hold_id: holdId });
    }
    return NextResponse.json(
      { error: imgInsertError?.message ?? "Failed to create image job" },
      { status: 500 }
    );
  }

  try {
    const generated = await generateImage({
      brief,
      characterName: character.name,
      characterBio: `${character.bio} Age ${character.age}, ${character.city}.`,
      referenceImageUrls: character.reference_image_urls ?? [],
    });

    const ext = generated.mimeType.includes("jpeg")
      ? "jpg"
      : generated.mimeType.includes("webp")
        ? "webp"
        : "png";
    const storagePath = `${user.id}/${imageRow.id}.${ext}`;

    const { error: uploadError } = await service.storage
      .from("generated-images")
      .upload(storagePath, generated.bytes, {
        contentType: generated.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    if (holdId) {
      await service.rpc("wallet_capture", { p_hold_id: holdId });
    }

    await service
      .from("generated_images")
      .update({
        status: "ready",
        storage_path: storagePath,
      })
      .eq("id", imageRow.id);

    const { data: msg } = await service
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: brief,
        kind: "image",
        image_id: imageRow.id,
        source: "chat",
        meta: { storage_path: storagePath },
      })
      .select("id")
      .single();

    await service
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    const { data: signed } = await service.storage
      .from("generated-images")
      .createSignedUrl(storagePath, 60 * 60);

    return NextResponse.json({
      ok: true,
      image_id: imageRow.id,
      message_id: msg?.id,
      url: signed?.signedUrl ?? null,
      was_free: wasFree,
      price_paise: wasFree ? 0 : price,
    });
  } catch (err) {
    console.error("image generation failed", err);

    if (holdId) {
      await service.rpc("wallet_release", { p_hold_id: holdId });
    }

    const message = err instanceof Error ? err.message : "Generation failed";
    const blocked =
      /safety|moderat|blocked|rai/i.test(message) ||
      message.toLowerCase().includes("policy");

    await service
      .from("generated_images")
      .update({
        status: blocked ? "blocked" : "failed",
        moderation_notes: message.slice(0, 500),
      })
      .eq("id", imageRow.id);

    if (blocked) {
      await service.from("moderation_events").insert({
        user_id: user.id,
        source: "image_generation",
        category: "image_safety",
        snippet: brief.slice(0, 200),
      });
    }

    return NextResponse.json(
      { error: blocked ? "Image blocked by safety filters" : "Image generation failed" },
      { status: blocked ? 400 : 500 }
    );
  }
}
