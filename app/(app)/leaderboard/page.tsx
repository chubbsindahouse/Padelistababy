import { createAdminClient } from "@/lib/supabase/admin";
import { LeaderboardClient } from "@/components/leaderboard/leaderboard-client";
import type { LeaderboardEntry, Profile, Season } from "@/types";

export const revalidate = 30;

export default async function LeaderboardPage() {
  const admin = createAdminClient();

  const [profilesRes, matchesRes, seasonsRes] = await Promise.all([
    admin.from("profiles").select("id, name, avatar_url, total_points, elo_rating").order("total_points", { ascending: false }).order("elo_rating", { ascending: false }),
    admin.from("matches").select("team_a, team_b, winner_team, session_id").not("winner_team", "is", null),
    admin.from("seasons").select("*").order("number", { ascending: false }),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const matches  = matchesRes.data ?? [];
  const seasons  = (seasonsRes.data ?? []) as Season[];
  const activeSeason = seasons.find((s) => s.is_active) ?? null;

  // W/L counts for the active season only
  const activeSessionIds = new Set<string>();
  if (activeSeason) {
    const { data: activeSessions } = await admin
      .from("sessions")
      .select("id")
      .eq("season_id", activeSeason.id);
    (activeSessions ?? []).forEach((s: { id: string }) => activeSessionIds.add(s.id));
  }

  const winCounts: Record<string, { wins: number; played: number }> = {};
  for (const m of matches) {
    // Only count matches from the active season's sessions
    if (activeSeason && !activeSessionIds.has(m.session_id)) continue;
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

  return <LeaderboardClient entries={entries} seasons={seasons} activeSeason={activeSeason} />;
}
