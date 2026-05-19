import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

/* ─── helpers ──────────────────────────────────────────────── */
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function dot(win: boolean) {
  return win
    ? `<span class="dot win">W</span>`
    : `<span class="dot loss">L</span>`;
}

function eloArrow(delta: number) {
  if (delta > 0) return `<span class="up">▲${delta}</span>`;
  if (delta < 0) return `<span class="dn">▼${Math.abs(delta)}</span>`;
  return `<span class="neu">—</span>`;
}

/* ─── GET handler ──────────────────────────────────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const admin = createServiceClient();

  // ── 1. Session ──────────────────────────────────────────────
  const { data: session } = await admin
    .from("sessions").select("*").eq("id", sessionId).single();
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // ── 2. Players ──────────────────────────────────────────────
  const { data: spRows } = await admin
    .from("session_players").select("player_id").eq("session_id", sessionId);
  const playerIds = (spRows ?? []).map((r: { player_id: string }) => r.player_id);

  const { data: profilesData } = await admin
    .from("profiles").select("*").in("id", playerIds);
  const profiles: Record<string, { id: string; name: string; elo_rating: number; avatar_url: string | null }> =
    Object.fromEntries((profilesData ?? []).map((p: { id: string; name: string; elo_rating: number; avatar_url: string | null }) => [p.id, p]));

  // ── 3. Matches ──────────────────────────────────────────────
  const { data: matchesData } = await admin
    .from("matches")
    .select("id, team_a, team_b, winner_team, consecutive_wins, match_order")
    .eq("session_id", sessionId)
    .not("winner_team", "is", null)
    .order("match_order");
  const matches = (matchesData ?? []) as Array<{
    id: string; team_a: string[]; team_b: string[];
    winner_team: "a" | "b"; consecutive_wins: number; match_order: number;
  }>;

  // ── 4. ELO history ──────────────────────────────────────────
  const { data: eloRows } = await admin
    .from("elo_history")
    .select("player_id, rating_before, rating_after, delta")
    .eq("session_id", sessionId);

  // Sum session deltas per player; also grab entry ELO (first rating_before)
  const eloByPlayer: Record<string, { delta: number; entryElo: number; exitElo: number }> = {};
  for (const row of (eloRows ?? []) as Array<{ player_id: string; rating_before: number; rating_after: number; delta: number }>) {
    if (!eloByPlayer[row.player_id]) {
      eloByPlayer[row.player_id] = { delta: 0, entryElo: row.rating_before, exitElo: row.rating_after };
    }
    eloByPlayer[row.player_id].delta += row.delta;
    eloByPlayer[row.player_id].exitElo = row.rating_after;
  }

  // ── 5. Per-player win/loss counts ──────────────────────────
  const wl: Record<string, { wins: number; losses: number }> = {};
  for (const id of playerIds) wl[id] = { wins: 0, losses: 0 };
  for (const m of matches) {
    const winIds  = m.winner_team === "a" ? m.team_a : m.team_b;
    const lossIds = m.winner_team === "a" ? m.team_b : m.team_a;
    winIds.forEach((id: string)  => { if (wl[id]) wl[id].wins++; });
    lossIds.forEach((id: string) => { if (wl[id]) wl[id].losses++; });
  }

  // ── 6. Highlights ───────────────────────────────────────────
  // Unbeaten players (played at least 1 match, 0 losses)
  const unbeaten = playerIds.filter(id => {
    const s = wl[id];
    return s && s.wins + s.losses > 0 && s.losses === 0;
  }).map(id => profiles[id]?.name ?? "Unknown");

  // MVP — most wins
  const mvpId = playerIds.reduce((best, id) =>
    (wl[id]?.wins ?? 0) > (wl[best]?.wins ?? 0) ? id : best
  , playerIds[0]);
  const mvp = mvpId ? profiles[mvpId] : null;

  // Best win rate (min 2 matches)
  const bestRateId = playerIds
    .filter(id => (wl[id]?.wins ?? 0) + (wl[id]?.losses ?? 0) >= 2)
    .reduce<string | null>((best, id) => {
      const r = wl[id].wins / (wl[id].wins + wl[id].losses);
      if (!best) return id;
      const br = wl[best].wins / (wl[best].wins + wl[best].losses);
      return r > br ? id : best;
    }, null);
  const bestRatePlayer = bestRateId ? profiles[bestRateId] : null;

  // Win streak — highest consecutive_wins value in this session
  const maxStreak = Math.max(0, ...matches.map(m => m.consecutive_wins ?? 0));
  let streakTeamNames: string[] | null = null;
  if (maxStreak > 0) {
    const streakMatch = matches.find(m => (m.consecutive_wins ?? 0) === maxStreak)!;
    const winIds = streakMatch.winner_team === "a" ? streakMatch.team_a : streakMatch.team_b;
    streakTeamNames = winIds.map((id: string) => profiles[id]?.name?.split(" ")[0] ?? "?");
  }

  // Most dominant — biggest games-difference using winner games vs loser games
  // We need game counts; fetch games for all matches
  const matchIds = matches.map(m => m.id);
  let dominantMatch: typeof matches[0] | null = null;
  let dominantScore = "";
  if (matchIds.length > 0) {
    const { data: gamesData } = await admin
      .from("games").select("match_id, score_a, score_b").in("match_id", matchIds);
    const gamesByMatch: Record<string, { aWins: number; bWins: number }> = {};
    for (const g of (gamesData ?? []) as Array<{ match_id: string; score_a: number; score_b: number }>) {
      if (!gamesByMatch[g.match_id]) gamesByMatch[g.match_id] = { aWins: 0, bWins: 0 };
      if (g.score_a > g.score_b) gamesByMatch[g.match_id].aWins++;
      else gamesByMatch[g.match_id].bWins++;
    }
    let maxDiff = -1;
    for (const m of matches) {
      const g = gamesByMatch[m.id];
      if (!g) continue;
      const winGames  = m.winner_team === "a" ? g.aWins : g.bWins;
      const lossGames = m.winner_team === "a" ? g.bWins : g.aWins;
      const diff = winGames - lossGames;
      if (diff > maxDiff) {
        maxDiff = diff;
        dominantMatch = m;
        dominantScore = `${winGames}–${lossGames}`;
      }
    }
  }

  // Biggest mover — highest ELO gain
  const biggestMoverId = playerIds.reduce<string | null>((best, id) => {
    const d = eloByPlayer[id]?.delta ?? 0;
    if (!best) return d > 0 ? id : null;
    return d > (eloByPlayer[best]?.delta ?? 0) ? id : best;
  }, null);
  const biggestMover = biggestMoverId ? profiles[biggestMoverId] : null;

  // Worst luck — most losses
  const worstLuckId = playerIds.reduce((worst, id) =>
    (wl[id]?.losses ?? 0) > (wl[worst]?.losses ?? 0) ? id : worst
  , playerIds[0]);
  const worstLuck = worstLuckId && (wl[worstLuckId]?.losses ?? 0) > 0 ? profiles[worstLuckId] : null;

  // ── 7. Pair form ────────────────────────────────────────────
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const pairData: Record<string, { ids: [string, string]; results: boolean[] }> = {};
  for (const m of matches) {
    const sides = [
      { ids: m.team_a, won: m.winner_team === "a" },
      { ids: m.team_b, won: m.winner_team === "b" },
    ];
    for (const { ids, won } of sides) {
      if (ids.length === 2) {
        const k = pairKey(ids[0], ids[1]);
        if (!pairData[k]) pairData[k] = { ids: [ids[0], ids[1]], results: [] };
        pairData[k].results.push(won);
      }
    }
  }
  const pairs = Object.values(pairData).sort((a, b) => {
    const aWr = a.results.filter(Boolean).length / a.results.length;
    const bWr = b.results.filter(Boolean).length / b.results.length;
    return bWr - aWr || b.results.length - a.results.length;
  });

  // ── 8. Standings ────────────────────────────────────────────
  // All-time leaderboard position (by total_points, then elo_rating)
  const { data: allProfilesData } = await admin
    .from("profiles").select("id, total_points, elo_rating").order("total_points", { ascending: false });
  const rankMap: Record<string, number> = {};
  (allProfilesData ?? []).forEach((p: { id: string }, i: number) => { rankMap[p.id] = i + 1; });

  // Session points earned = wl.wins * 3 + wl.losses * 1 (standard formula — adjust if needed)
  const pointsEarned: Record<string, number> = {};
  for (const id of playerIds) {
    pointsEarned[id] = (wl[id]?.wins ?? 0) * 3 + (wl[id]?.losses ?? 0) * 1;
  }

  const standings = playerIds
    .map(id => ({
      id,
      name: profiles[id]?.name ?? "Unknown",
      rank: rankMap[id] ?? 99,
      wins: wl[id]?.wins ?? 0,
      losses: wl[id]?.losses ?? 0,
      eloDelta: eloByPlayer[id]?.delta ?? 0,
      ptsToday: pointsEarned[id] ?? 0,
      totalPts: (profilesData ?? []).find((p: { id: string; total_points: number }) => p.id === id)?.total_points ?? 0,
      currentElo: eloByPlayer[id]?.exitElo ?? profiles[id]?.elo_rating ?? 1000,
    }))
    .sort((a, b) => a.rank - b.rank || b.eloDelta - a.eloDelta);

  // ── 9. Logo ─────────────────────────────────────────────────
  let logoSrc = "";
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoData = fs.readFileSync(logoPath);
    logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  } catch {
    // Logo not found — no image shown
  }

  // ── 10. Build HTML ──────────────────────────────────────────
  const sessionDate = fmtDate(session.date);
  const totalMatches = matches.length;
  const format = (session.format as string).toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Report – ${sessionDate}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --cyan: #06b6d4;
    --green: #22c55e;
    --red: #ef4444;
    --amber: #f59e0b;
    --ink: #0f172a;
    --muted: #64748b;
    --border: #e2e8f0;
    --bg: #f8fafc;
    --card: #ffffff;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--ink);
    font-size: 12px;
    line-height: 1.5;
  }

  .page {
    max-width: 680px;
    margin: 0 auto;
    padding: 24px 20px 40px;
  }

  /* ── Print button (hidden in print) ── */
  .print-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    background: var(--cyan);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(6,182,212,0.4);
  }
  .print-btn:hover { opacity: 0.9; }

  @media print {
    .print-btn { display: none !important; }
    body { background: white; }
    .card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
    .page { padding: 12px 12px 20px; max-width: 100%; }
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: var(--ink);
    border-radius: 16px;
    margin-bottom: 18px;
    color: white;
  }
  .header-logo {
    width: 44px;
    height: 44px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .header-logo-placeholder {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, #06b6d4, #3b82f6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 18px;
    color: white;
    flex-shrink: 0;
  }
  .header-divider {
    width: 1px;
    height: 36px;
    background: rgba(255,255,255,0.15);
    flex-shrink: 0;
  }
  .header-info { flex: 1; }
  .header-title {
    font-size: 16px;
    font-weight: 900;
    color: white;
    letter-spacing: -0.3px;
  }
  .header-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    margin-top: 1px;
  }
  .header-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 0;
  }
  .pill {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.7);
  }

  /* ── Cards ── */
  .card {
    background: var(--card);
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .card-title {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
  }

  /* ── Unbeaten banner ── */
  .unbeaten-banner {
    background: linear-gradient(135deg, #052e16, #14532d);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .unbeaten-icon {
    font-size: 22px;
    flex-shrink: 0;
  }
  .unbeaten-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4ade80;
  }
  .unbeaten-names {
    font-size: 14px;
    font-weight: 900;
    color: white;
    margin-top: 1px;
  }

  /* ── Highlights grid ── */
  .highlights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .hl-card {
    background: var(--card);
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .hl-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 5px;
  }
  .hl-name {
    font-size: 13px;
    font-weight: 800;
    color: var(--ink);
  }
  .hl-detail {
    font-size: 10px;
    color: var(--muted);
    margin-top: 2px;
  }
  .hl-accent { color: var(--cyan); font-weight: 700; }
  .hl-accent-green { color: var(--green); font-weight: 700; }
  .hl-accent-amber { color: var(--amber); font-weight: 700; }
  .hl-accent-red { color: var(--red); font-weight: 700; }

  /* ── Pair form ── */
  .pair-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .pair-row:last-child { border-bottom: none; }
  .pair-avatar-stack {
    display: flex;
    flex-shrink: 0;
  }
  .avatar-circle {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #06b6d4, #3b82f6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 800;
    color: white;
    border: 2px solid white;
    margin-right: -6px;
    flex-shrink: 0;
  }
  .avatar-circle:last-child { margin-right: 0; }
  .pair-names {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    min-width: 100px;
    flex-shrink: 0;
  }
  .dots {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    flex: 1;
  }
  .dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 8px;
    font-weight: 800;
    color: white;
  }
  .dot.win  { background: var(--green); }
  .dot.loss { background: var(--red); }
  .pair-record {
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Standings table ── */
  .standings-table {
    width: 100%;
    border-collapse: collapse;
  }
  .standings-table th {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    padding: 0 6px 8px;
    border-bottom: 2px solid var(--border);
  }
  .standings-table th:first-child { text-align: left; padding-left: 0; }
  .standings-table th:not(:first-child) { text-align: right; }
  .standings-table td {
    padding: 9px 6px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  .standings-table tr:last-child td { border-bottom: none; }
  .standings-table td:first-child { padding-left: 0; }
  .standings-table td:not(:first-child) { text-align: right; }

  .player-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rank-num {
    font-size: 11px;
    font-weight: 800;
    color: var(--muted);
    width: 18px;
    flex-shrink: 0;
  }
  .player-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
  }
  .player-elo-sub {
    font-size: 10px;
    color: var(--muted);
  }

  .up  { color: var(--green); font-weight: 700; }
  .dn  { color: var(--red);   font-weight: 700; }
  .neu { color: var(--muted); font-weight: 700; }

  .td-num { font-size: 11px; font-weight: 700; color: var(--ink); }
  .td-pts { font-size: 11px; font-weight: 800; color: var(--cyan); }

  /* ── Section divider ── */
  .section-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 10px;
    margin-top: 2px;
  }
  .mover-card {
    background: linear-gradient(135deg, #0c4a6e, #0369a1);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .mover-icon { font-size: 22px; flex-shrink: 0; }
  .mover-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
  }
  .mover-name { font-size: 14px; font-weight: 900; color: white; margin-top: 2px; }
  .mover-detail { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 2px; }

  /* ── Footer ── */
  .footer {
    text-align: center;
    font-size: 10px;
    color: var(--muted);
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">📄 Save as PDF</button>

<div class="page">

  <!-- HEADER -->
  <div class="header">
    ${logoSrc
      ? `<img src="${logoSrc}" class="header-logo" alt="Logo" />`
      : `<div class="header-logo-placeholder">P</div>`
    }
    <div class="header-divider"></div>
    <div class="header-info">
      <div class="header-title">Padel by Chubbs</div>
      <div class="header-sub">Session Report</div>
    </div>
    <div style="text-align:right; flex-shrink:0;">
      <div style="font-size:11px;font-weight:700;color:white;">${sessionDate}</div>
      <div class="header-pills" style="justify-content:flex-end;margin-top:4px;">
        <span class="pill">${format}</span>
        <span class="pill">${playerIds.length} Players</span>
        <span class="pill">${totalMatches} Matches</span>
      </div>
    </div>
  </div>

  <!-- UNBEATEN BANNER (only if someone went unbeaten) -->
  ${unbeaten.length > 0 ? `
  <div class="unbeaten-banner">
    <div class="unbeaten-icon">🏅</div>
    <div>
      <div class="unbeaten-label">Unbeaten Today</div>
      <div class="unbeaten-names">${unbeaten.join(" · ")}</div>
    </div>
  </div>
  ` : ""}

  <!-- HIGHLIGHTS GRID -->
  <div class="highlights-grid">
    ${mvp ? `
    <div class="hl-card">
      <div class="hl-label">🏆 MVP</div>
      <div class="hl-name">${mvp.name.split(" ")[0]}</div>
      <div class="hl-detail"><span class="hl-accent-green">${wl[mvp.id]?.wins ?? 0} wins</span> · ${wl[mvp.id]?.losses ?? 0} losses</div>
    </div>
    ` : ""}
    ${bestRatePlayer ? `
    <div class="hl-card">
      <div class="hl-label">📈 Best Win Rate</div>
      <div class="hl-name">${bestRatePlayer.name.split(" ")[0]}</div>
      <div class="hl-detail"><span class="hl-accent-green">${Math.round((wl[bestRatePlayer.id].wins / (wl[bestRatePlayer.id].wins + wl[bestRatePlayer.id].losses)) * 100)}%</span> · ${wl[bestRatePlayer.id].wins}W ${wl[bestRatePlayer.id].losses}L</div>
    </div>
    ` : ""}
    ${streakTeamNames && maxStreak > 0 ? `
    <div class="hl-card">
      <div class="hl-label">🔥 Win Streak</div>
      <div class="hl-name">${streakTeamNames.join(" & ")}</div>
      <div class="hl-detail"><span class="hl-accent-amber">${maxStreak} in a row</span> this session</div>
    </div>
    ` : ""}
    ${dominantMatch ? `
    <div class="hl-card">
      <div class="hl-label">💪 Most Dominant</div>
      <div class="hl-name">${(dominantMatch.winner_team === "a" ? dominantMatch.team_a : dominantMatch.team_b).map((id: string) => profiles[id]?.name?.split(" ")[0] ?? "?").join(" & ")}</div>
      <div class="hl-detail">Won <span class="hl-accent">${dominantScore}</span></div>
    </div>
    ` : ""}
    ${worstLuck ? `
    <div class="hl-card">
      <div class="hl-label">😤 Worst Luck</div>
      <div class="hl-name">${worstLuck.name.split(" ")[0]}</div>
      <div class="hl-detail"><span class="hl-accent-red">${wl[worstLuck.id]?.losses ?? 0} losses</span> · ${wl[worstLuck.id]?.wins ?? 0} wins</div>
    </div>
    ` : ""}
  </div>

  <!-- PAIR FORM -->
  ${pairs.length > 0 ? `
  <div class="card">
    <div class="card-title">Pair Form</div>
    ${pairs.map(pair => {
      const [a, b] = pair.ids;
      const nameA = profiles[a]?.name?.split(" ")[0] ?? "?";
      const nameB = profiles[b]?.name?.split(" ")[0] ?? "?";
      const wins   = pair.results.filter(Boolean).length;
      const losses = pair.results.length - wins;
      return `
      <div class="pair-row">
        <div class="pair-avatar-stack">
          <div class="avatar-circle">${initials(profiles[a]?.name ?? "?")}</div>
          <div class="avatar-circle">${initials(profiles[b]?.name ?? "?")}</div>
        </div>
        <div class="pair-names">${nameA} &amp; ${nameB}</div>
        <div class="dots">${pair.results.map(r => dot(r)).join("")}</div>
        <div class="pair-record">${wins}W ${losses}L</div>
      </div>`;
    }).join("")}
  </div>
  ` : ""}

  <!-- BIGGEST MOVER -->
  ${biggestMover ? `
  <div class="mover-card">
    <div class="mover-icon">⚡</div>
    <div>
      <div class="mover-label">Biggest ELO Mover</div>
      <div class="mover-name">${biggestMover.name}</div>
      <div class="mover-detail">+${eloByPlayer[biggestMover.id]?.delta ?? 0} ELO this session · now ${eloByPlayer[biggestMover.id]?.exitElo ?? biggestMover.elo_rating}</div>
    </div>
  </div>
  ` : ""}

  <!-- STANDINGS -->
  <div class="card">
    <div class="card-title">Session Standings</div>
    <table class="standings-table">
      <thead>
        <tr>
          <th>Player</th>
          <th>W</th>
          <th>L</th>
          <th>ELO Δ</th>
          <th>Pts Today</th>
          <th>Total Pts</th>
          <th>ELO</th>
        </tr>
      </thead>
      <tbody>
        ${standings.map(p => `
        <tr>
          <td>
            <div class="player-cell">
              <div class="rank-num">#${p.rank}</div>
              <div>
                <div class="player-name">${p.name}</div>
              </div>
            </div>
          </td>
          <td class="td-num" style="color:var(--green)">${p.wins}</td>
          <td class="td-num" style="color:var(--red)">${p.losses}</td>
          <td>${eloArrow(p.eloDelta)}</td>
          <td class="td-pts">+${p.ptsToday}</td>
          <td class="td-num">${p.totalPts}</td>
          <td class="td-num">${p.currentElo}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <div class="footer">Generated by Padel by Chubbs · ${sessionDate}</div>

</div>

<script>
  // Auto-print is off — user presses the button or Ctrl+P
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
