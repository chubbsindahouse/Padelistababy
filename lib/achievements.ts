import type { BadgeKey, MatchWithGames, Profile } from "@/types";

// ─── Achievement Checker ──────────────────────────────────────────────────────
// Called at the end of every session. Returns a map of player_id → badge keys earned.

export interface AchievementCheckInput {
  sessionId: string;
  matches: MatchWithGames[];
  players: Profile[]; // all players in the session
  existingAchievements: Record<string, BadgeKey[]>; // player_id → already-unlocked keys
  allTimeStats: Record<
    string,
    {
      totalMatchesPlayed: number;  // all-time match participations (including this session)
      allTimeWins: number;         // all-time match wins (including this session)
      sessionsAttended: number;
      upsetWins: number;           // wins where your pair had lower avg ELO
      partnerWins: Record<string, number>; // partner_id → wins together
    }
  >;
}

export function checkAchievements(
  input: AchievementCheckInput
): Record<string, BadgeKey[]> {
  const { matches, players, existingAchievements, allTimeStats } = input;
  const newlyEarned: Record<string, BadgeKey[]> = {};

  const has = (playerId: string, key: BadgeKey) =>
    existingAchievements[playerId]?.includes(key);

  const earn = (playerId: string, key: BadgeKey) => {
    if (has(playerId, key)) return;
    if (!newlyEarned[playerId]) newlyEarned[playerId] = [];
    if (!newlyEarned[playerId].includes(key)) {
      newlyEarned[playerId].push(key);
    }
  };

  // Per-player session stats
  const sessionStats: Record<
    string,
    { wins: number; losses: number; setsPlayed: number }
  > = {};
  players.forEach((p) => {
    sessionStats[p.id] = { wins: 0, losses: 0, setsPlayed: 0 };
  });

  matches.forEach((match) => {
    if (!match.winner_team) return;

    const winnerIds = match.winner_team === "a" ? match.team_a : match.team_b;
    const loserIds  = match.winner_team === "a" ? match.team_b : match.team_a;
    const numSets   = match.games.length;

    winnerIds.forEach((id) => {
      sessionStats[id].wins++;
      sessionStats[id].setsPlayed += numSets;
    });
    loserIds.forEach((id) => {
      sessionStats[id].losses++;
      sessionStats[id].setsPlayed += numSets;
    });

    // ── Hat Trick: 3 consecutive wins (winner-stays-on) ───────────────────
    if (match.consecutive_wins >= 3) {
      winnerIds.forEach((id) => earn(id, "hat_trick"));
    }

    // ── Come Back Kid: win after losing the first set ─────────────────────
    if (numSets >= 2) {
      const g0 = match.games[0];
      const teamAWonFirst = g0.score_a > g0.score_b;
      if (match.winner_team === "a" && !teamAWonFirst) {
        match.team_a.forEach((id) => earn(id, "come_back_kid"));
      }
      if (match.winner_team === "b" && teamAWonFirst) {
        match.team_b.forEach((id) => earn(id, "come_back_kid"));
      }
    }

    // ── Perfect Game: win a match without dropping a single set ──────────
    // In BO3 this means 2-0; in BO5 this means 3-0.
    const setsWonByWinner = match.games.filter((g) =>
      match.winner_team === "a" ? g.score_a > g.score_b : g.score_b > g.score_a
    ).length;
    const setsLostByWinner = numSets - setsWonByWinner;
    if (setsLostByWinner === 0 && setsWonByWinner >= 2) {
      winnerIds.forEach((id) => earn(id, "perfect_game"));
    }
  });

  // ── First Blood: first ever match win ────────────────────────────────────
  players.forEach((p) => {
    const stats = allTimeStats[p.id];
    if (!stats) return;
    // allTimeWins includes this session; subtract session wins to get pre-session wins
    const preSessionWins = stats.allTimeWins - (sessionStats[p.id]?.wins ?? 0);
    if (preSessionWins === 0 && (sessionStats[p.id]?.wins ?? 0) > 0) {
      earn(p.id, "first_blood");
    }
  });

  // ── Iron Man: most sets played in this session ────────────────────────────
  const maxSets = Math.max(...Object.values(sessionStats).map((s) => s.setsPlayed), 0);
  if (maxSets > 0) {
    players.forEach((p) => {
      if (sessionStats[p.id]?.setsPlayed === maxSets) earn(p.id, "iron_man");
    });
  }

  // ── Dominator: win every match in session (min 3 wins, zero losses) ───────
  players.forEach((p) => {
    const s = sessionStats[p.id];
    if (s?.wins >= 3 && s.losses === 0) earn(p.id, "dominator");
  });

  // ── All-time achievements ─────────────────────────────────────────────────
  players.forEach((p) => {
    const stats = allTimeStats[p.id];
    if (!stats) return;

    // Century Club: 100 matches played all-time
    if (stats.totalMatchesPlayed >= 100) earn(p.id, "century_club");

    // Consistent: attend 10 sessions
    if (stats.sessionsAttended >= 10) earn(p.id, "consistent");

    // Upset Artist: 5 upset wins all-time
    if (stats.upsetWins >= 5) earn(p.id, "upset_artist");

    // Dynamic Duo: 10 wins with the same partner
    const maxPartnerWins = Math.max(...Object.values(stats.partnerWins ?? {}), 0);
    if (maxPartnerWins >= 10) earn(p.id, "dynamic_duo");
  });

  return newlyEarned;
}
