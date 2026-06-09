"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { formatWinRate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

export interface PairRow {
  ids: [string, string];
  profileA: Profile;
  profileB: Profile;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

interface Props {
  pairs: PairRow[];
  players: Profile[];
}

export function PairsClient({ pairs, players }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedPlayer = players.find((p) => p.id === selectedId) ?? null;

  const filtered = selectedId
    ? pairs.filter((p) => p.ids[0] === selectedId || p.ids[1] === selectedId)
    : pairs;

  const topPair = filtered[0] ?? null;

  return (
    <div className="space-y-5">

      {/* Filter dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all",
            selectedId
              ? "bg-cyan-500/10 border-cyan-500/30 text-white"
              : "bg-white/[0.04] border-white/10 text-slate-400"
          )}
        >
          {selectedPlayer ? (
            <>
              <Avatar name={selectedPlayer.name} avatarUrl={selectedPlayer.avatar_url} size="sm" />
              <span>{selectedPlayer.name.split(" ")[0]}</span>
            </>
          ) : (
            <span>All Players</span>
          )}
          <ChevronDown size={15} className={cn("ml-auto text-cyan-400 transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />

            {/* Menu */}
            <div className="absolute left-0 right-0 top-full mt-1.5 z-20 glass-card rounded-xl border border-white/10 overflow-hidden shadow-xl">
              {/* All Players option */}
              <button
                onClick={() => { setSelectedId(null); setDropdownOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors",
                  !selectedId ? "text-cyan-400 bg-cyan-500/10" : "text-slate-300 hover:bg-white/5"
                )}
              >
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                  ✦
                </span>
                <span className="flex-1 font-medium">All Players</span>
                {!selectedId && <Check size={13} className="text-cyan-400" />}
              </button>

              <div className="border-t border-white/[0.06]" />

              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setDropdownOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors",
                    selectedId === p.id ? "text-cyan-400 bg-cyan-500/10" : "text-slate-300 hover:bg-white/5"
                  )}
                >
                  <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" className="shrink-0" />
                  <span className="flex-1 font-medium truncate">{p.name.split(" ")[0]}</span>
                  {selectedId === p.id && <Check size={13} className="text-cyan-400" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pair count */}
      <p className="text-slate-500 text-sm -mt-1">
        {filtered.length} pair{filtered.length !== 1 ? "s" : ""}
        {selectedPlayer ? ` featuring ${selectedPlayer.name.split(" ")[0]}` : " have played together"}
      </p>

      {/* Top pair spotlight */}
      {topPair && (
        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 to-blue-600/5" />
          <div className="absolute inset-0 border border-cyan-500/15 rounded-2xl" />
          <div className="relative">
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">Top Pair</p>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                <Avatar name={topPair.profileA.name} avatarUrl={topPair.profileA.avatar_url} size="lg" className="ring-2 ring-[#05050A]" />
                <Avatar name={topPair.profileB.name} avatarUrl={topPair.profileB.avatar_url} size="lg" className="ring-2 ring-[#05050A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">
                  {topPair.profileA.name.split(" ")[0]} &amp; {topPair.profileB.name.split(" ")[0]}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {topPair.total} matches · {topPair.wins}W {topPair.losses}L
                </p>
              </div>
              <span className="text-lg font-black gradient-text shrink-0">
                {formatWinRate(topPair.wins, topPair.total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Full pairs table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_2.5rem_2.5rem_2.5rem_3rem] gap-2 px-4 py-2.5 border-b border-white/10">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Pair</span>
          <span className="text-[10px] font-bold text-slate-600 text-center uppercase">P</span>
          <span className="text-[10px] font-bold text-slate-600 text-center uppercase">W</span>
          <span className="text-[10px] font-bold text-slate-600 text-center uppercase">L</span>
          <span className="text-[10px] font-bold text-slate-600 text-right uppercase">Win%</span>
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-slate-600 text-sm py-12">No partnerships recorded yet.</p>
        )}

        {filtered.map((pair, i) => (
          <div
            key={i}
            className={cn(
              "grid grid-cols-[1fr_2.5rem_2.5rem_2.5rem_3rem] gap-2 items-center px-4 py-3 border-b border-white/[0.04] last:border-0",
              selectedId && (pair.ids[0] === selectedId || pair.ids[1] === selectedId)
                ? "bg-cyan-500/[0.04]"
                : ""
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex -space-x-2.5 shrink-0">
                <Avatar name={pair.profileA.name} avatarUrl={pair.profileA.avatar_url} size="sm" className="ring-1 ring-[#05050A]" />
                <Avatar name={pair.profileB.name} avatarUrl={pair.profileB.avatar_url} size="sm" className="ring-1 ring-[#05050A]" />
              </div>
              <p className="text-xs font-semibold text-white truncate">
                {pair.profileA.name.split(" ")[0]} &amp; {pair.profileB.name.split(" ")[0]}
              </p>
            </div>
            <span className="text-xs text-slate-400 text-center tabular-nums">{pair.total}</span>
            <span className="text-xs font-bold text-emerald-400 text-center tabular-nums">{pair.wins}</span>
            <span className="text-xs font-bold text-red-400/80 text-center tabular-nums">{pair.losses}</span>
            <span className="text-xs font-bold gradient-text text-right tabular-nums">
              {formatWinRate(pair.wins, pair.total)}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
