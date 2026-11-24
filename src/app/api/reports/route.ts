import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  message_id: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("contact", user.id);
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

  const service = createServiceClient();

  if (parsed.data.message_id) {
    const { data: msg } = await service
      .from("messages")
      .select("id, user_id, conversation_id")
      .eq("id", parsed.data.message_id)
      .maybeSingle();

    if (!msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const { data: conv } = await service
      .from("conversations")
      .select("user_id")
      .eq("id", msg.conversation_id)
      .maybeSingle();

    if (!conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error: insertError } = await service
    .from("reports")
    .insert({
      user_id: user.id,
      message_id: parsed.data.message_id ?? null,
      reason: parsed.data.reason,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report: data }, { status: 201 });
}
