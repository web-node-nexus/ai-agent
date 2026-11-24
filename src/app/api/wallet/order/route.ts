import { requireUser } from "@/lib/auth";
import { createWalletOrder } from "@/lib/razorpay";
import { rateLimit } from "@/lib/rate-limit";
import { getAppSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { splitGstInclusive } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  pack_key: z.string().min(1),
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
    return NextResponse.json({ error: "pack_key required" }, { status: 400 });
  }

  const settings = await getAppSettings();
  const pack = settings.wallet_packs.find((p) => p.key === parsed.data.pack_key);
  if (!pack) {
    return NextResponse.json({ error: "Unknown pack" }, { status: 404 });
  }

  const { basePaise, gstPaise, totalPaise } = splitGstInclusive(
    pack.paise,
    settings.gst_rate_bps
  );

  const receipt = `tw_${user.id.slice(0, 8)}_${Date.now().toString(36)}`.slice(
    0,
    40
  );

  let order: { id: string; amount: number; currency: string };
  try {
    order = (await createWalletOrder({
      amountPaise: totalPaise,
      receipt,
      notes: {
        user_id: user.id,
        pack_key: pack.key,
        kind: "wallet",
      },
    })) as { id: string; amount: number; currency: string };
  } catch (err) {
    console.error("razorpay order create failed", err);
    return NextResponse.json(
      { error: "Could not create payment order" },
      { status: 502 }
    );
  }

  const service = createServiceClient();
  const { data: payment, error: payError } = await service
    .from("payments")
    .insert({
      user_id: user.id,
      kind: "wallet",
      razorpay_order_id: order.id,
      amount_paise: totalPaise,
      gst_paise: gstPaise,
      base_paise: basePaise,
      status: "created",
      pack_key: pack.key,
      invoice_meta: {
        pack_label: pack.label,
        gst_rate_bps: settings.gst_rate_bps,
        receipt,
      },
    })
    .select("*")
    .single();

  if (payError) {
    return NextResponse.json({ error: payError.message }, { status: 500 });
  }

  return NextResponse.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency ?? "INR",
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    payment_id: payment.id,
    pack,
    gst: { basePaise, gstPaise, totalPaise },
  });
}
