import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateSessionPoints } from "@/lib/points";

/** DELETE /api/admin/sessions/[id]
 *  Deletes a session and fully rolls back all side-effects:
 *  - ELO and points changes on player profiles
 *  - Achievements awarded in the session
 *  - elo_history rows
 *  - games, matches, session_players, session
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: sessionId } = await params;
  const admin = createAdminClient();

  // 1. Check if session was already ended (ELO/points already applied)
  const { data: session } = await admin
    .from("sessions").select("is_active").eq("id", sessionId).single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // ── 2. Always revert ELO ────────────────────────────────────────────────────
  // ELO is applied per-match (recorded in elo_history) regardless of whether
  // the session has been formally ended, so we always need to roll it back.
  const { data: eloRows } = await admin
    .from("elo_history")
    .select("player_id, delta")
    .eq("session_id", sessionId);

  const netDelta: Record<string, number> = {};
  for (const row of eloRows ?? []) {
    netDelta[row.player_id] = (netDelta[row.player_id] ?? 0) + row.delta;
  }

  // ── 3. Revert points only for ended sessions ─────────────────────────────
  // Points (calculateSessionPoints) are only awarded when a session is ended,
  // so active sessions have no points to roll back.
  const pointsToDeduct: Record<string, number> = {};
  if (!session.is_active) {
    const { data: completedMatches } = await admin
      .from("matches")
      .select("team_a, team_b, winner_team")
      .eq("session_id", sessionId)
      .not("winner_team", "is", null);

    const results: Record<string, { wins: number; losses: number }> = {};
    for (const m of completedMatches ?? []) {
      const winners = m.winner_team === "a" ? m.team_a : m.team_b;
      const losers  = m.winner_team === "a" ? m.team_b : m.team_a;
      for (const id of [...winners, ...losers]) {
        if (!results[id]) results[id] = { wins: 0, losses: 0 };
      }
      for (const id of winners as string[]) results[id].wins++;
      for (const id of losers  as string[]) results[id].losses++;
    }

    for (const [pid, { wins, losses }] of Object.entries(results)) {
      pointsToDeduct[pid] = calculateSessionPoints(wins, losses);
    }
  }

  // ── 4. Apply reversals to profiles ──────────────────────────────────────
  const allPlayerIds = [...new Set([...Object.keys(netDelta), ...Object.keys(pointsToDeduct)])];
  if (allPlayerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, elo_rating, total_points")
      .in("id", allPlayerIds);

    await Promise.all(
      (profiles ?? []).map((p: { id: string; elo_rating: number; total_points: number }) =>
        admin.from("profiles").update({
          elo_rating:   Math.max(100, p.elo_rating   - (netDelta[p.id]       ?? 0)),
          total_points: Math.max(0,   p.total_points - (pointsToDeduct[p.id] ?? 0)),
        }).eq("id", p.id)
      )
    );
  }

  // ── 5. Delete achievements (ended sessions only) + elo_history (always) ──
  await Promise.all([
    ...(session.is_active ? [] : [admin.from("achievements").delete().eq("session_id", sessionId)]),
    admin.from("elo_history").delete().eq("session_id", sessionId),
  ]);

  // 6. Delete games → matches → session_players → session
  const { data: matches } = await admin
    .from("matches").select("id").eq("session_id", sessionId);

  if (matches?.length) {
    const matchIds = matches.map((m: { id: string }) => m.id);
    await admin.from("games").delete().in("match_id", matchIds);
    await admin.from("matches").delete().in("id", matchIds);
  }

  await admin.from("session_players").delete().eq("session_id", sessionId);
  await admin.from("sessions").delete().eq("id", sessionId);

  return NextResponse.json({ ok: true });
}

/** PATCH /api/admin/sessions/[id] — toggle is_active or update format */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sessions").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
