import Razorpay from "razorpay";
import crypto from "crypto";
import type { SubPlan } from "@/types/database";

let client: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay is not configured");
  }
  client = new Razorpay({ key_id, key_secret });
  return client;
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = `${params.orderId}|${params.paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(params.signature)
    );
  } catch {
    return false;
  }
}

/** First payment on a subscription authorizes autopay mandate */
export function verifySubscriptionPaymentSignature(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = `${params.paymentId}|${params.subscriptionId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(params.signature)
    );
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  try {
    return Razorpay.validateWebhookSignature(rawBody, signature, secret);
  } catch {
    return false;
  }
}

export async function createWalletOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const rzp = getRazorpay();
  return rzp.orders.create({
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receipt,
    notes: params.notes,
  });
}

function planPeriod(plan: SubPlan): {
  period: "weekly" | "monthly";
  interval: number;
} {
  if (plan.period_days <= 7) return { period: "weekly", interval: 1 };
  return { period: "monthly", interval: 1 };
}

/** Create a Razorpay recurring plan (used for autopay). */
export async function createRazorpayPlan(plan: SubPlan) {
  const rzp = getRazorpay();
  const { period, interval } = planPeriod(plan);
  return rzp.plans.create({
    period,
    interval,
    item: {
      name: `TaraWorld ${plan.name}`,
      amount: plan.price_paise,
      currency: "INR",
      description: `${plan.name} chat subscription · autopay every ${period}`,
    },
    notes: {
      plan_key: plan.key,
      product: "taraworld",
    },
  });
}

/**
 * Create a Razorpay subscription.
 * First checkout payment sets up UPI Autopay / card mandate;
 * Razorpay charges again each billing cycle automatically.
 */
export async function createSubscription(params: {
  planId: string;
  totalCount?: number;
  notes?: Record<string, string>;
}) {
  const rzp = getRazorpay();
  return rzp.subscriptions.create({
    plan_id: params.planId,
    // Keep charging until cancelled — long horizon
    total_count: params.totalCount ?? 120,
    quantity: 1,
    customer_notify: 1,
    notes: params.notes,
  });
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
) {
  const rzp = getRazorpay();
  return rzp.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

export async function fetchRazorpaySubscription(subscriptionId: string) {
  const rzp = getRazorpay();
  return rzp.subscriptions.fetch(subscriptionId);
}
