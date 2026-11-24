import { requireUser } from "@/lib/auth";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Client-side confirmation after Razorpay Checkout success.
 * Webhook (payment.captured) remains the source of truth for wallet credit.
 */
const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("payment", user.id);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    parsed.data;

  const ok = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: payment } = await service
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", razorpay_order_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Soft-mark as paid if webhook hasn't arrived yet; credit still via webhook.
  if (payment.status === "created") {
    await service
      .from("payments")
      .update({
        status: "paid",
        razorpay_payment_id,
      })
      .eq("id", payment.id)
      .eq("status", "created");
  }

  return NextResponse.json({
    ok: true,
    note: "Signature verified. Wallet credit is finalized by webhook.",
    payment_id: payment.id,
    status: "paid",
  });
}
