"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { BadgeCard } from "@/components/achievements/badge-card";
import { EloChart, type EloDataPoint } from "@/components/profile/elo-chart";
import { BADGE_CATALOGUE, formatWinRate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Achievement } from "@/types";

interface PartnerStat {
  profile: Profile;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

interface EloRaw {
  rating_after: number;
  delta: number;
  sessions: { date: string }[] | null;
}

interface Props {
  profileId: string;
  eloRating: number;
}

export function ProfileStats({ profileId, eloRating }: Props) {
  const [loading,       setLoading]       = useState(true);
  const [matchCount,    setMatchCount]    = useState(0);
  const [wins,          setWins]          = useState(0);
  const [eloData,       setEloData]       = useState<EloDataPoint[]>([]);
  const [startElo,      setStartElo]      = useState(eloRating);
  const [partnerList,   setPartnerList]   = useState<PartnerStat[]>([]);
  const [bestPartner,   setBestPartner]   = useState<PartnerStat | null>(null);
  const [worstPartner,  setWorstPartner]  = useState<PartnerStat | null>(null);
  const [achList,       setAchList]       = useState<Achievement[]>([]);
  const [unlockedKeys,  setUnlockedKeys]  = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = profileId;
    const supabase = createClient();

    Promise.all([
      supabase.from("matches").select("id, team_a, team_b, winner_team")
        .or(`team_a.cs.{${id}},team_b.cs.{${id}}`).not("winner_team", "is", null),
      supabase.from("achievements").select("*").eq("player_id", id),
      supabase.from("elo_history").select("rating_after, delta, sessions(date)").eq("player_id", id),
      supabase.from("profiles").select("id, name, avatar_url, elo_rating, total_points, created_at, updated_at"),
    ]).then(([matchesRes, achRes, eloRes, profilesRes]) => {
      const matches = matchesRes.data ?? [];
      const achs    = (achRes.data ?? []) as Achievement[];
      setAchList(achs);
      setUnlockedKeys(new Set(achs.map((a) => a.badge_key)));

      const w = matches.filter((m) => {
        const inA = (m.team_a as string[]).includes(id);
        return (inA && m.winner_team === "a") || (!inA && m.winner_team === "b");
      }).length;
      setMatchCount(matches.length);
      setWins(w);

      const eloRaw = (eloRes.data ?? []) as unknown as EloRaw[];
      const sorted: EloDataPoint[] = eloRaw
        .sort((a, b) => {
          const da = a.sessions?.[0]?.date ?? "";
          const db = b.sessions?.[0]?.date ?? "";
          return new Date(da).getTime() - new Date(db).getTime();
        })
        .map((e, i) => ({ session: i + 1, elo: e.rating_after, delta: e.delta }));
      setEloData(sorted);
      setStartElo(sorted[0]?.elo ?? eloRating);

      const allProfiles = (profilesRes.data ?? []) as Profile[];
      const profileMap  = new Map(allProfiles.map((p) => [p.id, p]));
      const partnerMap: Record<string, { wins: number; total: number }> = {};

      for (const m of matches) {
        const inA    = (m.team_a as string[]).includes(id);
        const myTeam = inA ? m.team_a : m.team_b;
        const won    = (inA && m.winner_team === "a") || (!inA && m.winner_team === "b");
        for (const pid of (myTeam as string[]).filter((x) => x !== id)) {
          if (!partnerMap[pid]) partnerMap[pid] = { wins: 0, total: 0 };
          partnerMap[pid].total++;
          if (won) partnerMap[pid].wins++;
        }
      }

      const list: PartnerStat[] = Object.entries(partnerMap)
        .map(([pid, s]) => ({
          profile:  profileMap.get(pid) as Profile,
          wins:     s.wins,
          losses:   s.total - s.wins,
          total:    s.total,
          winRate:  s.total > 0 ? s.wins / s.total : 0,
        }))
        .filter((p) => p.profile)
        .sort((a, b) => b.total - a.total);
      setPartnerList(list);

      const qualified = list.filter((p) => p.total >= 2);
      setBestPartner(qualified.length > 0
        ? [...qualified].sort((a, b) => b.winRate - a.winRate)[0]
        : null);
      setWorstPartner(qualified.length > 1
        ? [...qualified].sort((a, b) => a.winRate - b.winRate)[0]
        : null);
    }).finally(() => setLoading(false));
  }, [profileId, eloRating]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Matches",  value: matchCount },
          { label: "Wins",     value: wins },
          { label: "Win Rate", value: formatWinRate(wins, matchCount) },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card rounded-2xl p-4 text-center">
            <p className="text-xl font-heading font-black gradient-text">{value}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ELO chart */}
      {eloData.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">ELO History</p>
            <span className="text-xs text-slate-500">{eloData.length} matches</span>
          </div>
          <EloChart data={eloData} startElo={startElo} />
        </div>
      )}

      {/* Partner highlights */}
      {(bestPartner || worstPartner) && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Partner Highlights</p>
          <div className="grid grid-cols-2 gap-3">
            {bestPartner && (
              <Link href={`/profile/${bestPartner.profile.id}`}
                className="glass-card rounded-2xl p-3.5 flex flex-col gap-2 active:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Best Partner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={bestPartner.profile.name} avatarUrl={bestPartner.profile.avatar_url} size="sm" />
                  <span className="text-sm font-bold text-white truncate">{bestPartner.profile.name.split(" ")[0]}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {bestPartner.wins}W {bestPartner.losses}L
                  {" · "}
                  <span className="text-emerald-400 font-bold">{formatWinRate(bestPartner.wins, bestPartner.total)}</span>
                </p>
              </Link>
            )}
            {worstPartner && worstPartner.profile.id !== bestPartner?.profile.id && (
              <Link href={`/profile/${worstPartner.profile.id}`}
                className="glass-card rounded-2xl p-3.5 flex flex-col gap-2 active:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={13} className="text-red-400 shrink-0" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Tough Pair</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={worstPartner.profile.name} avatarUrl={worstPartner.profile.avatar_url} size="sm" />
                  <span className="text-sm font-bold text-white truncate">{worstPartner.profile.name.split(" ")[0]}</span>
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
              <Link key={p.id} href={`/profile/${p.id}`}
                className="grid grid-cols-[1fr_2.5rem_2.5rem_3rem] gap-2 items-center px-4 py-3 border-b border-white/[0.04] last:border-0 active:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
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
