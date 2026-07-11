export interface Fixture {
  team_a: string[];
  team_b: string[];
}

/**
 * Generates an Americano-style fixture list for padel.
 * Rotating partners: each player partners with different teammates across fixtures.
 * Uses a greedy algorithm to minimise partnership repeats and balance play time.
 *
 * @param playerIds - Array of player UUIDs (min 4)
 * @param count     - Number of fixtures to generate
 */
export function generateAmericanoFixtures(playerIds: string[], count: number): Fixture[] {
  const n = playerIds.length;
  if (n < 4 || count <= 0) return [];

  // Build every possible fixture: all 4-player subsets × 3 unique 2v2 splits
  const allFixtures: Fixture[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          const g = [playerIds[i], playerIds[j], playerIds[k], playerIds[l]];
          allFixtures.push(
            { team_a: [g[0], g[1]], team_b: [g[2], g[3]] },
            { team_a: [g[0], g[2]], team_b: [g[1], g[3]] },
            { team_a: [g[0], g[3]], team_b: [g[1], g[2]] },
          );
        }
      }
    }
  }

  // Greedy selection — minimise partnership repeats, then balance play time
  const partnerCount: Record<string, Record<string, number>> = {};
  const playCount: Record<string, number> = {};
  playerIds.forEach((id) => { partnerCount[id] = {}; playCount[id] = 0; });

  const partnerScore = (f: Fixture) => {
    const pair = (a: string, b: string) =>
      (partnerCount[a]?.[b] ?? 0) + (partnerCount[b]?.[a] ?? 0);
    return pair(f.team_a[0], f.team_a[1]) + pair(f.team_b[0], f.team_b[1]);
  };

  const maxPlayScore = (f: Fixture) =>
    Math.max(...[...f.team_a, ...f.team_b].map((id) => playCount[id] ?? 0));

  const selected: Fixture[] = [];
  const used = new Set<number>();

  const needed = Math.min(count, allFixtures.length);
  for (let pick = 0; pick < needed; pick++) {
    let bestIdx = -1;
    let bestScore = Infinity;

    for (let j = 0; j < allFixtures.length; j++) {
      if (used.has(j)) continue;
      // Partnership repeats heavily penalised; play time used as tiebreaker
      const score = partnerScore(allFixtures[j]) * 1000 + maxPlayScore(allFixtures[j]);
      if (score < bestScore) { bestScore = score; bestIdx = j; }
    }

    if (bestIdx === -1) break;

    const f = allFixtures[bestIdx];
    used.add(bestIdx);
    selected.push(f);

    // Update tracking
    const bump = (a: string, b: string) => {
      partnerCount[a] ??= {};
      partnerCount[a][b] = (partnerCount[a][b] ?? 0) + 1;
    };
    bump(f.team_a[0], f.team_a[1]);
    bump(f.team_a[1], f.team_a[0]);
    bump(f.team_b[0], f.team_b[1]);
    bump(f.team_b[1], f.team_b[0]);
    [...f.team_a, ...f.team_b].forEach((id) => (playCount[id] = (playCount[id] ?? 0) + 1));
  }

  return selected;
}
