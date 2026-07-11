import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

// POST /api/admin/seasons — end current season, snapshot stats, reset profiles, start new season
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Get the active season
  const { data: activeSeason } = await admin
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .single();

  if (!activeSeason) {
    return NextResponse.json({ error: "No active season found" }, { status: 404 });
  }

  // 2. Load all player profiles with current stats
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, elo_rating, total_points")
    .order("total_points", { ascending: false });

  if (!profiles?.length) {
    return NextResponse.json({ error: "No players found" }, { status: 404 });
  }

  // 3. Compute W/L for each player in this season's sessions
  const { data: seasonMatches } = await admin
    .from("matches")
    .select("team_a, team_b, winner_team, session_id")
    .not("winner_team", "is", null);

  // Get session IDs belonging to this season
  const { data: seasonSessions } = await admin
    .from("sessions")
    .select("id")
    .eq("season_id", activeSeason.id);

  const seasonSessionIds = new Set((seasonSessions ?? []).map((s: { id: string }) => s.id));

  const wl: Record<string, { wins: number; losses: number }> = {};
  for (const m of seasonMatches ?? []) {
    if (!seasonSessionIds.has(m.session_id)) continue;
    const winners = (m.winner_team === "a" ? m.team_a : m.team_b) as string[];
    const losers  = (m.winner_team === "a" ? m.team_b : m.team_a) as string[];
    winners.forEach((id: string) => { if (!wl[id]) wl[id] = { wins: 0, losses: 0 }; wl[id].wins++; });
    losers.forEach((id: string)  => { if (!wl[id]) wl[id] = { wins: 0, losses: 0 }; wl[id].losses++; });
  }

  // 4. Snapshot current season stats for each player
  const snapshots = profiles.map((p: { id: string; elo_rating: number; total_points: number }, i: number) => ({
    season_id:    activeSeason.id,
    player_id:    p.id,
    final_elo:    p.elo_rating,
    final_points: p.total_points,
    final_rank:   i + 1, // already sorted by total_points desc
    match_wins:   wl[p.id]?.wins ?? 0,
    match_losses: wl[p.id]?.losses ?? 0,
  }));

  const { error: snapError } = await admin
    .from("season_snapshots")
    .upsert(snapshots, { onConflict: "season_id,player_id" });

  if (snapError) {
    return NextResponse.json({ error: "Failed to snapshot season: " + snapError.message }, { status: 500 });
  }

  // 5. Mark current season as ended
  await admin.from("seasons").update({
    is_active: false,
    ended_at: new Date().toISOString(),
  }).eq("id", activeSeason.id);

  // 6. Create the new season
  const { data: newSeason, error: newSeasonError } = await admin
    .from("seasons")
    .insert({
      number:    activeSeason.number + 1,
      name:      `Season ${activeSeason.number + 1}`,
      is_active: true,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (newSeasonError || !newSeason) {
    return NextResponse.json({ error: "Failed to create new season" }, { status: 500 });
  }

  // 7. Hard reset all player ELOs and points
  const { error: resetError } = await admin
    .from("profiles")
    .update({ elo_rating: 1000, total_points: 0 });

  if (resetError) {
    return NextResponse.json({ error: "Failed to reset player stats" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    endedSeason: activeSeason.number,
    newSeason: newSeason.number,
  });
}
