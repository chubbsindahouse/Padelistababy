import { createClient } from "@/lib/supabase/server";
import { LeaderboardRow } from "@/components/leaderboard/leaderboard-row";
import { Avatar } from "@/components/profile/avatar";
import type { LeaderboardEntry, Profile } from "@/types";

export const revalidate = 30;

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [profilesRes, matchesRes] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar_url, total_points, elo_rating").order("total_points", { ascending: false }),
    supabase.from("matches").select("team_a, team_b, winner_team").not("winner_team", "is", null),
  ]);

  const profiles = profilesRes.data;
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

  const entries: LeaderboardEntry[] = (profiles ?? []).map((p: Profile, i) => ({
    rank: i + 1,
    profile: p,
    matchWins: winCounts[p.id]?.wins ?? 0,
    matchesPlayed: winCounts[p.id]?.played ?? 0,
    winRate: winCounts[p.id]?.played ? winCounts[p.id].wins / winCounts[p.id].played : 0,
  }));

  const [first, second, third] = entries;

  return (
    <div className="pt-8 pb-4">
      <div className="px-4 mb-6">
        <h1 className="text-2xl font-heading font-bold text-white">Leaderboard</h1>
        <p className="text-slate-500 text-sm mt-1">{profiles?.length ?? 0} players competing</p>
      </div>

      {/* Podium */}
      {entries.length >= 3 && (
        <div className="px-4 mb-6">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-600/5 to-indigo-600/10" />
            <div className="absolute inset-0 border border-cyan-500/15 rounded-2xl" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-cyan-400/10 blur-3xl rounded-full" />

            <div className="relative flex items-end justify-center gap-3 p-6 pt-8">
              {/* 2nd */}
              <div className="flex flex-col items-center">
                <Avatar name={second.profile.name} avatarUrl={second.profile.avatar_url} size="md" className="ring-2 ring-slate-400/30 mb-2" />
                <p className="text-xs font-bold text-slate-300 truncate max-w-[60px] text-center">{second.profile.name.split(" ")[0]}</p>
                <p className="text-xs text-slate-500">{second.profile.total_points}pts</p>
                <div className="mt-2 w-16 h-14 glass rounded-t-xl flex items-end justify-center pb-2 border-b-0">
                  <span className="text-2xl">🥈</span>
                </div>
              </div>

              {/* 1st */}
              <div className="flex flex-col items-center -mt-6">
                <div className="relative mb-2">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-cyan-400/50 to-blue-600/50 blur-md" />
                  <Avatar name={first.profile.name} avatarUrl={first.profile.avatar_url} size="lg" className="relative ring-2 ring-cyan-400/50" />
                </div>
                <p className="text-sm font-black text-white truncate max-w-[70px] text-center">{first.profile.name.split(" ")[0]}</p>
                <p className="text-xs gradient-text font-bold">{first.profile.total_points}pts</p>
                <div className="mt-2 w-16 h-20 glass rounded-t-xl flex items-end justify-center pb-2 border-b-0 bg-cyan-500/10">
                  <span className="text-2xl">🥇</span>
                </div>
              </div>

              {/* 3rd */}
              <div className="flex flex-col items-center">
                <Avatar name={third.profile.name} avatarUrl={third.profile.avatar_url} size="md" className="ring-2 ring-amber-700/30 mb-2" />
                <p className="text-xs font-bold text-slate-300 truncate max-w-[60px] text-center">{third.profile.name.split(" ")[0]}</p>
                <p className="text-xs text-slate-500">{third.profile.total_points}pts</p>
                <div className="mt-2 w-16 h-10 glass rounded-t-xl flex items-end justify-center pb-2 border-b-0">
                  <span className="text-2xl">🥉</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full table */}
      <div className="mx-4 glass-card rounded-2xl overflow-hidden">
        {entries.map((entry) => (
          <LeaderboardRow key={entry.profile.id} entry={entry} highlight={false} />
        ))}
        {entries.length === 0 && (
          <p className="text-center text-slate-600 text-sm py-12">No players yet.</p>
        )}
      </div>
    </div>
  );
}
