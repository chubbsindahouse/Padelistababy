"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Flag, Zap, Clock, Trophy, Check, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";
import type { Session, Profile, MatchWithGames } from "@/types";

const PAIR_STYLES = [
  { active: "bg-cyan-500/15 border-cyan-500/40",    badge: "from-cyan-500 to-blue-600",     label: "text-cyan-400"   },
  { active: "bg-violet-500/15 border-violet-500/40", badge: "from-violet-500 to-purple-600", label: "text-violet-400" },
  { active: "bg-amber-500/15 border-amber-500/40",   badge: "from-amber-500 to-orange-600",  label: "text-amber-400"  },
  { active: "bg-emerald-500/15 border-emerald-500/40", badge: "from-emerald-500 to-green-600", label: "text-emerald-400" },
];

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [session,       setSession]       = useState<Session | null>(null);
  const [players,       setPlayers]       = useState<Profile[]>([]);
  const [matches,       setMatches]       = useState<MatchWithGames[]>([]);
  const [currentMatch,  setCurrentMatch]  = useState<MatchWithGames | null>(null);

  // Pair system (even players)
  const [initialPairs,  setInitialPairs]  = useState<string[][]>([]);
  const [onCourtPair,   setOnCourtPair]   = useState<string[]>([]);
  const [waitingPairs,  setWaitingPairs]  = useState<string[][]>([]);
  const [pairAssign,    setPairAssign]    = useState<Record<string, number>>({});

  // Manual team picker (non-pair sessions)
  const [teamA,         setTeamA]         = useState<string[]>([]);
  const [teamB,         setTeamB]         = useState<string[]>([]);
  const [buildingTeams, setBuildingTeams] = useState(false);

  // Odd-player challenger pick
  const [challengerPick, setChallengerPick] = useState<string[]>([]);

  const [submittingScore, setSubmittingScore] = useState(false);
  const [endingSession,   setEndingSession]   = useState(false);

  useEffect(() => {
    async function load() {
      const stored = sessionStorage.getItem(`session_${sessionId}_pairs`);
      const pairs: string[][] = stored ? JSON.parse(stored) : [];
      setInitialPairs(pairs);

      const { data: s } = await supabase.from("sessions").select("*").eq("id", sessionId).single<Session>();
      setSession(s);
      const { data: sps } = await supabase.from("session_players").select("player_id").eq("session_id", sessionId);
      const ids = (sps ?? []).map((r: { player_id: string }) => r.player_id);
      const { data: ps } = await supabase.from("profiles").select("*").in("id", ids);
      setPlayers((ps ?? []) as Profile[]);
      await loadMatchesCore(s, (ps ?? []) as Profile[], pairs);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function deriveQueueState(s: Session, pairs: string[][], completed: MatchWithGames[]) {
    if (pairs.length < 2 || completed.length === 0) return { queue: pairs.slice(2), onCourt: [] as string[] };

    let queue: string[][] = pairs.slice(2);
    let onCourt: string[] = [];

    for (let i = 0; i < completed.length; i++) {
      const m = completed[i];
      const winners = m.winner_team === "a" ? [...m.team_a] : [...m.team_b];
      const losers  = m.winner_team === "a" ? [...m.team_b] : [...m.team_a];
      const consec  = m.consecutive_wins ?? 0;

      if (i === 0) {
        // First match used pairs[0] & pairs[1] — not from queue
        queue = [...queue, losers];
      } else if (onCourt.length > 0) {
        // Winners were on court; challengers came from queue[0]
        queue = [...queue.slice(1), losers];
      } else {
        // 3-win restart: both teams came from queue[0] and queue[1]
        queue = [...queue.slice(2), losers];
      }

      if (s.three_win_rule && consec >= 3) {
        queue = [...queue, winners];
        onCourt = [];
      } else {
        onCourt = winners;
      }
    }

    return { queue, onCourt };
  }

  async function loadMatchesCore(s: Session | null, profileList: Profile[], pairs: string[][]) {
    const { data: ms } = await supabase
      .from("matches").select("*").eq("session_id", sessionId).order("match_order");
    const enriched: MatchWithGames[] = [];
    for (const m of ms ?? []) {
      const { data: gs } = await supabase.from("games").select("*").eq("match_id", m.id).order("game_order");
      enriched.push({ ...m, games: gs ?? [] });
    }
    setMatches(enriched);
    const active = enriched.find((m) => !m.winner_team) ?? null;
    setCurrentMatch(active);

    const isOdd = profileList.length % 2 !== 0;
    if (s?.winner_stays_on && !isOdd && pairs.length >= 2) {
      const completed = enriched.filter((m) => m.winner_team !== null);
      const { queue, onCourt } = deriveQueueState(s, pairs, completed);
      setOnCourtPair(onCourt);
      if (active) {
        const activePlayers = new Set([...active.team_a, ...active.team_b]);
        setWaitingPairs(queue.filter(pair => !pair.some(id => activePlayers.has(id))));
      } else {
        setWaitingPairs(queue);
      }
    }
  }

  async function loadMatches() { await loadMatchesCore(session, players, initialPairs); }
  function getProfile(id: string) { return players.find((p) => p.id === id); }

  function assignToPair(playerId: string, pairNum: number) {
    setPairAssign(prev => {
      if (prev[playerId] === pairNum) { const u = { ...prev }; delete u[playerId]; return u; }
      const others = Object.entries(prev).filter(([id, p]) => p === pairNum && id !== playerId).length;
      if (others >= 2) return prev;
      return { ...prev, [playerId]: pairNum };
    });
  }

  function confirmPairs() {
    const numPairs = Math.floor(players.length / 2);
    const pairs: string[][] = [];
    for (let i = 1; i <= numPairs; i++) {
      const pp = players.filter(p => pairAssign[p.id] === i).map(p => p.id);
      if (pp.length !== 2) { alert(`Pair ${i} needs exactly 2 players.`); return; }
      pairs.push(pp);
    }
    if (players.some(p => !pairAssign[p.id])) { alert("All players must be assigned."); return; }
    sessionStorage.setItem(`session_${sessionId}_pairs`, JSON.stringify(pairs));
    setInitialPairs(pairs);
  }

  function toggleManualTeam(playerId: string, team: "a" | "b") {
    const thisTeam = team === "a" ? teamA : teamB;
    const other    = team === "a" ? teamB : teamA;
    const setThis  = team === "a" ? setTeamA : setTeamB;
    const setOther = team === "a" ? setTeamB : setTeamA;
    if (thisTeam.includes(playerId)) { setThis(thisTeam.filter(id => id !== playerId)); }
    else if (other.includes(playerId)) { setOther(other.filter(id => id !== playerId)); if (thisTeam.length < 2) setThis([...thisTeam, playerId]); }
    else { if (thisTeam.length < 2) setThis([...thisTeam, playerId]); }
  }

  function toggleChallengerPick(playerId: string) {
    setChallengerPick(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : prev.length < 2 ? [...prev, playerId] : prev
    );
  }

  async function startMatch() {
    let tA: string[], tB: string[];
    const isOdd = players.length % 2 !== 0;

    if (session?.winner_stays_on && !isOdd && initialPairs.length >= 2) {
      // Even player pair system — fully automatic
      const done = matches.filter(m => m.winner_team !== null);
      if (done.length === 0)             { tA = initialPairs[0]; tB = initialPairs[1]; }
      else if (onCourtPair.length === 2) { tA = onCourtPair; tB = waitingPairs[0] ?? []; }
      else                               { tA = waitingPairs[0] ?? []; tB = waitingPairs[1] ?? []; }
    } else if (session?.winner_stays_on && isOdd && onCourtPlayers.length === 2) {
      // Odd player — winners stay, challengers manually picked
      tA = onCourtPlayers;
      tB = challengerPick;
    } else {
      // Full manual pick (no winner_stays_on, odd first match, or 3-win reset)
      tA = teamA;
      tB = teamB;
    }

    if (tA.length !== 2 || tB.length !== 2) { alert("Each team needs exactly 2 players."); return; }
    const { data: nm } = await supabase.from("matches")
      .insert({ session_id: sessionId, team_a: tA, team_b: tB, match_order: matches.length, consecutive_wins: 0 })
      .select().single();
    if (nm) {
      setCurrentMatch({ ...nm, games: [] });
      setMatches(p => [...p, { ...nm, games: [] }]);
      setTeamA([]); setTeamB([]);
      setBuildingTeams(false);
      setChallengerPick([]);
    }
  }

  async function recordGameWin(winner: "a" | "b") {
    if (!currentMatch || submittingScore) return;
    setSubmittingScore(true);
    try {
      await supabase.from("games").insert({
        match_id: currentMatch.id,
        score_a: winner === "a" ? 1 : 0,
        score_b: winner === "b" ? 1 : 0,
        game_order: currentMatch.games.length,
      });
      await loadMatches();
    } finally { setSubmittingScore(false); }
  }

  async function declareMatchWinner(winner: "a" | "b") {
    if (!currentMatch) return;
    const done = matches.filter(m => m.winner_team !== null);
    const last = done[done.length - 1];
    let consec = 0;
    if (session?.winner_stays_on) {
      // Compare by actual player IDs, not positional labels ("a"/"b")
      const lastWinnerIds: string[] = last
        ? (last.winner_team === "a" ? last.team_a : last.team_b)
        : [];
      const currentWinnerIds: string[] = winner === "a" ? currentMatch.team_a : currentMatch.team_b;
      const sameTeam =
        lastWinnerIds.length > 0 &&
        lastWinnerIds.length === currentWinnerIds.length &&
        lastWinnerIds.every(id => currentWinnerIds.includes(id));
      consec = sameTeam ? (last!.consecutive_wins ?? 0) + 1 : 1;
    }
    await supabase.from("matches").update({
      winner_team: winner,
      consecutive_wins: consec,
      completed_at: new Date().toISOString(),
    }).eq("id", currentMatch.id);
    await loadMatches();
  }

  async function endSession() {
    if (!confirm("End this session? ELO will be recalculated and badges awarded.")) return;
    setEndingSession(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
      if (res.ok) router.push("/sessions"); else alert("Failed to end session.");
    } finally { setEndingSession(false); }
  }

  const gamesWonA  = currentMatch?.games.filter(g => g.score_a > g.score_b).length ?? 0;
  const gamesWonB  = currentMatch?.games.filter(g => g.score_b > g.score_a).length ?? 0;
  const winsNeeded = session?.format === "bo5" ? 3 : 2;
  const canDeclare = gamesWonA >= winsNeeded || gamesWonB >= winsNeeded;

  if (!session) return (
    <div className="flex items-center justify-center h-screen bg-[#05050A]">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
    </div>
  );

  /* ── Past session (read-only) ── */
  if (!session.is_active) return (
    <div className="min-h-screen bg-[#05050A]">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />
      <div className="relative z-10 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-slate-400 active:bg-white/5 transition-colors"><ChevronLeft size={22} /></button>
          <div>
            <h1 className="text-base font-bold text-white">Session Detail</h1>
            <p className="text-xs text-slate-500">{new Date(session.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>
      </div>
      <div className="relative z-10 px-4 pb-28 space-y-3">
        {matches.map((m, i) => {
          const aW = m.games.filter(g => g.score_a > g.score_b).length;
          const bW = m.games.filter(g => g.score_b > g.score_a).length;
          const winIds = m.winner_team === "a" ? m.team_a : m.team_b;
          return (
            <div key={m.id} className="glass-card rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Match {i + 1}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="text-center min-w-0">
                  <div className="flex justify-center gap-1 mb-2">{m.team_a.map(id => <Avatar key={id} name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="sm" />)}</div>
                  <p className={cn("text-xs font-semibold truncate", m.winner_team === "a" ? "text-cyan-400" : "text-slate-400")}>{m.team_a.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}</p>
                </div>
                <div className="text-center px-2 shrink-0">
                  <p className="text-2xl font-black text-white">{aW}–{bW}</p>
                  {m.winner_team && <p className="text-[10px] text-cyan-400 font-bold mt-0.5">{winIds.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")} won</p>}
                </div>
                <div className="text-center min-w-0">
                  <div className="flex justify-center gap-1 mb-2">{m.team_b.map(id => <Avatar key={id} name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="sm" />)}</div>
                  <p className={cn("text-xs font-semibold truncate", m.winner_team === "b" ? "text-cyan-400" : "text-slate-400")}>{m.team_b.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── Active session derived state ── */
  const isOddPlayers       = players.length % 2 !== 0;
  const completedMatches   = matches.filter(m => m.winner_team !== null);
  const lastCompleted      = completedMatches[completedMatches.length - 1];
  const lastConsecutive    = lastCompleted?.consecutive_wins ?? 0;
  const isThreeWinRotation = session.three_win_rule && lastConsecutive >= 3;

  // Even players: pair system
  const usePairSystem  = session.winner_stays_on && !isOddPlayers && initialPairs.length >= 2;
  const needsPairSetup = session.winner_stays_on && !isOddPlayers && initialPairs.length === 0 && completedMatches.length === 0 && !currentMatch;

  // Odd players: derive who's currently on court from last completed match
  // Returns empty if 3-win rotation just triggered (so we fall back to full manual pick)
  const onCourtPlayers: string[] = (() => {
    if (!session.winner_stays_on || !isOddPlayers || !lastCompleted) return [];
    if (session.three_win_rule && (lastCompleted.consecutive_wins ?? 0) >= 3) return [];
    return lastCompleted.winner_team === "a" ? lastCompleted.team_a : lastCompleted.team_b;
  })();

  // Players available to be picked as challengers (odd sessions)
  const availableForChallenge = players.filter(p => !onCourtPlayers.includes(p.id));

  // Auto-computed next matchup (even / pair system only)
  let nextTeamA: string[] = [], nextTeamB: string[] = [];
  if (usePairSystem && !currentMatch) {
    if (completedMatches.length === 0)   { nextTeamA = initialPairs[0] ?? []; nextTeamB = initialPairs[1] ?? []; }
    else if (onCourtPair.length === 2)   { nextTeamA = onCourtPair; nextTeamB = waitingPairs[0] ?? []; }
    else                                 { nextTeamA = waitingPairs[0] ?? []; nextTeamB = waitingPairs[1] ?? []; }
  }

  const headerBar = (subtitle: string) => (
    <div className="relative z-10 px-4 pt-safe border-b border-white/[0.06] bg-[#05050A]/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-slate-400 active:bg-white/5 transition-colors"><ChevronLeft size={22} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-base font-bold text-white">Live Session</h1>
          </div>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <button onClick={endSession} disabled={endingSession}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl active:bg-red-500/20 transition-all">
          {endingSession ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : <Flag size={13} />}
          End Session
        </button>
      </div>
    </div>
  );

  /* ── Pair setup screen (even players, winner_stays_on, before first match) ── */
  if (needsPairSetup) {
    const numPairs = Math.floor(players.length / 2);
    const allAssigned = players.length > 0 &&
      players.every(p => pairAssign[p.id]) &&
      Array.from({ length: numPairs }, (_, i) => i + 1).every(n =>
        players.filter(p => pairAssign[p.id] === n).length === 2
      );
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />
        {headerBar("Assign players to pairs before starting")}
        <div className="relative z-10 flex-1 px-4 py-4 space-y-4 overflow-y-auto pb-28">

          {/* Pair slots */}
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{numPairs} pairs · {players.length} players</p>
            <div className="space-y-2">
              {Array.from({ length: numPairs }, (_, i) => i + 1).map(n => {
                const st = PAIR_STYLES[(n - 1) % PAIR_STYLES.length];
                const pp = players.filter(p => pairAssign[p.id] === n);
                return (
                  <div key={n} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", pp.length === 2 ? st.active : "bg-white/[0.03] border-white/[0.06]")}>
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 bg-gradient-to-br", st.badge)}>{n}</div>
                    <div className="flex-1 min-w-0">
                      {pp.length === 0 ? <p className="text-xs text-slate-600">Empty</p> : (
                        <div className="flex items-center gap-3">
                          {pp.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5">
                              <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                              <span className="text-xs font-semibold text-white">{p.name.split(" ")[0]}</span>
                            </div>
                          ))}
                          {pp.length === 1 && <span className="text-xs text-slate-600">+ 1 more</span>}
                        </div>
                      )}
                    </div>
                    {pp.length === 2 && <Check size={14} className={st.label} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player assignment */}
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Assign to Pair</p>
            <div className="space-y-2">
              {players.map(p => {
                const assigned = pairAssign[p.id];
                const st = assigned ? PAIR_STYLES[(assigned - 1) % PAIR_STYLES.length] : null;
                return (
                  <div key={p.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", st ? st.active : "bg-white/[0.03] border-white/[0.06]")}>
                    <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                    <span className="text-sm font-semibold text-white flex-1 truncate">{p.name.split(" ")[0]}</span>
                    <div className="flex gap-1.5 shrink-0">
                      {Array.from({ length: numPairs }, (_, i) => i + 1).map(n => {
                        const s2 = PAIR_STYLES[(n - 1) % PAIR_STYLES.length];
                        const isSel = assigned === n;
                        const full = players.filter(pl => pairAssign[pl.id] === n && pl.id !== p.id).length >= 2;
                        return (
                          <button key={n} onClick={() => assignToPair(p.id, n)} disabled={full && !isSel}
                            className={cn("w-8 h-8 rounded-lg text-xs font-black transition-all",
                              isSel
                                ? cn("bg-gradient-to-br text-white", s2.badge)
                                : full
                                  ? "bg-white/5 text-slate-700 cursor-not-allowed"
                                  : "bg-white/5 text-slate-400 border border-white/10 active:bg-white/10")}>
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={confirmPairs} disabled={!allAssigned}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan disabled:opacity-40 active:scale-[0.98] transition-all">
            Confirm Pairs &amp; Start Session 🎾
          </button>
        </div>
      </div>
    );
  }

  /* ── Main live session ── */
  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/6 blur-[120px] rounded-full pointer-events-none" />
      {headerBar(`${session.format.toUpperCase()}${session.winner_stays_on ? " · Winner Stays On" : ""}${isOddPlayers ? " · Pick challengers each round" : ""} · ${players.length} players`)}

      <div className="relative z-10 flex-1 px-4 py-4 space-y-4 overflow-y-auto pb-28">

        {/* ── Current match ── */}
        {currentMatch && (
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/5" />
            <div className="absolute inset-0 border border-cyan-500/20 rounded-2xl" />
            <div className="relative p-5">
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4">Match {matches.length} in progress</p>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="text-center min-w-0">
                  <div className="flex justify-center gap-1 mb-2">
                    {currentMatch.team_a.map(id => <Avatar key={id} name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="md" />)}
                  </div>
                  <p className="text-xs font-semibold text-slate-300 truncate px-1">
                    {currentMatch.team_a.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                  </p>
                  <p className={cn("text-6xl font-black mt-3 leading-none", gamesWonA > gamesWonB ? "gradient-text" : "text-white/40")}>{gamesWonA}</p>
                </div>
                <div className="text-center shrink-0 px-1">
                  <p className="text-[10px] text-slate-600 font-bold">VS</p>
                  <p className="text-[10px] text-slate-700 mt-1">{session.format.toUpperCase()}</p>
                </div>
                <div className="text-center min-w-0">
                  <div className="flex justify-center gap-1 mb-2">
                    {currentMatch.team_b.map(id => <Avatar key={id} name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="md" />)}
                  </div>
                  <p className="text-xs font-semibold text-slate-300 truncate px-1">
                    {currentMatch.team_b.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                  </p>
                  <p className={cn("text-6xl font-black mt-3 leading-none", gamesWonB > gamesWonA ? "gradient-text" : "text-white/40")}>{gamesWonB}</p>
                </div>
              </div>

              {currentMatch.games.length > 0 && (
                <div className="flex gap-2 justify-center mt-4 flex-wrap">
                  {currentMatch.games.map((g, i) => {
                    const aWon = g.score_a > g.score_b;
                    return (
                      <div key={i} className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold border",
                        aWon ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300" : "bg-violet-500/10 border-violet-500/20 text-violet-300")}>
                        G{i + 1} · {aWon
                          ? currentMatch.team_a.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")
                          : currentMatch.team_b.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                      </div>
                    );
                  })}
                </div>
              )}

              {!canDeclare && (
                <div className="mt-5">
                  <p className="text-xs text-slate-500 text-center mb-3">Who won this game?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => recordGameWin("a")} disabled={submittingScore}
                      className="py-5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 active:bg-cyan-500/20 disabled:opacity-50 transition-all text-center">
                      <p className="text-sm font-bold text-cyan-300 truncate px-2">
                        {currentMatch.team_a.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                      </p>
                      <p className="text-[10px] text-cyan-600 mt-1">wins game</p>
                    </button>
                    <button onClick={() => recordGameWin("b")} disabled={submittingScore}
                      className="py-5 rounded-xl bg-violet-500/10 border border-violet-500/30 active:bg-violet-500/20 disabled:opacity-50 transition-all text-center">
                      <p className="text-sm font-bold text-violet-300 truncate px-2">
                        {currentMatch.team_b.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                      </p>
                      <p className="text-[10px] text-violet-600 mt-1">wins game</p>
                    </button>
                  </div>
                </div>
              )}

              {canDeclare && (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-bold text-center text-white">Match complete — declare the winner</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => declareMatchWinner("a")}
                      className="py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold shadow-glow-cyan active:scale-[0.98] transition-all truncate px-3">
                      {currentMatch.team_a.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")} Won
                    </button>
                    <button onClick={() => declareMatchWinner("b")}
                      className="py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold shadow-glow-cyan active:scale-[0.98] transition-all truncate px-3">
                      {currentMatch.team_b.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")} Won
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Next match setup ── */}
        {!currentMatch && (
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Zap size={16} className="text-cyan-400" />
              </div>
              <p className="text-sm font-bold text-white">
                {completedMatches.length === 0 ? "Start the first match!" : "Ready for the next match?"}
              </p>
            </div>

            {/* 3-win rotation banner (all session types) */}
            {isThreeWinRotation && (
              <div className="mb-4 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-xs text-amber-400 font-bold">🔄 3-win rule — winners rotate off!</p>
              </div>
            )}

            {/* ── EVEN players: auto pair system ── */}
            {usePairSystem ? (
              <div>
                {!isThreeWinRotation && onCourtPair.length > 0 && completedMatches.length > 0 && (
                  <div className="mb-4 px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                    <p className="text-xs text-cyan-400 font-bold">
                      🏆 {onCourtPair.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")} stay on court
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
                  <div className="text-center min-w-0">
                    <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">
                      {completedMatches.length === 0 || isThreeWinRotation ? "Team A" : "Staying On"}
                    </p>
                    <div className="flex justify-center gap-1 mb-2">
                      {nextTeamA.map(id => <Avatar key={id} name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="md" />)}
                    </div>
                    <p className="text-xs font-semibold text-white truncate">
                      {nextTeamA.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-center"><p className="text-[10px] text-slate-600 font-bold">VS</p></div>
                  <div className="text-center min-w-0">
                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">
                      {completedMatches.length === 0 || isThreeWinRotation ? "Team B" : "Challengers"}
                    </p>
                    <div className="flex justify-center gap-1 mb-2">
                      {nextTeamB.map(id => <Avatar key={id} name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="md" />)}
                    </div>
                    <p className="text-xs font-semibold text-white truncate">
                      {nextTeamB.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                    </p>
                  </div>
                </div>
                <button onClick={startMatch} disabled={nextTeamA.length !== 2 || nextTeamB.length !== 2}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan disabled:opacity-40 active:scale-[0.98] transition-all">
                  Start Match
                </button>
              </div>

            /* ── ODD players: winner stays, pick challengers ── */
            ) : session.winner_stays_on && isOddPlayers && onCourtPlayers.length === 2 ? (
              <div>
                {/* Who's staying on court */}
                <div className="mb-4 px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <p className="text-xs text-cyan-400 font-bold text-center mb-2">🏆 Staying on court</p>
                  <div className="flex justify-center gap-6">
                    {onCourtPlayers.map(id => (
                      <div key={id} className="flex items-center gap-1.5">
                        <Avatar name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="sm" />
                        <span className="text-xs font-semibold text-white">{getProfile(id)?.name?.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-3">
                  Pick 2 challengers
                  <span className="text-cyan-400 font-semibold"> ({challengerPick.length}/2 selected)</span>
                </p>
                <div className="space-y-2 mb-4">
                  {availableForChallenge.map(p => {
                    const sel = challengerPick.includes(p.id);
                    const full = challengerPick.length >= 2 && !sel;
                    return (
                      <button key={p.id} onClick={() => toggleChallengerPick(p.id)} disabled={full}
                        className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                          sel
                            ? "bg-violet-500/15 border-violet-500/40"
                            : full
                              ? "bg-white/[0.02] border-white/[0.04] opacity-40 cursor-not-allowed"
                              : "bg-white/[0.03] border-white/[0.06] active:bg-white/[0.06]")}>
                        <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                        <span className="text-sm font-semibold text-white flex-1 text-left">{p.name.split(" ")[0]}</span>
                        <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          sel ? "bg-gradient-to-br from-violet-500 to-purple-600 border-transparent" : "border-white/20")}>
                          {sel && <Check size={12} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button onClick={startMatch} disabled={challengerPick.length !== 2}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan disabled:opacity-40 active:scale-[0.98] transition-all">
                  Start Match
                </button>
              </div>

            /* ── Manual full team picker (no winner_stays_on, odd first match, or 3-win reset) ── */
            ) : buildingTeams ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-2">Tap A or B to assign each player</p>
                {players.map(p => {
                  const inA = teamA.includes(p.id), inB = teamB.includes(p.id);
                  return (
                    <div key={p.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all",
                      inA ? "bg-cyan-500/10 border-cyan-500/30"
                          : inB ? "bg-violet-500/10 border-violet-500/30"
                          : "bg-white/[0.03] border-white/[0.06]")}>
                      <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                      <span className="text-sm flex-1 font-semibold text-white truncate">{p.name.split(" ")[0]}</span>
                      <button onClick={() => toggleManualTeam(p.id, "a")}
                        className={cn("w-9 h-8 rounded-lg text-xs font-black transition-all",
                          inA ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white" : "bg-white/5 text-slate-500 border border-white/10")}>A</button>
                      <button onClick={() => toggleManualTeam(p.id, "b")}
                        className={cn("w-9 h-8 rounded-lg text-xs font-black transition-all",
                          inB ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white" : "bg-white/5 text-slate-500 border border-white/10")}>B</button>
                    </div>
                  );
                })}
                {(teamA.length > 0 || teamB.length > 0) && (
                  <div className="flex gap-2 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                    <div className="flex-1 text-center min-w-0">
                      <p className="text-[10px] font-bold text-cyan-400 uppercase mb-1">Team A</p>
                      <p className="text-xs text-slate-300 truncate">{teamA.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ") || "—"}</p>
                    </div>
                    <div className="w-px bg-white/10" />
                    <div className="flex-1 text-center min-w-0">
                      <p className="text-[10px] font-bold text-violet-400 uppercase mb-1">Team B</p>
                      <p className="text-xs text-slate-300 truncate">{teamB.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ") || "—"}</p>
                    </div>
                  </div>
                )}
                <button onClick={startMatch} disabled={teamA.length !== 2 || teamB.length !== 2}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm disabled:opacity-40 shadow-glow-cyan active:scale-[0.98] transition-all">
                  Start Match
                </button>
              </div>
            ) : (
              <button onClick={() => setBuildingTeams(true)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan active:scale-[0.98] transition-all">
                <span className="flex items-center justify-center gap-2"><Users size={16} /> Pick Teams</span>
              </button>
            )}
          </div>
        )}

        {/* ── Queue display (even player pair system only) ── */}
        {usePairSystem && waitingPairs.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-slate-500" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {currentMatch ? "Waiting Queue" : "Up Next"}
              </p>
            </div>
            <div className="space-y-2">
              {waitingPairs.map((pair, i) => (
                <div key={pair.join(",")} className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
                  <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i + 1}</div>
                  <div className="flex items-center gap-3 flex-1">
                    {pair.map(id => (
                      <div key={id} className="flex items-center gap-1.5">
                        <Avatar name={getProfile(id)?.name ?? "?"} avatarUrl={getProfile(id)?.avatar_url} size="sm" />
                        <span className="text-xs font-semibold text-slate-300">{getProfile(id)?.name?.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                  {i === 0 && !currentMatch && (
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full shrink-0">on deck</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Match history ── */}
        {completedMatches.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={14} className="text-slate-500" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Match History</p>
            </div>
            <div className="space-y-2">
              {completedMatches.map((m, i) => {
                const aW = m.games.filter(g => g.score_a > g.score_b).length;
                const bW = m.games.filter(g => g.score_b > g.score_a).length;
                return (
                  <div key={m.id} className="flex items-center gap-2 py-2 border-b border-white/[0.05] last:border-0">
                    <span className="text-[10px] font-bold text-slate-600 w-6 shrink-0">#{i + 1}</span>
                    <span className={cn("flex-1 text-xs font-semibold truncate", m.winner_team === "a" ? "text-cyan-400" : "text-slate-400")}>
                      {m.team_a.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                    </span>
                    <span className="font-mono text-xs font-bold text-white bg-white/5 rounded-lg px-2 py-0.5 mx-1 shrink-0">{aW}–{bW}</span>
                    <span className={cn("flex-1 text-xs font-semibold truncate text-right", m.winner_team === "b" ? "text-cyan-400" : "text-slate-400")}>
                      {m.team_b.map(id => getProfile(id)?.name?.split(" ")[0]).join(" & ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
