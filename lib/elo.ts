// ─── ELO Rating System ────────────────────────────────────────────────────────
// Standard Elo with K=32. Applied per match (team average vs team average).
// Dominance multiplier adjusts ELO based on scoreline (zero-sum: what winner
// gains, loser loses exactly the same amount).
//
//  Clean sweep (2-0 / 3-0) → ×1.30  (+30%)
//  Controlled win (3-1)     → ×1.10  (+10%)
//  Close fight (2-1 / 3-2)  → ×0.85  (−15%)

const K = 32;

/**
 * Compute dominance multiplier from game scores.
 * @param winnerGames  - games won by the match winner
 * @param loserGames   - games won by the match loser
 */
export function dominanceMultiplier(winnerGames: number, loserGames: number): number {
  if (loserGames === 0) return 1.30;             // clean sweep (2-0 or 3-0)
  if (winnerGames - loserGames >= 2) return 1.10; // controlled win (3-1 only)
  return 0.85;                                    // close fight (2-1 or 3-2)
}

/** Expected score for player A given ratings rA and rB */
export function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

/**
 * Calculate new ratings for both teams after a match.
 * teamA and teamB are arrays of current ELO ratings.
 * winner: "a" | "b"
 * multiplier: dominance multiplier (default 1.0 = no adjustment)
 *
 * Zero-sum: the winner's gain equals the loser's loss exactly.
 */
export function calculateEloDeltas(
  teamA: number[],
  teamB: number[],
  winner: "a" | "b",
  multiplier = 1.0
): { deltasA: number[]; deltasB: number[] } {
  const avgA = teamA.reduce((s, r) => s + r, 0) / teamA.length;
  const avgB = teamB.reduce((s, r) => s + r, 0) / teamB.length;

  const expectedA = expectedScore(avgA, avgB);
  const expectedB = 1 - expectedA;

  // Apply multiplier to winner's base gain; mirror for zero-sum balance
  const winnerExpected = winner === "a" ? expectedA : expectedB;
  const rawDelta = Math.round(K * (1 - winnerExpected) * multiplier);

  const deltaA = winner === "a" ?  rawDelta : -rawDelta;
  const deltaB = winner === "b" ?  rawDelta : -rawDelta;

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
