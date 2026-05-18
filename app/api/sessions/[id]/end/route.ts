import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { calculateEloDeltas } from "@/lib/elo";
import { calculateSessionPoints } from "@/lib/points";
import { checkAchievements } from "@/lib/achievements";
import type { MatchWithGames, Profile, BadgeKey } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  // Admin client bypasses RLS on all DB writes
  const admin = createAdminClient();

  // 1. Load session
  const { data: session } = await admin
    .from("sessions").select("*").eq("id", sessionId).single();
  if (!session || !session.is_active) {
    return NextResponse.json({ error: "Session not found or already ended" }, { status: 404 });
  }

  // 2. Load session players
  const { data: spRows } = await admin
    .from("session_players").select("player_id").eq("session_id", sessionId);
  const playerIds = (spRows ?? []).map((r: { player_id: string }) => r.player_id);

  const { data: profilesData } = await admin
    .from("profiles").select("*").in("id", playerIds);
  const profiles = (profilesData ?? []) as Profile[];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // 3. Load all completed matches with games
  const { data: matchesData } = await admin
    .from("matches")
    .select("*")
    .eq("session_id", sessionId)
    .not("winner_team", "is", null)
    .order("match_order");

  const enrichedMatches: MatchWithGames[] = await Promise.all(
    (matchesData ?? []).map(async (m) => {
      const { data: gs } = await admin
        .from("games").select("*").eq("match_id", m.id).order("game_order");
      return { ...m, games: gs ?? [] };
    })
  );

  // 4. Calculate ELO deltas per match
  let currentRatings = new Map(profiles.map((p) => [p.id, p.elo_rating]));
  const eloHistoryInserts: {
    player_id: string; session_id: string;
    rating_before: number; rating_after: number;
  }[] = [];

  // Track per-player session match results for points
  const sessionResults: Record<string, { wins: number; losses: number }> = {};
  playerIds.forEach((id) => { sessionResults[id] = { wins: 0, losses: 0 }; });

  for (const match of enrichedMatches) {
    const winner = match.winner_team!;
    const winnerIds = winner === "a" ? match.team_a : match.team_b;
    const loserIds = winner === "a" ? match.team_b : match.team_a;

    const ratingsBefore = new Map(currentRatings);

    const teamAElos = match.team_a.map((id) => currentRatings.get(id) ?? 1000);
    const teamBElos = match.team_b.map((id) => currentRatings.get(id) ?? 1000);
    const { deltasA, deltasB } = calculateEloDeltas(teamAElos, teamBElos, winner);

    match.team_a.forEach((id, i) => {
      const before = currentRatings.get(id) ?? 1000;
      currentRatings.set(id, Math.max(100, before + deltasA[i]));
    });
    match.team_b.forEach((id, i) => {
      const before = currentRatings.get(id) ?? 1000;
      currentRatings.set(id, Math.max(100, before + deltasB[i]));
    });

    // Record ELO history per player
    [...match.team_a, ...match.team_b].forEach((id) => {
      eloHistoryInserts.push({
        player_id: id,
        session_id: sessionId,
        rating_before: ratingsBefore.get(id) ?? 1000,
        rating_after: currentRatings.get(id) ?? 1000,
      });
    });

    winnerIds.forEach((id) => sessionResults[id].wins++);
    loserIds.forEach((id) => sessionResults[id].losses++);
  }

  // 5. Calculate points per player
  const pointsEarned: Record<string, number> = {};
  playerIds.forEach((id) => {
    const { wins, losses } = sessionResults[id];
    pointsEarned[id] = calculateSessionPoints(wins, losses);
  });

  // 6. Load all-time stats for achievements
  const { data: allMatchesData } = await admin
    .from("matches")
    .select("team_a, team_b, winner_team, session_id")
    .not("winner_team", "is", null);

  const { data: sessionCountData } = await admin
    .from("session_players").select("player_id");

  const { data: existingAchData } = await admin
    .from("achievements").select("player_id, badge_key").in("player_id", playerIds);

  const existingAchievements: Record<string, BadgeKey[]> = {};
  (existingAchData ?? []).forEach((row: { player_id: string; badge_key: BadgeKey }) => {
    if (!existingAchievements[row.player_id]) existingAchievements[row.player_id] = [];
    existingAchievements[row.player_id].push(row.badge_key);
  });

  const sessionCounts: Record<string, number> = {};
  (sessionCountData ?? []).forEach((row: { player_id: string }) => {
    sessionCounts[row.player_id] = (sessionCounts[row.player_id] ?? 0) + 1;
  });

  // Partnership wins all-time
  const partnerWinsMap: Record<string, Record<string, number>> = {};
  let totalGamesPerPlayer: Record<string, number> = {};
  let upsetWinsMap: Record<string, number> = {};

  for (const m of allMatchesData ?? []) {
    if (!m.winner_team) continue;
    const winnerIds = m.winner_team === "a" ? m.team_a : m.team_b;
    const loserIds = m.winner_team === "a" ? m.team_b : m.team_a;
    [...winnerIds, ...loserIds].forEach((id: string) => {
      totalGamesPerPlayer[id] = (totalGamesPerPlayer[id] ?? 0) + 1;
    });
    for (let i = 0; i < winnerIds.length; i++) {
      for (let j = i + 1; j < winnerIds.length; j++) {
        const a = winnerIds[i], b = winnerIds[j];
        if (!partnerWinsMap[a]) partnerWinsMap[a] = {};
        if (!partnerWinsMap[b]) partnerWinsMap[b] = {};
        partnerWinsMap[a][b] = (partnerWinsMap[a][b] ?? 0) + 1;
        partnerWinsMap[b][a] = (partnerWinsMap[b][a] ?? 0) + 1;
      }
    }
  }

  const allTimeStats = Object.fromEntries(
    playerIds.map((id) => [id, {
      totalGamesPlayed: totalGamesPerPlayer[id] ?? 0,
      sessionsAttended: sessionCounts[id] ?? 0,
      upsetWins: upsetWinsMap[id] ?? 0,
      partnerWins: partnerWinsMap[id] ?? {},
    }])
  );

  const newAchievements = checkAchievements({
    sessionId,
    matches: enrichedMatches,
    players: profiles,
    existingAchievements,
    allTimeStats,
  });

  // 7. Write everything to DB (all via admin client — no RLS interference)
  // ELO history
  if (eloHistoryInserts.length > 0) {
    await admin.from("elo_history").insert(eloHistoryInserts);
  }

  // Update profile ratings + points (all in parallel)
  await Promise.all(
    playerIds.map((id) => {
      const newRating    = currentRatings.get(id) ?? profileMap.get(id)?.elo_rating ?? 1000;
      const earnedPoints = pointsEarned[id] ?? 0;
      const currentPoints = profileMap.get(id)?.total_points ?? 0;
      return admin.from("profiles").update({
        elo_rating: newRating,
        total_points: currentPoints + earnedPoints,
      }).eq("id", id);
    })
  );

  // New achievements
  const achievementInserts = Object.entries(newAchievements).flatMap(
    ([playerId, keys]) =>
      keys.map((key) => ({ player_id: playerId, badge_key: key, session_id: sessionId }))
  );
  if (achievementInserts.length > 0) {
    await admin.from("achievements").insert(achievementInserts);
  }

  // Mark session ended
  await admin.from("sessions").update({
    is_active: false,
    ended_at: new Date().toISOString(),
  }).eq("id", sessionId);

  return NextResponse.json({
    success: true,
    eloChanges: Object.fromEntries(currentRatings),
    pointsEarned,
    newAchievements,
  });
}
