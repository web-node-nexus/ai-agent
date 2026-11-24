import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeIndianPhone } from "@/lib/otp-store";
import { twoFactorSendOtp } from "@/lib/twofactor";

const Schema = z.object({
  phone: z.string().trim().min(8).max(20),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  const phone = normalizeIndianPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      {
        error:
          "Enter a valid 10-digit Indian mobile number starting with 6–9.",
      },
      { status: 400 }
    );
  }

  const limited = await rateLimit("auth", phone);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many requests — please wait a minute." },
      { status: 429 }
    );
  }

  if (!process.env.TWOFACTOR_API_KEY) {
    return NextResponse.json(
      { error: "TWOFACTOR_API_KEY missing in .env.local" },
      { status: 503 }
    );
  }

  const result = await twoFactorSendOtp(phone);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Could not send OTP" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    phone,
    message: "OTP sent by SMS",
  });
}
