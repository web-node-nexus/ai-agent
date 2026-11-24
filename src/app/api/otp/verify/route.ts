import { requireUser } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp-store";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  phone: z.string().trim().min(10),
  code: z.string().trim().regex(/^\d{4,8}$/, "Invalid OTP"),
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
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const phone = parsed.data.phone.startsWith("+")
    ? parsed.data.phone
    : `+91${parsed.data.phone.replace(/^0/, "")}`;
  const code = parsed.data.code;

  const isDev = process.env.NODE_ENV !== "production";
  const authKey = process.env.MSG91_AUTH_KEY;

  let verified = false;

  if (authKey && !isDev) {
    const mobile = phone.replace(/^\+/, "");
    const res = await fetch(
      `https://control.msg91.com/api/v5/otp/verify?otp=${encodeURIComponent(code)}&mobile=${encodeURIComponent(mobile)}`,
      {
        method: "GET",
        headers: { authkey: authKey },
      }
    );
    if (res.ok) {
      verified = true;
    } else {
      // Fall through to local store (in case we also stored)
      const local = verifyOtp(user.id, phone, code);
      verified = local.ok;
      if (!verified) {
        return NextResponse.json(
          { error: local.error ?? "Invalid OTP" },
          { status: 400 }
        );
      }
    }
  } else {
    // DEV: accept 000000 or stored code
    if (isDev && code === "000000") {
      verified = true;
    } else {
      const local = verifyOtp(user.id, phone, code);
      if (!local.ok) {
        return NextResponse.json(
          { error: local.error ?? "Invalid OTP" },
          { status: 400 }
        );
      }
      verified = true;
    }
  }

  if (!verified) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error: updateError } = await service
    .from("profiles")
    .update({
      phone,
      phone_verified_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, phone_verified: true });
}
