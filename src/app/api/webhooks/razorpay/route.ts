import { verifyWebhookSignature } from "@/lib/razorpay";
import { getAppSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type RzpPayload = {
  event: string;
  payload?: {
    payment?: { entity?: Record<string, unknown> };
    subscription?: { entity?: Record<string, unknown> };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: RzpPayload;
  try {
    body = JSON.parse(rawBody) as RzpPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const service = createServiceClient();
  const event = body.event;

  try {
    if (event === "payment.captured") {
      await handlePaymentCaptured(service, body);
    } else if (
      event === "subscription.activated" ||
      event === "subscription.charged" ||
      event === "subscription.pending" ||
      event === "subscription.halted" ||
      event === "subscription.cancelled" ||
      event === "subscription.completed"
    ) {
      await handleSubscriptionEvent(service, body, event);
    }
  } catch (err) {
    console.error("razorpay webhook handler error", event, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handlePaymentCaptured(
  service: ReturnType<typeof createServiceClient>,
  body: RzpPayload
) {
  const payment = body.payload?.payment?.entity;
  if (!payment) return;

  const razorpayPaymentId = String(payment.id ?? "");
  const razorpayOrderId = String(payment.order_id ?? "");
  const amount = Number(payment.amount ?? 0);
  const notes = (payment.notes ?? {}) as Record<string, string>;

  if (!razorpayPaymentId) return;

  // Prefer matching by order id from our payments table
  let { data: row } = await service
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (!row && notes.user_id) {
    const { data: created } = await service
      .from("payments")
      .insert({
        user_id: notes.user_id,
        kind: "wallet",
        razorpay_order_id: razorpayOrderId || null,
        razorpay_payment_id: razorpayPaymentId,
        amount_paise: amount,
        status: "paid",
        pack_key: notes.pack_key ?? null,
      })
      .select("*")
      .single();
    row = created;
  }

  if (!row) return;

  await service
    .from("payments")
    .update({
      status: "paid",
      razorpay_payment_id: razorpayPaymentId,
    })
    .eq("id", row.id);

  if (row.kind === "wallet" && amount > 0) {
    await service.rpc("wallet_credit", {
      p_user_id: row.user_id,
      p_amount_paise: amount,
      p_ref_type: "razorpay_payment",
      p_ref_id: razorpayPaymentId,
      p_description: `Wallet recharge${row.pack_key ? ` (${row.pack_key})` : ""}`,
      p_ledger_type: "recharge",
    });
  }
}

async function handleSubscriptionEvent(
  service: ReturnType<typeof createServiceClient>,
  body: RzpPayload,
  event: string
) {
  const entity = body.payload?.subscription?.entity;
  if (!entity) return;

  const rzpSubId = String(entity.id ?? "");
  if (!rzpSubId) return;

  const statusMap: Record<string, string> = {
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.pending": "pending",
    "subscription.halted": "halted",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "completed",
  };

  const status = statusMap[event] ?? String(entity.status ?? "pending");
  const notes = (entity.notes ?? {}) as Record<string, string>;
  const currentEnd = entity.current_end
    ? new Date(Number(entity.current_end) * 1000).toISOString()
    : entity.ended_at
      ? new Date(Number(entity.ended_at) * 1000).toISOString()
      : null;

  const { data: existing } = await service
    .from("subscriptions")
    .select("*")
    .eq("razorpay_subscription_id", rzpSubId)
    .maybeSingle();

  const settings = await getAppSettings();
  const planKey = existing?.plan_key || notes.plan_key || "monthly";
  const plan = settings.sub_plans[planKey];
  const userId = existing?.user_id || notes.user_id;

  if (existing) {
    // On each autopay charge, extend the access window
    let periodEnd = currentEnd ?? existing.current_period_end;
    if (
      (event === "subscription.charged" || event === "subscription.activated") &&
      plan &&
      !currentEnd
    ) {
      periodEnd = new Date(
        Date.now() + plan.period_days * 24 * 60 * 60 * 1000
      ).toISOString();
    }

    await service
      .from("subscriptions")
      .update({
        status,
        current_period_end: periodEnd,
      })
      .eq("id", existing.id);
  } else if (userId) {
    await service.from("subscriptions").insert({
      user_id: userId,
      plan_key: planKey,
      razorpay_subscription_id: rzpSubId,
      razorpay_plan_id: String(entity.plan_id ?? plan?.razorpay_plan_id ?? ""),
      status,
      current_period_end:
        currentEnd ??
        (plan
          ? new Date(
              Date.now() + plan.period_days * 24 * 60 * 60 * 1000
            ).toISOString()
          : null),
    });
  }

  // Record every autopay charge
  if (event === "subscription.charged" && userId) {
    const paymentEntity = body.payload?.payment?.entity;
    if (paymentEntity?.id) {
      const payId = String(paymentEntity.id);
      const amount = Number(
        paymentEntity.amount ?? plan?.price_paise ?? 0
      );
      const { data: existingPay } = await service
        .from("payments")
        .select("id")
        .eq("razorpay_payment_id", payId)
        .maybeSingle();
      if (!existingPay) {
        await service.from("payments").insert({
          user_id: userId,
          kind: "subscription",
          razorpay_payment_id: payId,
          razorpay_subscription_id: rzpSubId,
          amount_paise: amount,
          status: "paid",
          pack_key: planKey,
        });
      }
    }
  }
}
