import { requireUser } from "@/lib/auth";
import { generateOtpCode, setOtp } from "@/lib/otp-store";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number"),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const limited = await rateLimit("auth", user.id);
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid phone" },
      { status: 400 }
    );
  }

  const phone = parsed.data.phone.startsWith("+")
    ? parsed.data.phone
    : `+91${parsed.data.phone.replace(/^0/, "")}`;

  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .not("phone_verified_at", "is", null)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Phone already linked to another account" },
      { status: 409 }
    );
  }

  await service.from("profiles").update({ phone }).eq("id", user.id);

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const isDev = process.env.NODE_ENV !== "production";

  if (authKey && templateId) {
    const code = generateOtpCode();
    setOtp(user.id, phone, code);

    const mobile = phone.replace(/^\+/, "");
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile,
        otp: code,
        otp_length: 6,
        otp_expiry: 10,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("MSG91 send failed", res.status, text);
      return NextResponse.json(
        { error: "Failed to send OTP" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, channel: "msg91" });
  }

  // DEV mode: store OTP; accept 000000 on verify
  const code = isDev ? "000000" : generateOtpCode();
  setOtp(user.id, phone, code);

  return NextResponse.json({
    ok: true,
    channel: "dev",
    ...(isDev ? { hint: "Use code 000000 in development" } : {}),
  });
}
