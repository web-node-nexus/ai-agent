import { requireUser } from "@/lib/auth";
import { clearCallTurns } from "@/lib/call/conversation-memory";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  reason: z
    .enum([
      "user_ended",
      "balance_exhausted",
      "max_duration",
      "error",
      "abandoned",
      "admin",
    ])
    .optional()
    .default("user_ended"),
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
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: session } = await service
    .from("call_sessions")
    .select("id, user_id")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data, error: rpcError } = await service.rpc("call_settle", {
    p_session_id: parsed.data.sessionId,
    p_reason: parsed.data.reason,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  clearCallTurns(parsed.data.sessionId);

  return NextResponse.json(data);
}
