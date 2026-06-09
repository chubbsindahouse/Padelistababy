"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { LeagueTable } from "@/components/leaderboard/league-table";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

type SortMode = "points" | "elo";

interface Props {
  entries: LeaderboardEntry[]; // pre-sorted by points from the server
}

export function LeaderboardClient({ entries }: Props) {
  const [mode, setMode] = useState<SortMode>("points");

  const sorted = [...entries]
    .sort((a, b) =>
      mode === "points"
        ? b.profile.total_points - a.profile.total_points
        : b.profile.elo_rating - a.profile.elo_rating
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const [first, second, third] = sorted;

  const podiumStat = (e: LeaderboardEntry) =>
    mode === "points"
      ? `${e.profile.total_points}pts`
      : `${e.profile.elo_rating} ELO`;

  return (
    <div className="pt-8 pb-4">
      {/* Header */}
      <div className="px-4 mb-6 flex items-center justify-between">
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

      {/* Podium */}
      {sorted.length >= 3 && (
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
        <LeagueTable entries={sorted} highlightCol={mode} />
      </div>
    </div>
  );
}
