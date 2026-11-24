import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  confirm: z.literal("DELETE"),
});

/**
 * Permanently deletes the authenticated user and cascaded data via service role.
 */
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
      { error: 'Send { "confirm": "DELETE" } to confirm' },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Best-effort: remove generated images from storage
  const { data: images } = await service
    .from("generated_images")
    .select("storage_path")
    .eq("user_id", user.id);

  const paths = (images ?? [])
    .map((i) => i.storage_path)
    .filter((p): p is string => Boolean(p));

  if (paths.length) {
    await service.storage.from("generated-images").remove(paths);
  }

  // Settle any open calls
  const { data: openCalls } = await service
    .from("call_sessions")
    .select("id")
    .eq("user_id", user.id)
    .is("ended_at", null);

  for (const c of openCalls ?? []) {
    await service.rpc("call_settle", {
      p_session_id: c.id,
      p_reason: "user_ended",
    });
  }

  // Release open holds
  const { data: holds } = await service
    .from("wallet_holds")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "held");

  for (const h of holds ?? []) {
    await service.rpc("wallet_release", { p_hold_id: h.id });
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: true });
}
