import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";

/** DELETE /api/admin/matches/[id] — delete a match and its games */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = createServiceClient();
  await supabase.from("games").delete().eq("match_id", id);
  await supabase.from("matches").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/admin/matches/[id] — update winner_team or other fields */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("matches").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
