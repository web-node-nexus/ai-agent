import { requireUser, requireAccess } from "@/lib/auth";
import { applyFreeMediaAccess } from "@/lib/testing";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const { access, error: accessError } = await requireAccess(user.id);
  if (accessError) {
    // Still return access-shaped payload when banned
    if (accessError.status === 403) {
      return NextResponse.json(
        { error: "Account banned", is_banned: true },
        { status: 403 }
      );
    }
    return accessError;
  }

  return NextResponse.json(applyFreeMediaAccess(access));
}
