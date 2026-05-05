import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";

/** DELETE /api/admin/sessions/[id] — delete a session and all related data */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = createServiceClient();

  // Get all matches for this session
  const { data: matches } = await supabase
    .from("matches").select("id").eq("session_id", id);

  // Delete games for those matches
  if (matches?.length) {
    const matchIds = matches.map((m) => m.id);
    await supabase.from("games").delete().in("match_id", matchIds);
    await supabase.from("matches").delete().in("id", matchIds);
  }

  await supabase.from("session_players").delete().eq("session_id", id);
  await supabase.from("sessions").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}

/** PATCH /api/admin/sessions/[id] — toggle is_active or update format */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sessions").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
