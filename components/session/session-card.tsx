import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { formatRelativeDate } from "@/lib/utils";
import type { SessionWithPlayers } from "@/types";

export function SessionCard({ session }: { session: SessionWithPlayers }) {
  const { id, date, format, winner_stays_on, players, matches } = session;
  const matchCount = matches?.length ?? 0;

  return (
    <Link
      href={`/sessions/${id}`}
      className="glass-card rounded-2xl p-4 flex items-center gap-4 active:bg-white/[0.06] transition-colors"
    >
      {/* Date badge */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-600/10 border border-cyan-500/20 flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-cyan-400 uppercase">
          {new Date(date).toLocaleString("en", { month: "short" })}
        </span>
        <span className="text-lg font-heading font-black text-white leading-none">
          {new Date(date).getDate()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{formatRelativeDate(date)}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {format.toUpperCase()} · {matchCount} match{matchCount !== 1 ? "es" : ""}
          {winner_stays_on ? " · WSO" : ""}
        </p>
        <div className="flex -space-x-1.5 mt-2">
          {players.slice(0, 6).map((p) => (
            <Avatar key={p.id} name={p.name} avatarUrl={p.avatar_url} size="sm"
              className="ring-2 ring-[#0D0D18]" />
          ))}
          {players.length > 6 && (
            <div className="w-8 h-8 rounded-full bg-white/10 ring-2 ring-[#0D0D18] flex items-center justify-center text-[10px] font-bold text-slate-400">
              +{players.length - 6}
            </div>
          )}
        </div>
      </div>

      <ChevronRight size={16} className="text-slate-600 shrink-0" />
    </Link>
  );
}
