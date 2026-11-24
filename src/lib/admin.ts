import { NextResponse } from "next/server";
import { requireUser, getProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminContext = {
  user: User;
  profile: Profile;
  service: SupabaseClient;
};

/** Require authenticated user with profiles.role === 'admin' (service-role check). */
export async function requireAdmin(): Promise<
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse }
> {
  const { user, error } = await requireUser();
  if (error || !user) {
    return {
      ok: false,
      response: error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin" || profile.is_banned) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    ctx: {
      user,
      profile,
      service: createServiceClient(),
    },
  };
}

export async function writeAdminAudit(
  service: SupabaseClient,
  adminId: string,
  action: string,
  meta: Record<string, unknown> = {}
) {
  await service.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    meta,
  });
}
