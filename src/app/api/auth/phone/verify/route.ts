import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeIndianPhone } from "@/lib/otp-store";
import { createServiceClient } from "@/lib/supabase/server";
import { phoneToAuthEmail, twoFactorVerifyOtp } from "@/lib/twofactor";

const Schema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().trim().regex(/^\d{4,8}$/),
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
    return NextResponse.json({ error: "Invalid phone or OTP" }, { status: 400 });
  }

  const phone = normalizeIndianPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  const limited = await rateLimit("auth", `verify:${phone}`);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many attempts — try again shortly." },
      { status: 429 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY missing — required for phone login.",
      },
      { status: 503 }
    );
  }

  const isDevBypass =
    process.env.NODE_ENV === "development" &&
    parsed.data.code === "000000" &&
    process.env.ALLOW_DEV_OTP === "true";

  if (!isDevBypass) {
    const verified = await twoFactorVerifyOtp(phone, parsed.data.code);
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.error || "Incorrect OTP" },
        { status: 400 }
      );
    }
  }

  const email = phoneToAuthEmail(phone);
  const service = createServiceClient();
  const now = new Date().toISOString();

  // Create auth user if new (ignore "already registered")
  const { error: createError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    phone,
    phone_confirm: true,
    user_metadata: {
      phone,
      auth_provider: "phone_2factor",
    },
  });
  if (createError && !/already|registered|exists/i.test(createError.message)) {
    console.error("[auth/phone/verify] createUser", createError.message);
    return NextResponse.json(
      { error: "Could not create account. Please try again." },
      { status: 500 }
    );
  }

  const { data: linkData, error: linkError } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData?.properties?.hashed_token || !linkData.user?.id) {
    console.error("[auth/phone/verify] generateLink", linkError?.message);
    return NextResponse.json(
      { error: "Could not create session. Please try again." },
      { status: 500 }
    );
  }

  const userId = linkData.user.id;

  const { data: existing } = await service
    .from("profiles")
    .select("is_banned, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.is_banned) {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  // Another account already owns this verified phone?
  const { data: phoneOwner } = await service
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .not("phone_verified_at", "is", null)
    .neq("id", userId)
    .maybeSingle();

  if (phoneOwner) {
    return NextResponse.json(
      { error: "This number is already linked to another account." },
      { status: 409 }
    );
  }

  const { error: profileError } = await service.from("profiles").upsert(
    {
      id: userId,
      phone,
      phone_verified_at: now,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("[auth/phone/verify] profile upsert", profileError.message);
    return NextResponse.json(
      {
        error: profileError.message.includes("relation")
          ? "Database not set up — run supabase/FULL_SETUP.sql in the Supabase SQL Editor."
          : `Could not create profile: ${profileError.message}`,
      },
      { status: 500 }
    );
  }

  await service.from("wallets").upsert(
    { user_id: userId, balance_paise: 0 },
    { onConflict: "user_id" }
  );

  const { data: profile } = await service
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    phone,
    email,
    token_hash: linkData.properties.hashed_token,
    onboarding_complete: Boolean(profile?.onboarding_completed_at),
    next: profile?.onboarding_completed_at ? "/app" : "/onboarding",
  });
}
