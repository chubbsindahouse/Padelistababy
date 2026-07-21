"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ChevronDown, Check, Trophy, Layers } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { LeagueTable } from "@/components/leaderboard/league-table";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry, Season } from "@/types";

type SortMode = "points" | "elo";
type SeasonKey = string | "all"; // season id or "all"

interface PastEntry {
  player_id: string;
  final_elo: number;
  final_points: number;
  final_rank: number;
  match_wins: number;
  match_losses: number;
  profiles: { id: string; name: string; avatar_url: string | null };
}

interface Props {
  entries: LeaderboardEntry[];
  seasons: Season[];
  activeSeason: Season | null;
}

function sortEntries(list: LeaderboardEntry[], mode: SortMode): LeaderboardEntry[] {
  return [...list]
    .sort((a, b) => {
      if (mode === "points") {
        if (b.profile.total_points !== a.profile.total_points)
          return b.profile.total_points - a.profile.total_points;
        return b.profile.elo_rating - a.profile.elo_rating;   // higher ELO wins tie
      } else {
        if (b.profile.elo_rating !== a.profile.elo_rating)
          return b.profile.elo_rating - a.profile.elo_rating;
        return b.profile.total_points - a.profile.total_points; // higher pts wins tie
      }
    })
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function LeaderboardClient({ entries, seasons, activeSeason }: Props) {
  const [mode, setMode]             = useState<SortMode>("points");
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<SeasonKey>(activeSeason?.id ?? "all");
  const [pastEntries, setPastEntries]   = useState<LeaderboardEntry[] | null>(null);
  const [loadingPast, setLoadingPast]   = useState(false);

  const isActiveSeason = selectedKey === (activeSeason?.id ?? "");
  const isAll          = selectedKey === "all";

  const selectedSeason = seasons.find((s) => s.id === selectedKey) ?? null;

  async function switchSeason(key: SeasonKey) {
    setSeasonOpen(false);
    setSelectedKey(key);
    const isActive = key === activeSeason?.id;
    if (isActive) { setPastEntries(null); return; }
    setLoadingPast(true);
    try {
      const res  = await fetch(`/api/leaderboard?season_id=${key}`);
      const data = await res.json() as PastEntry[];
      const mapped: LeaderboardEntry[] = data.map((s) => ({
        rank:          s.final_rank,
        profile: {
          id: s.profiles.id, name: s.profiles.name, avatar_url: s.profiles.avatar_url,
          elo_rating: s.final_elo, total_points: s.final_points,
          created_at: "", updated_at: "",
        },
        matchWins:     s.match_wins,
        matchesPlayed: s.match_wins + s.match_losses,
        winRate: (s.match_wins + s.match_losses) > 0
          ? s.match_wins / (s.match_wins + s.match_losses) : 0,
      }));
      setPastEntries(mapped);
    } catch {
      /* fall back silently */
    } finally {
      setLoadingPast(false);
    }
  }

  const displayEntries = isActiveSeason
    ? sortEntries(entries, mode)
    : sortEntries(pastEntries ?? [], mode);

  const [first, second, third] = displayEntries;

  const podiumStat = (e: LeaderboardEntry) =>
    mode === "points" ? `${e.profile.total_points}pts` : `${e.profile.elo_rating} ELO`;

  const dropdownLabel = isAll
    ? "All Seasons"
    : isActiveSeason
    ? (selectedSeason?.name ?? "Current Season")
    : (selectedSeason?.name ?? "Past Season");

  return (
    <div className="pt-8 pb-4">
      {/* Header */}
      <div className="px-4 mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Leaderboard</h1>
          <p className="text-slate-500 text-sm mt-1">{entries.length} players competing</p>
        </div>
        <Link
          href="/pairs"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-400 active:bg-white/10 transition-colors"
        >
          <Users size={13} />
          Pairs
        </Link>
      </div>

      {/* Season switcher — always visible */}
      <div className="px-4 mb-4 relative">
        <button
          onClick={() => setSeasonOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all",
            isAll
              ? "bg-violet-500/10 border-violet-500/30 text-white"
              : !isActiveSeason
              ? "bg-amber-500/10 border-amber-500/30 text-white"
              : "bg-white/[0.04] border-white/10 text-slate-300"
          )}
        >
          {isAll
            ? <Layers size={14} className="text-violet-400" />
            : <Trophy size={14} className={isActiveSeason ? "text-cyan-400" : "text-amber-400"} />}
          <span className="flex-1 text-left">{dropdownLabel}</span>
          {isAll && (
            <span className="px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-400 text-[10px] font-bold">ALL TIME</span>
          )}
          {!isAll && !isActiveSeason && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold">HISTORY</span>
          )}
          {isActiveSeason && (
            <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">LIVE</span>
          )}
          <ChevronDown size={14} className={cn("text-slate-400 transition-transform", seasonOpen && "rotate-180")} />
        </button>

        {seasonOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setSeasonOpen(false)} />
            <div className="absolute left-4 right-4 top-full mt-1.5 z-20 glass-card rounded-xl border border-white/10 overflow-hidden shadow-xl">
              {/* Individual seasons — sorted newest first */}
              {seasons.map((s) => (
                <button
                  key={s.id}
                  onClick={() => switchSeason(s.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors border-b border-white/[0.06]",
                    selectedKey === s.id
                      ? "text-cyan-400 bg-cyan-500/10"
                      : "text-slate-300 hover:bg-white/5"
                  )}
                >
                  <span className="flex-1 font-semibold">{s.name}</span>
                  {s.is_active && (
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded-md">LIVE</span>
                  )}
                  {!s.is_active && s.ended_at && (
                    <span className="text-[10px] text-slate-600">
                      {new Date(s.ended_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </span>
                  )}
                  {selectedKey === s.id && <Check size={13} className="text-cyan-400 shrink-0" />}
                </button>
              ))}
              {/* All Seasons */}
              <button
                onClick={() => switchSeason("all")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors",
                  isAll ? "text-violet-400 bg-violet-500/10" : "text-slate-300 hover:bg-white/5"
                )}
              >
                <Layers size={13} className={isAll ? "text-violet-400" : "text-slate-500"} />
                <span className="flex-1 font-semibold">All Seasons</span>
                <span className="text-[10px] text-slate-600">Combined</span>
                {isAll && <Check size={13} className="text-violet-400 shrink-0" />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sort toggle */}
      <div className="px-4 mb-5">
        <div className="flex bg-white/5 rounded-xl p-1">
          {(["points", "elo"] as SortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                mode === m
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-sm"
                  : "text-slate-400"
              )}
            >
              {m === "points" ? "Total Points" : "ELO Rating"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loadingPast && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        </div>
      )}

      {!loadingPast && (
        <>
          {/* Podium */}
          {displayEntries.length >= 3 && (
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
                    <p className="text-xs text-slate-500">{podiumStat(second)}</p>
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
                    <p className="text-xs gradient-text font-bold">{podiumStat(first)}</p>
                    <div className="mt-2 w-16 h-20 glass rounded-t-xl flex items-end justify-center pb-2 border-b-0 bg-cyan-500/10">
                      <span className="text-2xl">🥇</span>
                    </div>
                  </div>
                  {/* 3rd */}
                  <div className="flex flex-col items-center">
                    <Avatar name={third.profile.name} avatarUrl={third.profile.avatar_url} size="md" className="ring-2 ring-amber-700/30 mb-2" />
                    <p className="text-xs font-bold text-slate-300 truncate max-w-[60px] text-center">{third.profile.name.split(" ")[0]}</p>
                    <p className="text-xs text-slate-500">{podiumStat(third)}</p>
                    <div className="mt-2 w-16 h-10 glass rounded-t-xl flex items-end justify-center pb-2 border-b-0">
                      <span className="text-2xl">🥉</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* League table */}
          <div className="mx-4">
            <LeagueTable entries={displayEntries} highlightCol={mode} />
          </div>
        </>
      )}
    </div>
  );
}
