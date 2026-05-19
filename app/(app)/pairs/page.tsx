import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/profile/avatar";
import { formatWinRate } from "@/lib/utils";
import type { Profile } from "@/types";

export const revalidate = 30;

export default async function PairsPage() {
  const supabase = await createClient();

  const [matchesRes, profilesRes] = await Promise.all([
    supabase.from("matches").select("team_a, team_b, winner_team").not("winner_team", "is", null),
    supabase.from("profiles").select("id, name, avatar_url"),
  ]);

  const matches  = matchesRes.data ?? [];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Build unique pair stats
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const pairStats: Record<string, { ids: [string, string]; wins: number; total: number }> = {};

  for (const m of matches) {
    const sides = [
      { ids: m.team_a as string[], won: m.winner_team === "a" },
      { ids: m.team_b as string[], won: m.winner_team === "b" },
    ];
    for (const { ids, won } of sides) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = pairKey(ids[i], ids[j]);
          if (!pairStats[key]) pairStats[key] = { ids: [ids[i], ids[j]], wins: 0, total: 0 };
          pairStats[key].total++;
          if (won) pairStats[key].wins++;
        }
      }
    }
  }

  const pairs = Object.values(pairStats)
    .map((p) => ({
      ...p,
      profileA:  profileMap.get(p.ids[0]),
      profileB:  profileMap.get(p.ids[1]),
      losses:    p.total - p.wins,
      winRate:   p.total > 0 ? p.wins / p.total : 0,
    }))
    .filter((p) => p.profileA && p.profileB)
    .sort((a, b) => b.winRate - a.winRate);

  const topPair = pairs[0] ?? null;

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Partnerships</h1>
        <p className="text-slate-500 text-sm mt-1">{pairs.length} pairs have played together</p>
      </div>

      {/* Top pair spotlight */}
      {topPair && (
        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 to-blue-600/5" />
          <div className="absolute inset-0 border border-cyan-500/15 rounded-2xl" />
          <div className="relative">
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">Top Pair</p>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                <Avatar name={topPair.profileA!.name} avatarUrl={topPair.profileA!.avatar_url} size="lg" className="ring-2 ring-[#05050A]" />
                <Avatar name={topPair.profileB!.name} avatarUrl={topPair.profileB!.avatar_url} size="lg" className="ring-2 ring-[#05050A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">
                  {topPair.profileA!.name.split(" ")[0]} &amp; {topPair.profileB!.name.split(" ")[0]}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {topPair.total} matches · {topPair.wins}W {topPair.losses}L
                </p>
              </div>
              <span className="text-lg font-black gradient-text shrink-0">{formatWinRate(topPair.wins, topPair.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Full pairs table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_2.5rem_2.5rem_2.5rem_3rem] gap-2 px-4 py-2.5 border-b border-white/10">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Pair</span>
          <span className="text-[10px] font-bold text-slate-600 text-center uppercase">P</span>
          <span className="text-[10px] font-bold text-slate-600 text-center uppercase">W</span>
          <span className="text-[10px] font-bold text-slate-600 text-center uppercase">L</span>
          <span className="text-[10px] font-bold text-slate-600 text-right uppercase">Win%</span>
        </div>

        {pairs.length === 0 && (
          <p className="text-center text-slate-600 text-sm py-12">No partnerships recorded yet.</p>
        )}

        {pairs.map((pair, i) => (
          <div key={i} className="grid grid-cols-[1fr_2.5rem_2.5rem_2.5rem_3rem] gap-2 items-center px-4 py-3 border-b border-white/[0.04] last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex -space-x-2.5 shrink-0">
                <Avatar name={pair.profileA!.name} avatarUrl={pair.profileA!.avatar_url} size="sm" className="ring-1 ring-[#05050A]" />
                <Avatar name={pair.profileB!.name} avatarUrl={pair.profileB!.avatar_url} size="sm" className="ring-1 ring-[#05050A]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {pair.profileA!.name.split(" ")[0]} &amp; {pair.profileB!.name.split(" ")[0]}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 text-center tabular-nums">{pair.total}</span>
            <span className="text-xs font-bold text-emerald-400 text-center tabular-nums">{pair.wins}</span>
            <span className="text-xs font-bold text-red-400/80 text-center tabular-nums">{pair.losses}</span>
            <span className="text-xs font-bold gradient-text text-right tabular-nums">{formatWinRate(pair.wins, pair.total)}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
