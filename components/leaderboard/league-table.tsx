import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { cn, formatWinRate } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeagueTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[2rem_1fr_2.2rem_2.2rem_2.2rem_3rem_3rem_1rem] gap-x-1 px-3 py-2.5 border-b border-white/10">
        <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-wide">#</span>
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Player</span>
        <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-wide">P</span>
        <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-wide">W</span>
        <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-wide">L</span>
        <span className="text-[10px] font-bold text-slate-600 text-right uppercase tracking-wide">ELO</span>
        <span className="text-[10px] font-bold text-slate-600 text-right uppercase tracking-wide">Pts</span>
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
              "grid grid-cols-[2rem_1fr_2.2rem_2.2rem_2.2rem_3rem_3rem_1rem] gap-x-1 items-center px-3 py-3 border-b border-white/[0.04] last:border-0 active:bg-white/[0.04] transition-colors",
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
            <div className="flex items-center gap-2 min-w-0">
              <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="sm" />
              <span className="text-sm font-semibold text-cyan-400 underline underline-offset-2 decoration-cyan-400/30 truncate">
                {profile.name}
              </span>
            </div>

            {/* P */}
            <span className="text-xs text-slate-400 text-center tabular-nums">{matchesPlayed}</span>

            {/* W */}
            <span className="text-xs font-bold text-emerald-400 text-center tabular-nums">{matchWins}</span>

            {/* L */}
            <span className="text-xs font-bold text-red-400/80 text-center tabular-nums">{losses}</span>

            {/* ELO */}
            <span className="text-xs font-bold text-cyan-400 text-right tabular-nums">{profile.elo_rating}</span>

            {/* Pts */}
            <span className="text-xs font-black gradient-text text-right tabular-nums">{profile.total_points}</span>

            {/* Chevron */}
            <ChevronRight size={13} className="text-slate-600 justify-self-end" />
          </Link>
        );
      })}
    </div>
  );
}
