import { createClient } from "@/lib/supabase/server";
import { LeaderboardClient } from "@/components/leaderboard/leaderboard-client";
import type { LeaderboardEntry, Profile } from "@/types";

export const revalidate = 30;

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [profilesRes, matchesRes] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar_url, total_points, elo_rating").order("total_points", { ascending: false }),
    supabase.from("matches").select("team_a, team_b, winner_team").not("winner_team", "is", null),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const matches  = matchesRes.data;

  const winCounts: Record<string, { wins: number; played: number }> = {};
  for (const m of matches ?? []) {
    const winners = m.winner_team === "a" ? m.team_a : m.team_b;
    const losers  = m.winner_team === "a" ? m.team_b : m.team_a;
    [...winners, ...losers].forEach((id: string) => {
      if (!winCounts[id]) winCounts[id] = { wins: 0, played: 0 };
      winCounts[id].played++;
    });
    winners.forEach((id: string) => winCounts[id].wins++);
  }

  const entries: LeaderboardEntry[] = profiles.map((p, i) => ({
    rank: i + 1,
    profile: p,
    matchWins: winCounts[p.id]?.wins ?? 0,
    matchesPlayed: winCounts[p.id]?.played ?? 0,
    winRate: winCounts[p.id]?.played ? winCounts[p.id].wins / winCounts[p.id].played : 0,
  }));

  return <LeaderboardClient entries={entries} />;
}
