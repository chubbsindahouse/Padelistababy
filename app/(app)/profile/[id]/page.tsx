import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/profile/avatar";
import { BadgeCard } from "@/components/achievements/badge-card";
import { EloChart, type EloDataPoint } from "@/components/profile/elo-chart";
import { BADGE_CATALOGUE, formatWinRate } from "@/lib/utils";
import type { Profile, Achievement } from "@/types";

export const revalidate = 0;

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [profileRes, matchesRes, achievementsRes, eloRes, allProfilesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single<Profile>(),
    supabase.from("matches").select("id, team_a, team_b, winner_team")
      .or(`team_a.cs.{${id}},team_b.cs.{${id}}`).not("winner_team", "is", null),
    supabase.from("achievements").select("*").eq("player_id", id),
    supabase.from("elo_history").select("rating_before, rating_after, delta, sessions(date)")
      .eq("player_id", id),
    supabase.from("profiles").select("id, name, avatar_url"),
  ]);

  const profile = profileRes.data;
  if (!profile) redirect("/leaderboard");

  const matches    = matchesRes.data ?? [];
  const achList    = (achievementsRes.data ?? []) as Achievement[];
  const unlockedKeys = new Set(achList.map((a) => a.badge_key));

  // ELO chart — Supabase join returns sessions as an array
  const eloRaw = (eloRes.data ?? []) as unknown as {
    rating_before: number; rating_after: number; delta: number;
    sessions: { date: string }[] | null;
  }[];
  const eloData: EloDataPoint[] = eloRaw
    .sort((a, b) => {
      const da = a.sessions?.[0]?.date ?? "";
      const db = b.sessions?.[0]?.date ?? "";
      return new Date(da).getTime() - new Date(db).getTime();
    })
    .map((e, i) => ({ session: i + 1, elo: e.rating_after, delta: e.delta }));
  const startElo = eloData[0]?.elo ?? profile.elo_rating;

  // Win / loss counts
  const wins = matches.filter((m) => {
    const inA = m.team_a.includes(id);
    return (inA && m.winner_team === "a") || (!inA && m.winner_team === "b");
  }).length;

  // Partnership stats
  const allProfiles = (allProfilesRes.data ?? []) as Profile[];
  const profileMap  = new Map(allProfiles.map((p) => [p.id, p]));

  const partnerMap: Record<string, { wins: number; total: number }> = {};
  for (const m of matches) {
    const inA    = m.team_a.includes(id);
    const myTeam = inA ? m.team_a : m.team_b;
    const won    = (inA && m.winner_team === "a") || (!inA && m.winner_team === "b");
    for (const partnerId of (myTeam as string[]).filter((pid) => pid !== id)) {
      if (!partnerMap[partnerId]) partnerMap[partnerId] = { wins: 0, total: 0 };
      partnerMap[partnerId].total++;
      if (won) partnerMap[partnerId].wins++;
    }
  }

  const partnerList = Object.entries(partnerMap)
    .map(([pid, s]) => ({
      profile:  profileMap.get(pid) as Profile | undefined,
      wins:     s.wins,
      total:    s.total,
      losses:   s.total - s.wins,
      winRate:  s.total > 0 ? s.wins / s.total : 0,
    }))
    .filter((p) => p.profile)
    .sort((a, b) => b.total - a.total);

  const qualified    = partnerList.filter((p) => p.total >= 2);
  const bestPartner  = qualified.length > 0 ? [...qualified].sort((a, b) => b.winRate - a.winRate)[0] : null;
  const worstPartner = qualified.length > 1 ? [...qualified].sort((a, b) => a.winRate - b.winRate)[0] : null;

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">

      {/* Hero */}
      <div className="glass-card rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/15 blur-xl" />
            <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="xl" className="relative" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-black text-white">{profile.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold">
                {profile.elo_rating} ELO
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                {profile.total_points} pts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Matches",  value: matches.length },
          { label: "Wins",     value: wins },
          { label: "Win Rate", value: formatWinRate(wins, matches.length) },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card rounded-2xl p-4 text-center">
            <p className="text-xl font-heading font-black gradient-text">{value}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ELO history chart */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">ELO History</p>
          <span className="text-xs text-slate-500">{eloData.length} matches</span>
        </div>
        <EloChart data={eloData} startElo={startElo} />
      </div>

      {/* Best / worst partner */}
      {(bestPartner || worstPartner) && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Partner Highlights</p>
          <div className="grid grid-cols-2 gap-3">
            {bestPartner && (
              <Link href={`/profile/${bestPartner.profile!.id}`}
                className="glass-card rounded-2xl p-3.5 flex flex-col gap-2 active:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Best Partner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={bestPartner.profile!.name} avatarUrl={bestPartner.profile!.avatar_url} size="sm" />
                  <span className="text-sm font-bold text-white truncate">{bestPartner.profile!.name.split(" ")[0]}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {bestPartner.wins}W {bestPartner.losses}L
                  {" · "}
                  <span className="text-emerald-400 font-bold">{formatWinRate(bestPartner.wins, bestPartner.total)}</span>
                </p>
              </Link>
            )}
            {worstPartner && worstPartner.profile!.id !== bestPartner?.profile!.id && (
              <Link href={`/profile/${worstPartner.profile!.id}`}
                className="glass-card rounded-2xl p-3.5 flex flex-col gap-2 active:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={13} className="text-red-400 shrink-0" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Tough Pair</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={worstPartner.profile!.name} avatarUrl={worstPartner.profile!.avatar_url} size="sm" />
                  <span className="text-sm font-bold text-white truncate">{worstPartner.profile!.name.split(" ")[0]}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {worstPartner.wins}W {worstPartner.losses}L
                  {" · "}
                  <span className="text-red-400 font-bold">{formatWinRate(worstPartner.wins, worstPartner.total)}</span>
                </p>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* All partnerships */}
      {partnerList.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">All Partnerships</p>
            <span className="text-xs text-slate-600">{partnerList.length} partners</span>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_2.5rem_2.5rem_3rem] gap-2 px-4 py-2.5 border-b border-white/10">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Partner</span>
              <span className="text-[10px] font-bold text-slate-600 text-center uppercase">P</span>
              <span className="text-[10px] font-bold text-slate-600 text-center uppercase">W</span>
              <span className="text-[10px] font-bold text-slate-600 text-right uppercase">Win%</span>
            </div>
            {partnerList.map(({ profile: p, wins: w, total }) => (
              <Link key={p!.id} href={`/profile/${p!.id}`}
                className="grid grid-cols-[1fr_2.5rem_2.5rem_3rem] gap-2 items-center px-4 py-3 border-b border-white/[0.04] last:border-0 active:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={p!.name} avatarUrl={p!.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-white truncate">{p!.name}</span>
                </div>
                <span className="text-xs text-slate-400 text-center tabular-nums">{total}</span>
                <span className="text-xs font-bold text-emerald-400 text-center tabular-nums">{w}</span>
                <span className="text-xs font-bold gradient-text text-right tabular-nums">{formatWinRate(w, total)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Badges</p>
          <p className="text-xs text-slate-600">{unlockedKeys.size} / {BADGE_CATALOGUE.length}</p>
        </div>
        <div className="space-y-2">
          {BADGE_CATALOGUE.map((badge) => {
            const ach = achList.find((a) => a.badge_key === badge.key);
            return <BadgeCard key={badge.key} badge={badge} unlockedAt={ach?.unlocked_at ?? null} />;
          })}
        </div>
      </div>

    </div>
  );
}
