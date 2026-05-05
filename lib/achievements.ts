import type { BadgeKey, MatchWithGames, Profile } from "@/types";

// ─── Achievement Checker ──────────────────────────────────────────────────────
// Called at the end of a session. Returns a map of player_id → badge keys earned.

export interface AchievementCheckInput {
  sessionId: string;
  matches: MatchWithGames[];
  players: Profile[]; // all players in the session
  existingAchievements: Record<string, BadgeKey[]>; // player_id → already-unlocked keys
  allTimeStats: Record<
    string,
    {
      totalGamesPlayed: number;
      sessionsAttended: number;
      upsetWins: number; // wins as lower-ELO pair
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
    { wins: number; losses: number; gamesPlayed: number; consecutiveWins: number }
  > = {};

  players.forEach((p) => {
    sessionStats[p.id] = { wins: 0, losses: 0, gamesPlayed: 0, consecutiveWins: 0 };
  });

  matches.forEach((match) => {
    if (!match.winner_team) return;

    const winnerIds = match.winner_team === "a" ? match.team_a : match.team_b;
    const loserIds = match.winner_team === "a" ? match.team_b : match.team_a;

    winnerIds.forEach((id) => {
      sessionStats[id].wins++;
      sessionStats[id].gamesPlayed += match.games.length;
    });
    loserIds.forEach((id) => {
      sessionStats[id].losses++;
      sessionStats[id].gamesPlayed += match.games.length;
    });

    // ── Hat Trick: 3 consecutive wins in winner-stays-on ──────────────────
    if (match.consecutive_wins >= 3) {
      winnerIds.forEach((id) => earn(id, "hat_trick"));
    }

    // ── Come Back Kid: win after losing first game ────────────────────────
    if (match.games.length >= 2) {
      const g0 = match.games[0];
      const teamAWonFirst = g0.score_a > g0.score_b;
      if (match.winner_team === "a" && !teamAWonFirst) {
        match.team_a.forEach((id) => earn(id, "come_back_kid"));
      }
      if (match.winner_team === "b" && teamAWonFirst) {
        match.team_b.forEach((id) => earn(id, "come_back_kid"));
      }
    }

    // ── Perfect Game: win a game 6-0 ─────────────────────────────────────
    match.games.forEach((game) => {
      if (game.score_a === 6 && game.score_b === 0) {
        match.team_a.forEach((id) => earn(id, "perfect_game"));
      }
      if (game.score_b === 6 && game.score_a === 0) {
        match.team_b.forEach((id) => earn(id, "perfect_game"));
      }
    });
  });

  // ── First Blood: first ever match win ────────────────────────────────────
  players.forEach((p) => {
    const stats = allTimeStats[p.id];
    const prevWins =
      (stats?.totalGamesPlayed ?? 0) - (sessionStats[p.id]?.wins ?? 0);
    if (prevWins === 0 && sessionStats[p.id].wins > 0) {
      earn(p.id, "first_blood");
    }
  });

  // ── Iron Man: most games played in this session ───────────────────────────
  const maxGames = Math.max(...Object.values(sessionStats).map((s) => s.gamesPlayed));
  players.forEach((p) => {
    if (sessionStats[p.id].gamesPlayed === maxGames && maxGames > 0) {
      earn(p.id, "iron_man");
    }
  });

  // ── Dominator: win all matches in session (min 3) ─────────────────────────
  players.forEach((p) => {
    const s = sessionStats[p.id];
    if (s.wins >= 3 && s.losses === 0) {
      earn(p.id, "dominator");
    }
  });

  // ── All-time achievements (use updated stats) ─────────────────────────────
  players.forEach((p) => {
    const stats = allTimeStats[p.id];
    if (!stats) return;

    // Century Club
    if (stats.totalGamesPlayed >= 100) earn(p.id, "century_club");

    // Consistent
    if (stats.sessionsAttended >= 10) earn(p.id, "consistent");

    // Upset Artist
    if (stats.upsetWins >= 5) earn(p.id, "upset_artist");

    // Dynamic Duo
    const maxPartnerWins = Math.max(...Object.values(stats.partnerWins ?? {}), 0);
    if (maxPartnerWins >= 10) earn(p.id, "dynamic_duo");
  });

  return newlyEarned;
}
