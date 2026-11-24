import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isAtLeast18 } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "DOB must be YYYY-MM-DD")
    .optional(),
  terms_accepted: z.boolean().optional(),
  age_confirmed: z.boolean().optional(),
  complete: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

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

  const data = parsed.data;
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.gender !== undefined) updates.gender = data.gender;

  if (data.dob !== undefined) {
    if (!isAtLeast18(data.dob)) {
      return NextResponse.json(
        { error: "You must be 18 or older to use TaraWorld" },
        { status: 403 }
      );
    }
    updates.dob = data.dob;
  }

  if (data.terms_accepted === true) {
    updates.terms_accepted_at = new Date().toISOString();
  }

  if (data.age_confirmed === true) {
    if (data.dob && !isAtLeast18(data.dob)) {
      return NextResponse.json(
        { error: "You must be 18 or older to use TaraWorld" },
        { status: 403 }
      );
    }
    updates.age_confirmed_at = new Date().toISOString();
  }

  if (data.complete === true) {
    updates.onboarding_completed_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile, error: updateError } = await service
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile });
}
