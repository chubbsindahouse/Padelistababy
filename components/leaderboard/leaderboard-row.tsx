import Link from "next/link";
import { Avatar } from "@/components/profile/avatar";
import { cn, formatWinRate } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardRow({ entry, highlight }: { entry: LeaderboardEntry; highlight?: boolean }) {
  const { rank, profile, matchWins, matchesPlayed } = entry;

  return (
    <Link
      href={`/profile/${profile.id}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05] last:border-0 active:bg-white/[0.04] transition-colors",
        highlight && "bg-cyan-500/5"
      )}
    >
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        {rank <= 3 ? (
          <span className="text-xl">{RANK_ICONS[rank]}</span>
        ) : (
          <span className={cn("text-sm font-bold", highlight ? "text-cyan-400" : "text-slate-500")}>
            {rank}
          </span>
        )}
      </div>

      <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="md" />

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold truncate", highlight ? "text-cyan-400" : "text-white")}>
          {profile.name}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {matchWins}W · {matchesPlayed - matchWins}L · {formatWinRate(matchWins, matchesPlayed)}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-heading font-black gradient-text">{profile.total_points}</p>
        <p className="text-[10px] text-slate-600">pts · {profile.elo_rating} ELO</p>
      </div>
    </Link>
  );
}
