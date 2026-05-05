import { cn, formatDate } from "@/lib/utils";
import type { BadgeMeta } from "@/types";

export function BadgeCard({ badge, unlockedAt }: { badge: BadgeMeta; unlockedAt?: string | null }) {
  const unlocked = !!unlockedAt;

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-2xl border transition-all",
      unlocked
        ? "glass-card border-cyan-500/20 shadow-glow-sm"
        : "bg-white/[0.02] border-white/[0.04] opacity-50"
    )}>
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
        unlocked
          ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/20"
          : "bg-white/5 border border-white/5"
      )}>
        {unlocked ? badge.icon : "🔒"}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold", unlocked ? "text-white" : "text-slate-500")}>
          {badge.name}
        </p>
        <p className="text-xs text-slate-500 leading-snug mt-0.5">{badge.description}</p>
        {unlocked && unlockedAt && (
          <p className="text-[10px] text-cyan-400 mt-1 font-semibold">
            ✦ Unlocked {formatDate(unlockedAt)}
          </p>
        )}
      </div>
    </div>
  );
}
