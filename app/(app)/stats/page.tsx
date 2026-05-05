import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/profile/avatar";
import { formatWinRate } from "@/lib/utils";
import type { Profile } from "@/types";

export const revalidate = 0;

export default async function StatsPage() {
  const supabase = await createClient();

  const { data: allProfiles } = await supabase
    .from("profiles").select("*").order("total_points", { ascending: false });
  const profiles = (allProfiles ?? []) as Profile[];

  const { data: matchesData } = await supabase
    .from("matches").select("id, team_a, team_b, winner_team, session_id")
    .not("winner_team", "is", null);
  const matches = matchesData ?? [];

  const { data: gamesData } = await supabase.from("games").select("id");
  const totalGames = gamesData?.length ?? 0;

  const { data: sessionsData } = await supabase
    .from("sessions").select("id").eq("is_active", false);
  const totalSessions = sessionsData?.length ?? 0;

  // Per-player win stats
  const winCounts: Record<string, { wins: number; played: number }> = {};
  for (const m of matches) {
    const winners = m.winner_team === "a" ? m.team_a : m.team_b;
    const losers  = m.winner_team === "a" ? m.team_b : m.team_a;
    [...winners, ...losers].forEach((id: string) => {
      if (!winCounts[id]) winCounts[id] = { wins: 0, played: 0 };
      winCounts[id].played++;
    });
    winners.forEach((id: string) => winCounts[id].wins++);
  }

  const playerStats = profiles.map((p) => ({
    profile: p,
    wins:    winCounts[p.id]?.wins ?? 0,
    played:  winCounts[p.id]?.played ?? 0,
  }));

  const mostWins  = [...playerStats].sort((a, b) => b.wins - a.wins)[0];
  const bestRate  = [...playerStats]
    .filter((p) => p.played >= 3)
    .sort((a, b) => (b.wins / b.played) - (a.wins / a.played))[0];
  const highElo   = [...profiles].sort((a, b) => b.elo_rating - a.elo_rating)[0];

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Group Stats</h1>
        <p className="text-slate-500 text-sm mt-1">All-time records for your crew</p>
      </div>

      {/* Overview numbers */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Players",  value: profiles.length },
          { label: "Matches",  value: matches.length },
          { label: "Games",    value: totalGames },
          { label: "Sessions", value: totalSessions },
          { label: "Top ELO",  value: highElo?.elo_rating ?? "—" },
          { label: "Top Pts",  value: profiles[0]?.total_points ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card rounded-2xl p-4 text-center">
            <p className="text-2xl font-heading font-black gradient-text">{value}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Spotlight cards */}
      {(mostWins || bestRate || highElo) && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Highlights</p>

          {highElo && (
            <Link href={`/profile/${highElo.id}`} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0 text-xl">⚡</div>
              <div className="flex-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Highest ELO</p>
                <p className="text-sm font-bold text-white mt-0.5">{highElo.name}</p>
                <p className="text-xs text-slate-500">{highElo.elo_rating} ELO</p>
              </div>
              <Avatar name={highElo.name} avatarUrl={highElo.avatar_url} size="sm" />
            </Link>
          )}

          {mostWins && mostWins.wins > 0 && (
            <Link href={`/profile/${mostWins.profile.id}`} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 border border-amber-500/20 flex items-center justify-center shrink-0 text-xl">🏆</div>
              <div className="flex-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Most Match Wins</p>
                <p className="text-sm font-bold text-white mt-0.5">{mostWins.profile.name}</p>
                <p className="text-xs text-slate-500">{mostWins.wins} wins from {mostWins.played} matches</p>
              </div>
              <Avatar name={mostWins.profile.name} avatarUrl={mostWins.profile.avatar_url} size="sm" />
            </Link>
          )}

          {bestRate && (
            <Link href={`/profile/${bestRate.profile.id}`} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0 text-xl">📈</div>
              <div className="flex-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Best Win Rate (min 3)</p>
                <p className="text-sm font-bold text-white mt-0.5">{bestRate.profile.name}</p>
                <p className="text-xs text-slate-500">{formatWinRate(bestRate.wins, bestRate.played)} from {bestRate.played} matches</p>
              </div>
              <Avatar name={bestRate.profile.name} avatarUrl={bestRate.profile.avatar_url} size="sm" />
            </Link>
          )}
        </div>
      )}

      {/* Per-player breakdown */}
      {playerStats.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Player Breakdown</p>
          <div className="glass-card rounded-2xl overflow-hidden">
            {playerStats.map(({ profile: p, wins, played }, i) => (
              <Link key={p.id} href={`/profile/${p.id}`}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] last:border-0 active:bg-white/[0.03] transition-colors">
                <span className="text-xs font-bold text-slate-600 w-5">#{i + 1}</span>
                <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{played} matches</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold gradient-text">{formatWinRate(wins, played)}</p>
                  <p className="text-[10px] text-slate-600">{wins}W {played - wins}L</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profiles.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-sm font-semibold text-slate-500">No data yet</p>
          <p className="text-xs mt-1">Play some matches to see stats here.</p>
        </div>
      )}
    </div>
  );
}
