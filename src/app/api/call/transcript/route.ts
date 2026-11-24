import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1).max(8000),
});

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  messages: z.array(messageSchema).min(1).max(100),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

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
  const { data: session } = await service
    .from("call_sessions")
    .select("id, user_id, conversation_id")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.conversation_id) {
    return NextResponse.json(
      { error: "Session has no conversation" },
      { status: 400 }
    );
  }

  const rows = parsed.data.messages.map((m) => ({
    conversation_id: session.conversation_id,
    user_id: user.id,
    role: m.role,
    content: m.content,
    kind: "text" as const,
    source: "call" as const,
    meta: { call_session_id: session.id },
  }));

  const { data, error: insertError } = await service
    .from("messages")
    .insert(rows)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await service
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", session.conversation_id);

  return NextResponse.json({
    ok: true,
    saved: data?.length ?? 0,
  });
}
