import { getProfile, requireUser } from "@/lib/auth";
import {
  createRazorpayPlan,
  createSubscription,
} from "@/lib/razorpay";
import { rateLimit } from "@/lib/rate-limit";
import { ensureRazorpayPlanIds, getAppSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    plan_key: z.string().min(1).optional(),
    planKey: z.string().min(1).optional(),
  })
  .transform((d) => ({ plan_key: d.plan_key || d.planKey || "" }))
  .refine((d) => d.plan_key.length > 0, { message: "plan_key required" });

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("payment", user.id);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { error: "Payments are not configured yet" },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "plan_key required" }, { status: 400 });
  }

  let plans;
  try {
    plans = await ensureRazorpayPlanIds(createRazorpayPlan);
  } catch (err) {
    console.error("ensure razorpay plans failed", err);
    return NextResponse.json(
      { error: "Could not set up subscription plans" },
      { status: 502 }
    );
  }

  const plan = plans[parsed.data.plan_key];
  if (!plan?.razorpay_plan_id) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 404 });
  }

  const service = createServiceClient();
  const { data: active } = await service
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (active) {
    return NextResponse.json(
      { error: "You already have an active subscription" },
      { status: 409 }
    );
  }

  // Cancel stale "created" rows so user can retry
  await service
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("status", "created");

  const cycles =
    plan.period_days <= 7
      ? 52 // ~1 year of weekly autopay
      : 24; // 2 years of monthly autopay

  let rzpSub: { id: string; short_url?: string };
  try {
    rzpSub = (await createSubscription({
      planId: plan.razorpay_plan_id,
      totalCount: cycles,
      notes: {
        user_id: user.id,
        plan_key: plan.key,
        autopay: "1",
      },
    })) as { id: string; short_url?: string };
  } catch (err) {
    console.error("razorpay subscription create failed", err);
    return NextResponse.json(
      { error: "Could not create subscription" },
      { status: 502 }
    );
  }

  const { data: row, error: insertError } = await service
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan_key: plan.key,
      razorpay_subscription_id: rzpSub.id,
      razorpay_plan_id: plan.razorpay_plan_id,
      status: "created",
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const profile = await getProfile(user.id);

  return NextResponse.json({
    subscription_id: row.id,
    razorpay_subscription_id: rzpSub.id,
    // aliases for older clients
    subscriptionId: rzpSub.id,
    id: rzpSub.id,
    short_url: rzpSub.short_url ?? null,
    shortUrl: rzpSub.short_url ?? null,
    plan,
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    prefill: {
      contact: profile?.phone?.replace(/^\+?91/, "") || undefined,
    },
    autopay: true,
    message:
      "First payment turns on Autopay. Razorpay will charge the same amount each billing cycle until you cancel.",
  });
}
