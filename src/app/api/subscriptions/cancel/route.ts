import { requireUser } from "@/lib/auth";
import { cancelSubscription } from "@/lib/razorpay";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  subscription_id: z.string().uuid().optional(),
  cancel_at_cycle_end: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("payment", user.id);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const service = createServiceClient();
  let query = service
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "authenticated", "created", "pending"]);

  if (parsed.data.subscription_id) {
    query = query.eq("id", parsed.data.subscription_id);
  }

  const { data: sub } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json(
      { error: "No cancellable subscription found" },
      { status: 404 }
    );
  }

  if (sub.razorpay_subscription_id) {
    try {
      await cancelSubscription(
        sub.razorpay_subscription_id,
        parsed.data.cancel_at_cycle_end
      );
    } catch (err) {
      console.error("razorpay cancel failed", err);
      return NextResponse.json(
        { error: "Could not cancel with payment provider" },
        { status: 502 }
      );
    }
  }

  // If cancelling at cycle end, keep access until period ends (Razorpay stops Autopay).
  // Immediate cancel → mark cancelled now.
  const nextStatus = parsed.data.cancel_at_cycle_end ? sub.status : "cancelled";

  if (!parsed.data.cancel_at_cycle_end) {
    const { error: updateError } = await service
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    subscription_id: sub.id,
    status: nextStatus,
    cancel_at_cycle_end: parsed.data.cancel_at_cycle_end,
    message: parsed.data.cancel_at_cycle_end
      ? "Autopay stopped. Access continues until the current period ends."
      : "Subscription cancelled.",
  });
}
