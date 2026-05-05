"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Users, Shuffle, Trophy, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";
import type { Profile, NewSessionState } from "@/types";

const STEPS = ["Players", "Teaming", "Format", "Options"] as const;

export default function NewSessionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [allPlayers, setAllPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<NewSessionState>({
    step: 1, players: [], teamingMethod: "manual",
    format: "bo3", winnerStaysOn: false, threeWinRule: false,
  });

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("profiles").select("*").order("name");
      setAllPlayers((data ?? []) as Profile[]);
    }
    load();
  }, []);

  function togglePlayer(id: string) {
    setState((s) => ({
      ...s,
      players: s.players.includes(id) ? s.players.filter((p) => p !== id) : [...s.players, id],
    }));
  }

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: state.format,
          winner_stays_on: state.winnerStaysOn,
          three_win_rule: state.threeWinRule,
          players: state.players,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error ?? "Failed to create session");
      }
      const { id } = await res.json();
      sessionStorage.setItem(`session_${id}_teaming`, state.teamingMethod);
      router.push(`/sessions/${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create session.");
    } finally {
      setLoading(false);
    }
  }

  const canProceed = state.step === 1 ? state.players.length >= 4 : true;

  const goBack = () => {
    if (state.step > 1) setState((s) => ({ ...s, step: (s.step - 1) as NewSessionState["step"] }));
    else router.back();
  };

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <button onClick={goBack}
            className="p-2 -ml-2 rounded-xl text-slate-400 active:bg-white/5 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">New Session</h1>
            <p className="text-xs text-slate-500">Step {state.step} of 4 — {STEPS[state.step - 1]}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={cn(
              "flex-1 h-1 rounded-full transition-all duration-300",
              i < state.step ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-white/10"
            )} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 px-4 py-2 overflow-y-auto space-y-3">

        {/* Step 1: Players */}
        {state.step === 1 && (
          <>
            <p className="text-slate-500 text-sm mb-4">
              Select who's playing.
              <span className="text-cyan-400 font-semibold"> {state.players.length} selected</span>
              {" "}(min 4)
            </p>
            {allPlayers.map((p) => {
              const selected = state.players.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlayer(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-2xl border transition-all",
                    selected
                      ? "bg-cyan-500/10 border-cyan-500/30"
                      : "bg-white/[0.03] border-white/[0.06] active:bg-white/[0.06]"
                  )}>
                  <Avatar name={p.name} avatarUrl={p.avatar_url} size="md" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.elo_rating} ELO</p>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    selected ? "bg-gradient-to-br from-cyan-500 to-blue-600 border-transparent" : "border-white/20"
                  )}>
                    {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* Step 2: Teaming */}
        {state.step === 2 && (
          <>
            <p className="text-slate-500 text-sm mb-4">How do you want to pick teams?</p>

            {/* Manual — selectable */}
            <button
              onClick={() => setState((s) => ({ ...s, teamingMethod: "manual" }))}
              className={cn(
                "w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all",
                state.teamingMethod === "manual"
                  ? "bg-cyan-500/10 border-cyan-500/30"
                  : "bg-white/[0.03] border-white/[0.06]"
              )}>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                state.teamingMethod === "manual"
                  ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-glow-sm"
                  : "bg-white/5 text-slate-500"
              )}>
                <Users size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Manual</p>
                <p className="text-xs text-slate-500 mt-0.5">You decide the teams yourself each match.</p>
              </div>
              {state.teamingMethod === "manual" && (
                <Check size={16} className="text-cyan-400 shrink-0" />
              )}
            </button>

            {/* Auto — disabled with Coming Soon badge */}
            <div className="relative w-full flex items-center gap-4 p-5 rounded-2xl border text-left bg-white/[0.02] border-white/[0.04] opacity-60 cursor-not-allowed">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-slate-600">
                <Shuffle size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-400">Auto (ELO-balanced)</p>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">Algorithm creates the fairest matchups.</p>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Format */}
        {state.step === 3 && (
          <>
            <p className="text-slate-500 text-sm mb-4">How many games per match?</p>
            {[
              { value: "bo3", label: "Best of 3", desc: "First to win 2 games wins the match. Faster." },
              { value: "bo5", label: "Best of 5", desc: "First to win 3 games. Longer, more dramatic." },
            ].map(({ value, label, desc }) => (
              <button key={value}
                onClick={() => setState((s) => ({ ...s, format: value as "bo3" | "bo5" }))}
                className={cn(
                  "w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all",
                  state.format === value
                    ? "bg-cyan-500/10 border-cyan-500/30"
                    : "bg-white/[0.03] border-white/[0.06]"
                )}>
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  state.format === value
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-glow-sm"
                    : "bg-white/5 text-slate-500"
                )}>
                  <Trophy size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
                {state.format === value && <Check size={16} className="text-cyan-400 shrink-0" />}
              </button>
            ))}
          </>
        )}

        {/* Step 4: Options */}
        {state.step === 4 && (
          <>
            <p className="text-slate-500 text-sm mb-4">Configure session rules.</p>
            {[
              { key: "winnerStaysOn" as const, label: "Winner Stays On",
                desc: "Winning team stays. Losers rotate out.", disabled: false },
              { key: "threeWinRule" as const, label: "3-Win Rotation",
                desc: "After 3 consecutive wins, winners also rotate off.", disabled: !state.winnerStaysOn },
            ].map(({ key, label, desc, disabled }) => (
              <div key={key}
                className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all",
                  disabled ? "bg-white/[0.02] border-white/[0.04] opacity-40" : "bg-white/[0.03] border-white/[0.06]"
                )}>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
                <button disabled={disabled}
                  onClick={() => setState((s) => ({ ...s, [key]: !s[key] }))}
                  className={cn(
                    "w-14 h-7 rounded-full transition-all duration-200 relative shrink-0",
                    state[key]
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                      : "bg-white/[0.08] border border-white/[0.12]"
                  )}>
                  <span className={cn(
                    "absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300",
                    state[key]
                      ? "translate-x-7 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
                      : "translate-x-0.5 bg-slate-300/80"
                  )} />
                </button>
              </div>
            ))}

            {/* Summary */}
            <div className="relative rounded-2xl overflow-hidden mt-2">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 to-blue-600/5" />
              <div className="absolute inset-0 border border-cyan-500/15 rounded-2xl" />
              <div className="relative p-4 space-y-2">
                <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Summary</p>
                <p className="text-sm text-slate-300">👥 {state.players.length} players · {state.teamingMethod === "manual" ? "Manual" : "Auto"} teams</p>
                <p className="text-sm text-slate-300">🏆 {state.format === "bo3" ? "Best of 3" : "Best of 5"}{state.winnerStaysOn ? " · Winner Stays On" : ""}{state.threeWinRule ? " · 3-Win Rule" : ""}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CTA */}
      <div className="relative z-10 px-4 py-4 pb-safe">
        <button
          disabled={!canProceed || loading}
          onClick={() => {
            if (state.step < 4) setState((s) => ({ ...s, step: (s.step + 1) as NewSessionState["step"] }));
            else handleStart();
          }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-glow-cyan disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : state.step < 4 ? (
            <> Continue <ArrowRight size={16} /></>
          ) : (
            <> Start Session 🎾</>
          )}
        </button>
        {state.step === 1 && state.players.length < 4 && (
          <p className="text-center text-xs text-slate-600 mt-2">
            Need {4 - state.players.length} more player{4 - state.players.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
