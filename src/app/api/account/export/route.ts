import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const service = createServiceClient();
  const userId = user.id;

  const [
    profile,
    conversations,
    messages,
    memories,
    payments,
    subscriptions,
    images,
    calls,
    ledger,
    reports,
  ] = await Promise.all([
    service.from("profiles").select("*").eq("id", userId).maybeSingle(),
    service.from("conversations").select("*").eq("user_id", userId),
    service.from("messages").select("*").eq("user_id", userId).order("created_at"),
    service.from("memories").select("*").eq("user_id", userId),
    service.from("payments").select("*").eq("user_id", userId),
    service.from("subscriptions").select("*").eq("user_id", userId),
    service
      .from("generated_images")
      .select("id, conversation_id, character_id, prompt_brief, status, price_paise, was_free, created_at, storage_path")
      .eq("user_id", userId),
    service.from("call_sessions").select("*").eq("user_id", userId),
    service.from("wallet_ledger").select("*").eq("user_id", userId),
    service.from("reports").select("*").eq("user_id", userId),
  ]);

  const { data: wallet } = await service
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profile.data,
    wallet,
    conversations: conversations.data ?? [],
    messages: messages.data ?? [],
    memories: memories.data ?? [],
    payments: payments.data ?? [],
    subscriptions: subscriptions.data ?? [],
    generated_images: images.data ?? [],
    call_sessions: calls.data ?? [],
    wallet_ledger: ledger.data ?? [],
    reports: reports.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="taraworld-export-${userId.slice(0, 8)}.json"`,
    },
  });
}
