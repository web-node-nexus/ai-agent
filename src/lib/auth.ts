import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AccessState, Profile } from "@/types/database";
import { NextResponse } from "next/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, error: null, supabase };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[getProfile]", error.message);
  }
  return (data as Profile | null) ?? null;
}

/** Create profile + wallet if missing (phone login / first onboarding). */
export async function ensureProfile(
  userId: string,
  extras: Partial<Profile> = {}
): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;

  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("profiles")
    .upsert(
      {
        id: userId,
        created_at: now,
        updated_at: now,
        ...extras,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[ensureProfile]", error.message);
    throw new Error(
      error.message.includes("relation") || error.message.includes("schema")
        ? "Database not set up — run supabase/FULL_SETUP.sql in Supabase SQL Editor."
        : `Could not create profile: ${error.message}`
    );
  }

  await service.from("wallets").upsert(
    { user_id: userId, balance_paise: 0 },
    { onConflict: "user_id" }
  );

  return data as Profile;
}

export async function requireAccess(userId: string) {
  const profile = await getProfile(userId);
  if (!profile) {
    return {
      profile: null,
      access: null,
      error: NextResponse.json({ error: "Profile not found" }, { status: 404 }),
    };
  }
  if (profile.is_banned) {
    return {
      profile,
      access: null,
      error: NextResponse.json({ error: "Account banned" }, { status: 403 }),
    };
  }
  const service = createServiceClient();
  const { data: access, error } = await service.rpc("get_access_state", {
    p_user_id: userId,
  });
  if (error) {
    return {
      profile,
      access: null,
      error: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  return { profile, access: access as AccessState, error: null };
}
