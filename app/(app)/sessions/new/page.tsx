"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check, ChevronLeft, Users, Shuffle, Trophy, ArrowRight,
  Zap, CalendarDays, RotateCcw, Minus, Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import { generateAmericanoFixtures, type Fixture } from "@/lib/round-robin";

type SessionMode = "live" | "round_robin";

interface WizardState {
  step: number;
  players: string[];
  mode: SessionMode;
  teamingMethod: "manual" | "auto";
  format: "bo3" | "bo5";
  winnerStaysOn: boolean;
  threeWinRule: boolean;
  matchCount: number;
  fixtures: (Fixture | null)[];
}

const LIVE_STEPS = ["Players", "Mode", "Teaming", "Format", "Options"] as const;
const RR_STEPS   = ["Players", "Mode", "Format & Count", "Fixtures"] as const;

export default function NewSessionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [allPlayers, setAllPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<WizardState>({
    step: 1, players: [], mode: "live", teamingMethod: "manual",
    format: "bo3", winnerStaysOn: false, threeWinRule: false,
    matchCount: 12, fixtures: [],
  });

  // Inline fixture editor state
  const [editingIdx,   setEditingIdx]   = useState<number | null>(null);
  const [fixtureTeamA, setFixtureTeamA] = useState<string[]>([]);
  const [fixtureTeamB, setFixtureTeamB] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("*").order("name").then(({ data }) => {
      setAllPlayers((data ?? []) as Profile[]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps      = state.mode === "round_robin" ? RR_STEPS : LIVE_STEPS;
  const totalSteps = steps.length;
  const isLastStep = state.step === totalSteps;
  const stepLabel  = steps[state.step - 1] ?? "";

  const getName   = (id: string) => allPlayers.find(p => p.id === id)?.name.split(" ")[0] ?? "?";
  const getAvatar = (id: string) => allPlayers.find(p => p.id === id)?.avatar_url ?? null;

  function togglePlayer(id: string) {
    setState(s => ({
      ...s,
      players: s.players.includes(id) ? s.players.filter(p => p !== id) : [...s.players, id],
    }));
  }

  function toggleFixturePlayer(id: string, team: "a" | "b") {
    const thisTeam  = team === "a" ? fixtureTeamA : fixtureTeamB;
    const otherTeam = team === "a" ? fixtureTeamB : fixtureTeamA;
    const setThis   = team === "a" ? setFixtureTeamA : setFixtureTeamB;
    const setOther  = team === "a" ? setFixtureTeamB : setFixtureTeamA;
    if (thisTeam.includes(id)) {
      setThis(thisTeam.filter(p => p !== id));
    } else if (otherTeam.includes(id)) {
      setOther(otherTeam.filter(p => p !== id));
      if (thisTeam.length < 2) setThis([...thisTeam, id]);
    } else {
      if (thisTeam.length < 2) setThis([...thisTeam, id]);
    }
  }

  function startEditing(i: number) {
    const existing = state.fixtures[i];
    setFixtureTeamA(existing?.team_a ?? []);
    setFixtureTeamB(existing?.team_b ?? []);
    setEditingIdx(i);
  }

  function confirmFixture() {
    if (editingIdx === null || fixtureTeamA.length !== 2 || fixtureTeamB.length !== 2) return;
    setState(s => {
      const updated = [...s.fixtures];
      updated[editingIdx] = { team_a: [...fixtureTeamA], team_b: [...fixtureTeamB] };
      return { ...s, fixtures: updated };
    });
    setEditingIdx(null);
    setFixtureTeamA([]);
    setFixtureTeamB([]);
  }

  function autoFill() {
    const generated = generateAmericanoFixtures(state.players, state.matchCount);
    const slots: (Fixture | null)[] = Array(state.matchCount).fill(null);
    generated.forEach((f, i) => { if (i < state.matchCount) slots[i] = f; });
    setState(s => ({ ...s, fixtures: slots }));
    setEditingIdx(null);
    setFixtureTeamA([]);
    setFixtureTeamB([]);
  }

  function advance() {
    if (state.mode === "round_robin" && state.step === 3) {
      setState(s => ({
        ...s, step: 4,
        fixtures: Array(s.matchCount).fill(null) as (Fixture | null)[],
      }));
      return;
    }
    setState(s => ({ ...s, step: s.step + 1 }));
  }

  function goBack() {
    if (state.step > 1) setState(s => ({ ...s, step: s.step - 1 }));
    else router.back();
  }

  async function handleStart() {
    setLoading(true);
    try {
      const validFixtures = state.fixtures.filter((f): f is Fixture => f !== null);
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:            state.mode,
          format:          state.format,
          players:         state.players,
          winner_stays_on: state.mode === "live" ? state.winnerStaysOn : false,
          three_win_rule:  state.mode === "live" ? state.threeWinRule  : false,
          ...(state.mode === "round_robin" ? {
            match_count: validFixtures.length,
            fixtures:    validFixtures,
          } : {}),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error ?? "Failed to create session");
      }
      const { id } = await res.json();
      if (state.mode === "live") sessionStorage.setItem(`session_${id}_teaming`, state.teamingMethod);
      router.push(`/sessions/${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create session.");
    } finally {
      setLoading(false);
    }
  }

  const filledCount = state.fixtures.filter(Boolean).length;

  const canProceed = (() => {
    if (state.step === 1) return state.players.length >= 4;
    if (state.step === 4 && state.mode === "round_robin")
      return state.fixtures.length > 0 && state.fixtures.every(f => f !== null);
    return true;
  })();
  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <button onClick={goBack} className="p-2 -ml-2 rounded-xl text-slate-400 active:bg-white/5 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">New Session</h1>
            <p className="text-xs text-slate-500">Step {state.step} of {totalSteps} — {stepLabel}</p>
          </div>
        </div>
        <div className="flex gap-1.5 pb-4">
          {steps.map((_, i) => (
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
              Select who&apos;s playing.
              <span className="text-cyan-400 font-semibold"> {state.players.length} selected</span> (min 4)
            </p>
            {allPlayers.map(p => {
              const selected = state.players.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlayer(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-2xl border transition-all",
                    selected ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/[0.03] border-white/[0.06] active:bg-white/[0.06]"
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
        {/* Step 2: Mode */}
        {state.step === 2 && (
          <>
            <p className="text-slate-500 text-sm mb-4">How do you want to run this session?</p>
            {([
              { value: "live"        as SessionMode, icon: <Zap size={20} />,          label: "Live Matchmaking", desc: "Pick teams on the fly. Winner Stays On supported.", accent: "cyan"   },
              { value: "round_robin" as SessionMode, icon: <CalendarDays size={20} />, label: "Round Robin",      desc: "Pre-schedule all fixtures. You decide each matchup.", accent: "violet" },
            ] as const).map(({ value, icon, label, desc, accent }) => (
              <button key={value} onClick={() => setState(s => ({ ...s, mode: value }))}
                className={cn(
                  "w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all",
                  state.mode === value
                    ? accent === "cyan" ? "bg-cyan-500/10 border-cyan-500/30" : "bg-violet-500/10 border-violet-500/30"
                    : "bg-white/[0.03] border-white/[0.06]"
                )}>
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  state.mode === value
                    ? accent === "cyan" ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white" : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                    : "bg-white/5 text-slate-500"
                )}>{icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
                {state.mode === value && <Check size={16} className={accent === "cyan" ? "text-cyan-400" : "text-violet-400"} />}
              </button>
            ))}
          </>
        )}
        {/* Step 3 Live: Teaming */}
        {state.step === 3 && state.mode === "live" && (
          <>
            <p className="text-slate-500 text-sm mb-4">How do you want to pick teams?</p>
            <button onClick={() => setState(s => ({ ...s, teamingMethod: "manual" }))}
              className={cn("w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all",
                state.teamingMethod === "manual" ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/[0.03] border-white/[0.06]")}>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center",
                state.teamingMethod === "manual" ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white" : "bg-white/5 text-slate-500")}>
                <Users size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Manual</p>
                <p className="text-xs text-slate-500 mt-0.5">You decide the teams yourself each match.</p>
              </div>
              {state.teamingMethod === "manual" && <Check size={16} className="text-cyan-400 shrink-0" />}
            </button>
            <div className="w-full flex items-center gap-4 p-5 rounded-2xl border bg-white/[0.02] border-white/[0.04] opacity-50 cursor-not-allowed">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-slate-600"><Shuffle size={20} /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-400">Auto (ELO-balanced)</p>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wider">Soon</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">Algorithm creates the fairest matchups.</p>
              </div>
            </div>
          </>
        )}
        {/* Step 3 RR: Format + Match Count */}
        {state.step === 3 && state.mode === "round_robin" && (
          <>
            <p className="text-slate-500 text-sm mb-4">Choose format and how many matches to schedule.</p>
            {([
              { value: "bo3", label: "Best of 3", desc: "First to win 2 games. Faster." },
              { value: "bo5", label: "Best of 5", desc: "First to win 3 games. More intense." },
            ] as const).map(({ value, label, desc }) => (
              <button key={value} onClick={() => setState(s => ({ ...s, format: value }))}
                className={cn("w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all",
                  state.format === value ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.03] border-white/[0.06]")}>
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center",
                  state.format === value ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white" : "bg-white/5 text-slate-500")}>
                  <Trophy size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
                {state.format === value && <Check size={16} className="text-violet-400 shrink-0" />}
              </button>
            ))}

            <div className="glass-card rounded-2xl p-5">
              <p className="text-sm font-bold text-white mb-0.5">Number of Matches</p>
              <p className="text-xs text-slate-500 mb-5">How many fixtures to pre-schedule?</p>
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => setState(s => ({ ...s, matchCount: Math.max(2, s.matchCount - 1) }))}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:bg-white/10 transition-colors">
                  <Minus size={18} />
                </button>
                <div className="text-center flex-1">
                  <p className="text-5xl font-black text-white">{state.matchCount}</p>
                  <p className="text-xs text-slate-500 mt-1.5">matches</p>
                </div>
                <button onClick={() => setState(s => ({ ...s, matchCount: Math.min(20, s.matchCount + 1) }))}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:bg-white/10 transition-colors">
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </>
        )}
        {/* Step 4 Live: Format */}
        {state.step === 4 && state.mode === "live" && (
          <>
            <p className="text-slate-500 text-sm mb-4">How many games per match?</p>
            {([
              { value: "bo3", label: "Best of 3", desc: "First to win 2 games wins the match." },
              { value: "bo5", label: "Best of 5", desc: "First to win 3 games. More dramatic." },
            ] as const).map(({ value, label, desc }) => (
              <button key={value} onClick={() => setState(s => ({ ...s, format: value }))}
                className={cn("w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all",
                  state.format === value ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/[0.03] border-white/[0.06]")}>
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center",
                  state.format === value ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white" : "bg-white/5 text-slate-500")}>
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
        {/* Step 4 RR: Fixture Grid — all N slots at once */}
        {state.step === 4 && state.mode === "round_robin" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{filledCount}/{state.matchCount} fixtures assigned</p>
                <p className="text-xs text-slate-500">Tap a match to assign teams</p>
              </div>
              <button onClick={autoFill}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-400 active:bg-white/10 transition-colors">
                <RotateCcw size={12} /> Auto-fill
              </button>
            </div>

            {Array.from({ length: state.matchCount }, (_, i) => {
              const fixture   = state.fixtures[i] ?? null;
              const isEditing = editingIdx === i;
              return (
                <div key={i} className={cn("glass-card rounded-2xl overflow-hidden transition-all",
                  isEditing && "ring-1 ring-violet-500/40")}>

                  {/* Card header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-1">Match {i + 1}</span>
                    {!isEditing && (
                      <button onClick={() => startEditing(i)}
                        className={cn("text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all",
                          fixture
                            ? "text-slate-400 bg-white/5 active:bg-white/10"
                            : "text-violet-400 bg-violet-500/10 border border-violet-500/20 active:bg-violet-500/20")}>
                        {fixture ? "Edit" : "Assign teams"}
                      </button>
                    )}
                  </div>

                  {/* Filled: show matchup */}
                  {!isEditing && fixture && (
                    <div className="px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="text-center min-w-0">
                        <div className="flex justify-center gap-1 mb-1">
                          {fixture.team_a.map(id => <Avatar key={id} name={getName(id)} avatarUrl={getAvatar(id)} size="sm" />)}
                        </div>
                        <p className="text-xs font-semibold text-slate-300 truncate">{fixture.team_a.map(getName).join(" & ")}</p>
                      </div>
                      <p className="text-[10px] text-slate-600 font-bold px-1">vs</p>
                      <div className="text-center min-w-0">
                        <div className="flex justify-center gap-1 mb-1">
                          {fixture.team_b.map(id => <Avatar key={id} name={getName(id)} avatarUrl={getAvatar(id)} size="sm" />)}
                        </div>
                        <p className="text-xs font-semibold text-slate-300 truncate">{fixture.team_b.map(getName).join(" & ")}</p>
                      </div>
                    </div>
                  )}

                  {/* Empty */}
                  {!isEditing && !fixture && (
                    <p className="px-4 py-3 text-xs text-slate-600 italic">Not assigned yet</p>
                  )}

                  {/* Inline editor */}
                  {isEditing && (
                    <div className="p-4 space-y-3">
                      <div className="space-y-2">
                        {state.players.map(id => {
                          const inA   = fixtureTeamA.includes(id);
                          const inB   = fixtureTeamB.includes(id);
                          const aFull = fixtureTeamA.length >= 2 && !inA;
                          const bFull = fixtureTeamB.length >= 2 && !inB;
                          const p     = allPlayers.find(pl => pl.id === id);
                          if (!p) return null;
                          return (
                            <div key={id} className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                              inA ? "bg-cyan-500/10 border-cyan-500/30"
                                  : inB ? "bg-violet-500/10 border-violet-500/30"
                                  : "bg-white/[0.03] border-white/[0.06]"
                            )}>
                              <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                              <span className="text-sm flex-1 font-semibold text-white truncate">{p.name.split(" ")[0]}</span>
                              <button onClick={() => toggleFixturePlayer(id, "a")} disabled={aFull}
                                className={cn("w-8 h-7 rounded-lg text-xs font-black transition-all",
                                  inA ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
                                      : aFull ? "bg-white/5 text-slate-700 cursor-not-allowed"
                                      : "bg-white/5 text-slate-500 border border-white/10 active:bg-white/10")}>A</button>
                              <button onClick={() => toggleFixturePlayer(id, "b")} disabled={bFull}
                                className={cn("w-8 h-7 rounded-lg text-xs font-black transition-all",
                                  inB ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                                      : bFull ? "bg-white/5 text-slate-700 cursor-not-allowed"
                                      : "bg-white/5 text-slate-500 border border-white/10 active:bg-white/10")}>B</button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                        <div className="flex-1 text-center min-w-0">
                          <p className="text-[10px] font-bold text-cyan-400 uppercase mb-1">Team A</p>
                          <p className="text-xs text-slate-300 truncate">{fixtureTeamA.length ? fixtureTeamA.map(getName).join(" & ") : "—"}</p>
                        </div>
                        <div className="w-px bg-white/10" />
                        <div className="flex-1 text-center min-w-0">
                          <p className="text-[10px] font-bold text-violet-400 uppercase mb-1">Team B</p>
                          <p className="text-xs text-slate-300 truncate">{fixtureTeamB.length ? fixtureTeamB.map(getName).join(" & ") : "—"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setEditingIdx(null); setFixtureTeamA([]); setFixtureTeamB([]); }}
                          className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-slate-400 active:bg-white/10">
                          Cancel
                        </button>
                        <button onClick={confirmFixture} disabled={fixtureTeamA.length !== 2 || fixtureTeamB.length !== 2}
                          className="py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-all">
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        {/* Step 5 Live: Options */}
        {state.step === 5 && state.mode === "live" && (
          <>
            <p className="text-slate-500 text-sm mb-4">Configure session rules.</p>
            {([
              { key: "winnerStaysOn" as const, label: "Winner Stays On", desc: "Winning team stays. Losers rotate out.",             disabled: false                  },
              { key: "threeWinRule"  as const, label: "3-Win Rotation",  desc: "After 3 consecutive wins, winners rotate off too.", disabled: !state.winnerStaysOn   },
            ] as const).map(({ key, label, desc, disabled }) => (
              <div key={key} className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all",
                disabled ? "bg-white/[0.02] border-white/[0.04] opacity-40" : "bg-white/[0.03] border-white/[0.06]")}>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
                <button disabled={disabled} onClick={() => setState(s => ({ ...s, [key]: !s[key] }))}
                  className={cn("w-14 h-7 rounded-full transition-all duration-200 relative shrink-0",
                    state[key]
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                      : "bg-white/[0.08] border border-white/[0.12]")}>
                  <span className={cn("absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300",
                    state[key] ? "translate-x-7 bg-white" : "translate-x-0.5 bg-slate-300/80")} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      {/* CTA */}
      <div className="relative z-10 px-4 py-4 pb-safe">
        <button
          disabled={!canProceed || loading}
          onClick={() => { if (isLastStep) handleStart(); else advance(); }}
          className={cn(
            "w-full py-4 rounded-2xl text-white font-bold disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2",
            state.mode === "round_robin"
              ? "bg-gradient-to-r from-violet-500 to-purple-600 shadow-[0_0_24px_rgba(139,92,246,0.35)]"
              : "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-glow-cyan"
          )}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isLastStep ? (
            <>Start Session 🎾</>
          ) : (
            <>Continue <ArrowRight size={16} /></>
          )}
        </button>
        {state.step === 1 && state.players.length < 4 && (
          <p className="text-center text-xs text-slate-600 mt-2">
            Need {4 - state.players.length} more player{4 - state.players.length !== 1 ? "s" : ""}
          </p>
        )}
        {state.step === 4 && state.mode === "round_robin" && !canProceed && (
          <p className="text-center text-xs text-slate-600 mt-2">
            Assign all {state.matchCount} fixtures to continue
          </p>
        )}
      </div>
    </div>
  );
}
