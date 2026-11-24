import { requireUser } from "@/lib/auth";
import {
  fetchRazorpaySubscription,
  verifySubscriptionPaymentSignature,
} from "@/lib/razorpay";
import { getAppSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
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
    return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
  }

  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
  } = parsed.data;

  const ok = verifySubscriptionPaymentSignature({
    paymentId: razorpay_payment_id,
    subscriptionId: razorpay_subscription_id,
    signature: razorpay_signature,
  });
  if (!ok) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: sub } = await service
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("razorpay_subscription_id", razorpay_subscription_id)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  const settings = await getAppSettings();
  const plan = settings.sub_plans[sub.plan_key];
  const periodDays = plan?.period_days ?? 30;

  let periodEnd = new Date(
    Date.now() + periodDays * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const remote = (await fetchRazorpaySubscription(
      razorpay_subscription_id
    )) as { current_end?: number; status?: string };
    if (remote.current_end) {
      periodEnd = new Date(Number(remote.current_end) * 1000).toISOString();
    }
  } catch {
    /* keep computed periodEnd */
  }

  await service
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: periodEnd,
    })
    .eq("id", sub.id);

  // Idempotent payment row for first mandate charge
  const { data: existingPay } = await service
    .from("payments")
    .select("id")
    .eq("razorpay_payment_id", razorpay_payment_id)
    .maybeSingle();

  if (!existingPay) {
    await service.from("payments").insert({
      user_id: user.id,
      kind: "subscription",
      razorpay_payment_id,
      razorpay_subscription_id,
      amount_paise: plan?.price_paise ?? 0,
      status: "paid",
      pack_key: sub.plan_key,
    });
  }

  return NextResponse.json({
    ok: true,
    autopay: true,
    subscription: {
      id: sub.id,
      plan_key: sub.plan_key,
      status: "active",
      current_period_end: periodEnd,
    },
    message:
      "Autopay is on. The same amount will be charged automatically each billing cycle until you cancel.",
  });
}
