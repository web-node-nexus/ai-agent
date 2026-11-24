import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";


/**
 * Settle abandoned calls (no heartbeat for 90s) and release stale wallet holds (>1h).
 * Authorize with Authorization: Bearer CRON_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const now = Date.now();
  const abandonedCutoff = new Date(now - 90_000).toISOString();
  const holdCutoff = new Date(now - 60 * 60 * 1000).toISOString();

  const { data: abandoned } = await service
    .from("call_sessions")
    .select("id")
    .is("ended_at", null)
    .lt("last_heartbeat_at", abandonedCutoff);

  let settledCalls = 0;
  for (const row of abandoned ?? []) {
    const { error } = await service.rpc("call_settle", {
      p_session_id: row.id,
      p_reason: "abandoned",
    });
    if (!error) settledCalls += 1;
  }

  const { data: staleHolds } = await service
    .from("wallet_holds")
    .select("id")
    .eq("status", "held")
    .lt("created_at", holdCutoff);

  let releasedHolds = 0;
  for (const hold of staleHolds ?? []) {
    const { error } = await service.rpc("wallet_release", {
      p_hold_id: hold.id,
    });
    if (!error) releasedHolds += 1;
  }

  return NextResponse.json({
    ok: true,
    settledCalls,
    releasedHolds,
    at: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return POST(request);
}
