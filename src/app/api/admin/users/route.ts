import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, writeAdminAudit } from "@/lib/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PatchSchema = z.object({
  userId: z.string().uuid(),
  is_banned: z.boolean().optional(),
  is_suspicious: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service } = auth.ctx;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  let userIdsFromEmail: string[] = [];

  if (q.includes("@")) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(q)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          },
        }
      );
      if (res.ok) {
        const body = (await res.json()) as {
          users?: { id: string }[];
          id?: string;
        };
        if (body.users?.length) {
          userIdsFromEmail = body.users.map((u) => u.id);
        } else if (body.id) {
          userIdsFromEmail = [body.id];
        }
      }
    } catch {
      // fall through to profile search
    }
  }

  let query = service
    .from("profiles")
    .select(
      "id, name, phone, gender, role, is_banned, is_suspicious, trial_started_at, trial_images_used, onboarding_completed_at, created_at, wallets(balance_paise)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userIdsFromEmail.length) {
    query = query.in("id", userIdsFromEmail);
  } else if (q) {
    if (UUID_RE.test(q)) {
      query = query.eq("id", q);
    } else {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (data ?? []).map((row) => {
    const wallet = Array.isArray(row.wallets) ? row.wallets[0] : row.wallets;
    return {
      ...row,
      wallet_balance_paise: wallet?.balance_paise ?? 0,
      wallets: undefined,
    };
  });

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service, user: admin } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, is_banned, is_suspicious } = parsed.data;
  if (is_banned === undefined && is_suspicious === undefined) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (is_banned !== undefined) patch.is_banned = is_banned;
  if (is_suspicious !== undefined) patch.is_suspicious = is_suspicious;

  const { data, error } = await service
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(
      "id, name, phone, gender, role, is_banned, is_suspicious, trial_started_at, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAdminAudit(service, admin.id, "user_patch", {
    user_id: userId,
    is_banned,
    is_suspicious,
  });

  return NextResponse.json({ user: data });
}
