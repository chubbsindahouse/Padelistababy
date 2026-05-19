import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

/**
 * PATCH /api/sessions/[id]/players
 * Body: { action: "add" | "remove", player_id: string }
 *
 * Adds or removes a player mid-session.
 * Switches the session to manual_override = true so all subsequent
 * matches use full manual team picking.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  const body = await req.json() as { action: "add" | "remove"; player_id: string };
  const { action, player_id } = body;

  if (!action || !player_id) {
    return NextResponse.json({ error: "Missing action or player_id" }, { status: 400 });
  }

  const admin = createServiceClient();

  // Verify session exists and is still active
  const { data: session } = await admin
    .from("sessions").select("id, is_active").eq("id", sessionId).single();
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.is_active) {
    return NextResponse.json({ error: "Session already ended" }, { status: 400 });
  }

  if (action === "add") {
    // Upsert to session_players (ignore duplicate)
    const { error } = await admin
      .from("session_players")
      .upsert({ session_id: sessionId, player_id }, { onConflict: "session_id,player_id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (action === "remove") {
    const { error } = await admin
      .from("session_players")
      .delete()
      .eq("session_id", sessionId)
      .eq("player_id", player_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Switch to manual override mode (affects all subsequent matches)
  await admin
    .from("sessions")
    .update({ manual_override: true })
    .eq("id", sessionId);

  return NextResponse.json({ success: true });
}
