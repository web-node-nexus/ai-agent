import { requireUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const service = createServiceClient();
  const settings = await getAppSettings();

  const { data: sub } = await service
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "pending", "halted", "created"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const active = sub?.status === "active";

  return NextResponse.json({
    plans: settings.sub_plans,
    subscription: sub
      ? {
          id: sub.id,
          active,
          planKey: sub.plan_key,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          autopay: Boolean(sub.razorpay_subscription_id) && active,
        }
      : { active: false, autopay: false },
  });
}
