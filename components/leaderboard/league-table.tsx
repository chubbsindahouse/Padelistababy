import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

interface Props {
  entries: LeaderboardEntry[];
  highlightCol?: "points" | "elo";
}

export function LeagueTable({ entries, highlightCol = "points" }: Props) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[2rem_1fr_2.2rem_2.2rem_2.5rem_2.5rem_1rem] gap-x-1 px-3 py-2.5 border-b border-white/10">
        <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-wide">#</span>
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Player</span>
        <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-wide">W</span>
        <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-wide">L</span>
        <span className={cn(
          "text-[10px] font-bold text-right uppercase tracking-wide",
          highlightCol === "elo" ? "text-cyan-400" : "text-slate-600"
        )}>ELO</span>
        <span className={cn(
          "text-[10px] font-bold text-right uppercase tracking-wide",
          highlightCol === "points" ? "text-cyan-400" : "text-slate-600"
        )}>Pts</span>
        <span />
      </div>

      {entries.length === 0 && (
        <p className="text-center text-slate-600 text-sm py-12">No players yet.</p>
      )}

      {entries.map((entry) => {
        const { rank, profile, matchWins, matchesPlayed } = entry;
        const losses = matchesPlayed - matchWins;
        const isTop3 = rank <= 3;

        return (
          <Link
            key={profile.id}
            href={`/profile/${profile.id}`}
            className={cn(
              "grid grid-cols-[2rem_1fr_2.2rem_2.2rem_2.5rem_2.5rem_1rem] gap-x-1 items-center px-3 py-3 border-b border-white/[0.04] last:border-0 active:bg-white/[0.04] transition-colors",
              isTop3 && "bg-white/[0.02]"
            )}
          >
            {/* Rank */}
            <div className="text-center shrink-0">
              {isTop3 ? (
                <span className="text-lg leading-none">{MEDALS[rank]}</span>
              ) : (
                <span className="text-xs font-bold text-slate-500">{rank}</span>
              )}
            </div>

            {/* Player */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="sm" />
              <span className="text-sm font-semibold text-cyan-400 underline underline-offset-2 decoration-cyan-400/30 break-words leading-tight">
                {profile.name}
              </span>
            </div>

            {/* W */}
            <span className="text-xs font-bold text-emerald-400 text-center tabular-nums">{matchWins}</span>

            {/* L */}
            <span className="text-xs font-bold text-red-400/80 text-center tabular-nums">{losses}</span>

            {/* ELO */}
            <span className={cn(
              "text-xs font-bold text-right tabular-nums",
              highlightCol === "elo" ? "text-cyan-400" : "text-slate-400"
            )}>{profile.elo_rating}</span>

            {/* Pts */}
            <span className={cn(
              "text-xs font-black text-right tabular-nums",
              highlightCol === "points" ? "gradient-text" : "text-slate-400"
            )}>{profile.total_points}</span>

            {/* Chevron */}
            <ChevronRight size={13} className="text-slate-600 justify-self-end" />
          </Link>
        );
      })}
    </div>
  );
}
