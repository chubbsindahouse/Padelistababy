import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlayerId, hashPassword } from "@/lib/player-auth";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase  = createServiceClient();
  const adminMode = await isAdmin();
  const playerId  = adminMode ? null : await getCurrentPlayerId();

  if (!adminMode && !playerId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { currentPassword, newPassword, targetPlayerId } = await req.json();

  // Admin can reset without knowing current password
  const id = adminMode ? targetPlayerId : playerId!;
  if (!id) return NextResponse.json({ error: "Player ID required" }, { status: 400 });
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }

  // Non-admin must verify current password
  if (!adminMode) {
    const { data: profile } = await supabase
      .from("profiles").select("password_hash").eq("id", id).single();
    if (!profile?.password_hash) {
      return NextResponse.json({ error: "Account not set up for login" }, { status: 400 });
    }
    const hash = await hashPassword(currentPassword ?? "", id);
    if (hash !== profile.password_hash) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  const newHash = await hashPassword(newPassword, id);
  const { error } = await supabase
    .from("profiles").update({ password_hash: newHash }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
