import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { hashPassword } from "@/lib/player-auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { newPassword } = await req.json();
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }
  const hash = await hashPassword(newPassword, id);
  const supabase = createServiceClient();
  const { error } = await supabase.from("profiles").update({ password_hash: hash }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
