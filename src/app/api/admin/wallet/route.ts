import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";

const BodySchema = z.object({
  userId: z.string().uuid(),
  amountPaise: z.number().int().refine((n) => n !== 0, "amount cannot be zero"),
  note: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service, user: admin } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, amountPaise, note } = parsed.data;

  const { data, error } = await service.rpc("admin_adjust_wallet", {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_amount_paise: amountPaise,
    p_note: note,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result: data });
}
