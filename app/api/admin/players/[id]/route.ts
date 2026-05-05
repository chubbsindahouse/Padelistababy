import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { hashPassword } from "@/lib/player-auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const supabase = createServiceClient();

  const allowed: Record<string, unknown> = {};
  if (body.name)     allowed.name     = String(body.name).trim();
  if (body.username !== undefined) {
    allowed.username = body.username ? String(body.username).trim().toLowerCase() : null;
  }
  if (body.elo_rating) allowed.elo_rating = Number(body.elo_rating);

  // If a new password is provided, hash it
  if (body.password) {
    allowed.password_hash = await hashPassword(body.password, id);
  }

  const { data, error } = await supabase
    .from("profiles").update(allowed).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = createServiceClient();
  await supabase.from("achievements").delete().eq("player_id", id);
  await supabase.from("elo_history").delete().eq("player_id", id);
  await supabase.from("session_players").delete().eq("player_id", id);
  await supabase.from("profiles").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
