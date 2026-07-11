import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { getCurrentPlayerId } from "@/lib/player-auth";
import { calculateEloDeltas, dominanceMultiplier } from "@/lib/elo";
import { calculateSessionPoints } from "@/lib/points";
import { checkAchievements } from "@/lib/achievements";
import type { MatchWithGames, Profile, BadgeKey } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const [adminOk, playerId] = await Promise.all([isAdmin(), getCurrentPlayerId()]);
  if (!adminOk && !playerId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Load session
  const { data: session } = await admin
    .from("sessions").select("*").eq("id", sessionId).single();
  if (!session || !session.is_active) {
    return NextResponse.json({ error: "Session not found or already ended" }, { status: 404 });
  }

  // 2. Load session players + profiles
  const { data: spRows } = await admin
    .from("session_players").select("player_id").eq("session_id", sessionId);
  const playerIds = (spRows ?? []).map((r: { player_id: string }) => r.player_id);

  const { data: profilesData } = await admin
    .from("profiles").select("*").in("id", playerIds);
  const profiles = (profilesData ?? []) as Profile[];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // 3. Load completed matches for this session with their games
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

  // 4. ELO deltas per match — track per-match ELOs for Giant Killer
  let currentRatings = new Map(profiles.map((p) => [p.id, p.elo_rating]));

  const eloHistoryInserts: {
    player_id: string; session_id: string;
    rating_before: number; rating_after: number; delta: number;
  }[] = [];

  const sessionResults: Record<string, { wins: number; losses: number }> = {};
  playerIds.forEach((id) => { sessionResults[id] = { wins: 0, losses: 0 }; });

  // Track Giant Killer per player: wins where opponent avg ELO was 100+ higher
  const giantKillerEarned = new Set<string>();

  for (const match of enrichedMatches) {
    const winner = match.winner_team!;
    const winnerIds = winner === "a" ? match.team_a : match.team_b;
    const loserIds  = winner === "a" ? match.team_b : match.team_a;

    const teamAElos = match.team_a.map((id) => currentRatings.get(id) ?? 1000);
    const teamBElos = match.team_b.map((id) => currentRatings.get(id) ?? 1000);

    // Giant Killer: winning pair had avg ELO >= 100 lower than losing pair
    const winnerElos = winner === "a" ? teamAElos : teamBElos;
    const loserElos  = winner === "a" ? teamBElos : teamAElos;
    const avgWinner  = winnerElos.reduce((s, r) => s + r, 0) / winnerElos.length;
    const avgLoser   = loserElos.reduce((s, r) => s + r, 0) / loserElos.length;
    if (avgLoser - avgWinner >= 100) {
      winnerIds.forEach((id) => giantKillerEarned.add(id));
    }

    // Dominance multiplier: 2-0/3-0 -> x1.30 | 3-1 -> x1.10 | 2-1/3-2 -> x0.85
    const winnerGames = match.games.filter(g =>
      winner === "a" ? g.score_a > g.score_b : g.score_b > g.score_a
    ).length;
    const loserGames = match.games.length - winnerGames;
    const mult = dominanceMultiplier(winnerGames, loserGames);

    const ratingsBefore = new Map(currentRatings);
    const { deltasA, deltasB } = calculateEloDeltas(teamAElos, teamBElos, winner, mult);

    match.team_a.forEach((id, i) => {
      const before = currentRatings.get(id) ?? 1000;
      currentRatings.set(id, Math.max(100, before + deltasA[i]));
    });
    match.team_b.forEach((id, i) => {
      const before = currentRatings.get(id) ?? 1000;
      currentRatings.set(id, Math.max(100, before + deltasB[i]));
    });

    [...match.team_a, ...match.team_b].forEach((id, idx) => {
      const isTeamA = idx < match.team_a.length;
      const delta = isTeamA ? deltasA[idx] : deltasB[idx - match.team_a.length];
      eloHistoryInserts.push({
        player_id:    id,
        session_id:   sessionId,
        rating_before: ratingsBefore.get(id) ?? 1000,
        rating_after:  currentRatings.get(id) ?? 1000,
        delta,
      });
    });

    winnerIds.forEach((id) => sessionResults[id].wins++);
    loserIds.forEach((id)  => sessionResults[id].losses++);
  }

  // 5. Points per player
  const pointsEarned: Record<string, number> = {};
  playerIds.forEach((id) => {
    const { wins, losses } = sessionResults[id];
    pointsEarned[id] = calculateSessionPoints(wins, losses);
  });

  // 6. All-time stats for achievement checker
  // Load all completed matches (all sessions)
  const { data: allMatchesData } = await admin
    .from("matches")
    .select("team_a, team_b, winner_team, session_id")
    .not("winner_team", "is", null);

  // Load all-time session attendance
  const { data: sessionCountData } = await admin
    .from("session_players").select("player_id, session_id");

  // Load existing achievements for these players — filtered to the current season only
  const seasonId: string | null = session.season_id ?? null;
  const existingAchQuery = admin
    .from("achievements").select("player_id, badge_key").in("player_id", playerIds);
  if (seasonId) existingAchQuery.eq("season_id", seasonId);
  const { data: existingAchData } = await existingAchQuery;

  const existingAchievements: Record<string, BadgeKey[]> = {};
  (existingAchData ?? []).forEach((row: { player_id: string; badge_key: BadgeKey }) => {
    if (!existingAchievements[row.player_id]) existingAchievements[row.player_id] = [];
    existingAchievements[row.player_id].push(row.badge_key);
  });

  // Session counts per player (all-time, including current session)
  const sessionCounts: Record<string, number> = {};
  (sessionCountData ?? []).forEach((row: { player_id: string }) => {
    sessionCounts[row.player_id] = (sessionCounts[row.player_id] ?? 0) + 1;
  });

  // Compute all-time stats from all matches
  const totalMatchesPerPlayer: Record<string, number>  = {};
  const allTimeWinsPerPlayer: Record<string, number>   = {};
  const partnerWinsMap: Record<string, Record<string, number>> = {};
  const upsetWinsMap: Record<string, number>           = {};

  for (const m of allMatchesData ?? []) {
    if (!m.winner_team) continue;
    const winnerIds = (m.winner_team === "a" ? m.team_a : m.team_b) as string[];
    const loserIds  = (m.winner_team === "a" ? m.team_b : m.team_a) as string[];

    // Match participation count
    [...winnerIds, ...loserIds].forEach((id) => {
      totalMatchesPerPlayer[id] = (totalMatchesPerPlayer[id] ?? 0) + 1;
    });

    // All-time wins
    winnerIds.forEach((id) => {
      allTimeWinsPerPlayer[id] = (allTimeWinsPerPlayer[id] ?? 0) + 1;
    });

    // Partnership wins
    for (let i = 0; i < winnerIds.length; i++) {
      for (let j = i + 1; j < winnerIds.length; j++) {
        const a = winnerIds[i], b = winnerIds[j];
        if (!partnerWinsMap[a]) partnerWinsMap[a] = {};
        if (!partnerWinsMap[b]) partnerWinsMap[b] = {};
        partnerWinsMap[a][b] = (partnerWinsMap[a][b] ?? 0) + 1;
        partnerWinsMap[b][a] = (partnerWinsMap[b][a] ?? 0) + 1;
      }
    }

    // Upset wins: winner pair had lower avg ELO than loser pair (use current ratings as proxy)
    if (winnerIds.length > 0 && loserIds.length > 0) {
      const avgWinnerElo = winnerIds.reduce((s, id) => s + (profileMap.get(id)?.elo_rating ?? 1000), 0) / winnerIds.length;
      const avgLoserElo  = loserIds.reduce((s, id) => s + (profileMap.get(id)?.elo_rating ?? 1000), 0) / loserIds.length;
      if (avgLoserElo > avgWinnerElo) {
        winnerIds.forEach((id) => {
          upsetWinsMap[id] = (upsetWinsMap[id] ?? 0) + 1;
        });
      }
    }
  }

  const allTimeStats = Object.fromEntries(
    playerIds.map((id) => [id, {
      totalMatchesPlayed: totalMatchesPerPlayer[id] ?? 0,
      allTimeWins:        allTimeWinsPerPlayer[id]  ?? 0,
      sessionsAttended:   sessionCounts[id]          ?? 0,
      upsetWins:          upsetWinsMap[id]           ?? 0,
      partnerWins:        partnerWinsMap[id]         ?? {},
    }])
  );

  // 7. Run achievement checker
  const newAchievements = checkAchievements({
    sessionId,
    matches: enrichedMatches,
    players: profiles,
    existingAchievements,
    allTimeStats,
  });

  // Giant Killer (needs per-match ELO context — checked above)
  giantKillerEarned.forEach((id) => {
    if (!existingAchievements[id]?.includes("giant_killer")) {
      if (!newAchievements[id]) newAchievements[id] = [];
      if (!newAchievements[id].includes("giant_killer")) {
        newAchievements[id].push("giant_killer");
      }
    }
  });

  // Top of the Table: highest ELO after this session
  const maxElo = Math.max(...[...currentRatings.values()]);
  currentRatings.forEach((elo, id) => {
    if (elo === maxElo && !existingAchievements[id]?.includes("top_of_the_table")) {
      if (!newAchievements[id]) newAchievements[id] = [];
      if (!newAchievements[id].includes("top_of_the_table")) {
        newAchievements[id].push("top_of_the_table");
      }
    }
  });

  // 8. Write to DB
  if (eloHistoryInserts.length > 0) {
    await admin.from("elo_history").insert(eloHistoryInserts);
  }

  await Promise.all(
    playerIds.map((id) => {
      const newRating     = currentRatings.get(id) ?? profileMap.get(id)?.elo_rating ?? 1000;
      const earned        = pointsEarned[id] ?? 0;
      const currentPoints = profileMap.get(id)?.total_points ?? 0;
      return admin.from("profiles").update({
        elo_rating:   newRating,
        total_points: currentPoints + earned,
      }).eq("id", id);
    })
  );

  const achievementInserts = Object.entries(newAchievements).flatMap(
    ([playerId, keys]) =>
      keys.map((key) => ({ player_id: playerId, badge_key: key, session_id: sessionId, season_id: seasonId }))
  );
  if (achievementInserts.length > 0) {
    await admin.from("achievements").insert(achievementInserts);
  }

  await admin.from("sessions").update({
    is_active: false,
    ended_at:  new Date().toISOString(),
  }).eq("id", sessionId);

  return NextResponse.json({
    success:        true,
    eloChanges:     Object.fromEntries(currentRatings),
    pointsEarned,
    newAchievements,
  });
}
