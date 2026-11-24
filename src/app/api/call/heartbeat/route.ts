import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { isTestingFreeMedia } from "@/lib/testing";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("call_heartbeat", user.id);
  if (!limited.success) {
    // Don't kill an active call over heartbeat spam protection
    return NextResponse.json({
      ended: false,
      skipped: true,
      remaining_seconds: 900,
    });
  }

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
    .select("*")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Testing: no wallet debit — just keep the session alive
  if (isTestingFreeMedia()) {
    if (session.ended_at) {
      return NextResponse.json({
        ended: true,
        seconds_billed: session.seconds_billed,
        paise_charged: 0,
        remaining_seconds: 0,
        end_reason: session.end_reason,
        free_testing: true,
      });
    }

    const maxSecs = session.max_seconds ?? 900;
    const started = new Date(session.started_at ?? session.created_at).getTime();
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - started) / 1000)
    );
    const remaining = Math.max(0, maxSecs - elapsed);

    if (remaining <= 0) {
      await service
        .from("call_sessions")
        .update({
          ended_at: new Date().toISOString(),
          end_reason: "max_duration",
          last_heartbeat_at: new Date().toISOString(),
          seconds_billed: maxSecs,
          paise_charged: 0,
        })
        .eq("id", session.id);

      return NextResponse.json({
        ended: true,
        seconds_billed: maxSecs,
        paise_charged: 0,
        remaining_seconds: 0,
        end_reason: "max_duration",
        free_testing: true,
      });
    }

    await service
      .from("call_sessions")
      .update({
        last_heartbeat_at: new Date().toISOString(),
        last_billed_at: new Date().toISOString(),
        seconds_billed: elapsed,
        paise_charged: 0,
      })
      .eq("id", session.id);

    return NextResponse.json({
      ended: false,
      seconds_billed: elapsed,
      paise_charged: 0,
      remaining_seconds: remaining,
      warn_low_balance: false,
      free_testing: true,
    });
  }

  const { data, error: rpcError } = await service.rpc("call_heartbeat", {
    p_session_id: parsed.data.sessionId,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
