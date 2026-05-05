// ─── ELO Rating System ────────────────────────────────────────────────────────
// Standard Elo with K=32. Applied per match (team average vs team average).

const K = 32;

/** Expected score for player A given ratings rA and rB */
export function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

/**
 * Calculate new ratings for both teams after a match.
 * teamA and teamB are arrays of current ELO ratings.
 * winner: "a" | "b"
 * Returns deltas for each player.
 */
export function calculateEloDeltas(
  teamA: number[],
  teamB: number[],
  winner: "a" | "b"
): { deltasA: number[]; deltasB: number[] } {
  const avgA = teamA.reduce((s, r) => s + r, 0) / teamA.length;
  const avgB = teamB.reduce((s, r) => s + r, 0) / teamB.length;

  const expectedA = expectedScore(avgA, avgB);
  const expectedB = 1 - expectedA;

  const scoreA = winner === "a" ? 1 : 0;
  const scoreB = winner === "b" ? 1 : 0;

  const deltaA = Math.round(K * (scoreA - expectedA));
  const deltaB = Math.round(K * (scoreB - expectedB));

  return {
    deltasA: teamA.map(() => deltaA),
    deltasB: teamB.map(() => deltaB),
  };
}

/**
 * Apply ELO deltas to a map of player ratings.
 * Returns a new map with updated ratings.
 */
export function applyDeltas(
  ratings: Map<string, number>,
  playerIds: string[],
  deltas: number[]
): Map<string, number> {
  const updated = new Map(ratings);
  playerIds.forEach((id, i) => {
    const current = updated.get(id) ?? 1000;
    updated.set(id, Math.max(100, current + deltas[i])); // floor at 100
  });
  return updated;
}

/**
 * Given two teams (arrays of {id, elo}), compute expected win probability for team A.
 * Useful for showing "fairness" score in auto-teaming.
 */
export function teamWinProbability(
  teamA: { elo: number }[],
  teamB: { elo: number }[]
): number {
  const avgA = teamA.reduce((s, p) => s + p.elo, 0) / teamA.length;
  const avgB = teamB.reduce((s, p) => s + p.elo, 0) / teamB.length;
  return Math.round(expectedScore(avgA, avgB) * 100);
}

/**
 * Auto-team algorithm: given N players, find the pairing of 4 that minimises
 * the ELO difference between the two teams.
 * Returns [teamA_ids, teamB_ids] for the most balanced match,
 * plus the remaining players for the waiting queue.
 */
export function autoTeam(players: { id: string; elo: number }[]): {
  teamA: string[];
  teamB: string[];
  waiting: string[];
} {
  if (players.length < 4) {
    throw new Error("Need at least 4 players to auto-team");
  }

  // Sort by ELO descending
  const sorted = [...players].sort((a, b) => b.elo - a.elo);

  // Try all combinations of 4 players from the pool choosing 2 for team A
  // For simplicity: take top 4, find best split
  const top4 = sorted.slice(0, 4);
  const waiting = sorted.slice(4).map((p) => p.id);

  let bestDiff = Infinity;
  let bestA: string[] = [];
  let bestB: string[] = [];

  // All ways to pick 2 from 4 for team A (6 combos, but only 3 distinct splits)
  const combos = [
    [0, 1],
    [0, 2],
    [0, 3],
  ];

  for (const [i, j] of combos) {
    const aIdx = [i, j];
    const bIdx = top4.map((_, idx) => idx).filter((idx) => !aIdx.includes(idx));
    const avgA = (top4[aIdx[0]].elo + top4[aIdx[1]].elo) / 2;
    const avgB = (top4[bIdx[0]].elo + top4[bIdx[1]].elo) / 2;
    const diff = Math.abs(avgA - avgB);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestA = [top4[aIdx[0]].id, top4[aIdx[1]].id];
      bestB = [top4[bIdx[0]].id, top4[bIdx[1]].id];
    }
  }

  return { teamA: bestA, teamB: bestB, waiting };
}
