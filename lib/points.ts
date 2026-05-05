// ─── Points System ────────────────────────────────────────────────────────────
// Points are awarded per match (not per game) and accumulated on the leaderboard.

export const POINTS = {
  MATCH_WIN: 3,
  MATCH_LOSS: 1,   // participation points
  SESSION_BONUS: 1, // just for showing up
} as const;

export function calculateSessionPoints(
  matchWins: number,
  matchLosses: number
): number {
  return (
    matchWins * POINTS.MATCH_WIN +
    matchLosses * POINTS.MATCH_LOSS +
    POINTS.SESSION_BONUS
  );
}
