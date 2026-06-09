import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Intent classifier ─────────────────────────────────────────────────────────

type Intent = "leaderboard" | "matches" | "sessions" | "achievements" | "general";

function classifyIntent(q: string): Intent[] {
  const s = q.toLowerCase();
  const intents: Intent[] = [];

  const leaderboardKw  = ["leaderboard", "rank", "ranking", "top", "best", "worst", "points", "pts", "elo", "rating", "score", "standings"];
  const matchesKw      = ["match", "matches", "game", "games", "win", "won", "loss", "lost", "beat", "played", "record", "vs", "versus", "head to head", "h2h", "partnership", "pair", "partner", "team", "together", "most"];
  const sessionsKw     = ["session", "sessions", "last session", "recent session", "latest session", "when", "date", "how many sessions"];
  const achievementsKw = ["badge", "badges", "achievement", "achievements", "award", "unlock", "earned", "trophy"];

  if (leaderboardKw.some((k) => s.includes(k)))   intents.push("leaderboard");
  if (matchesKw.some((k) => s.includes(k)))        intents.push("matches");
  if (sessionsKw.some((k) => s.includes(k)))       intents.push("sessions");
  if (achievementsKw.some((k) => s.includes(k)))  intents.push("achievements");

  return intents.length > 0 ? intents : ["general"];
}

// ── Data fetcher ──────────────────────────────────────────────────────────────
// All aggregation happens here in JS — never ask the model to count raw rows.

async function fetchContext(question: string): Promise<string> {
  const db      = createAdminClient();
  const intents = classifyIntent(question);
  const parts: string[] = [];

  // Always fetch players for name resolution
  const { data: profiles } = await db
    .from("profiles")
    .select("id, name, elo_rating, total_points")
    .order("total_points", { ascending: false })
    .limit(50);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name as string]));
  const name = (id: string) => profileMap.get(id) ?? "Unknown";

  // ── Leaderboard ──
  if (intents.includes("leaderboard") || intents.includes("general")) {
    const rows = (profiles ?? []).map((p, i) =>
      `${i + 1}. ${p.name} — ${p.total_points} pts, ELO ${p.elo_rating}`
    );
    parts.push(`LEADERBOARD (ranked by points):\n${rows.join("\n")}`);
  }

  // ── Matches — pre-aggregated, never raw rows ──
  if (intents.includes("matches")) {
    const { data: allMatches } = await db
      .from("matches")
      .select("team_a, team_b, winner_team")
      .not("winner_team", "is", null)
      .limit(500); // fetch all to aggregate accurately

    if (allMatches?.length) {
      // Per-player record
      const playerRecord: Record<string, { wins: number; losses: number }> = {};
      // Partnership stats: key = "NameA & NameB" sorted
      const partnerStats: Record<string, { wins: number; total: number }> = {};
      // Head-to-head: key = "NameA vs NameB" sorted
      const h2h: Record<string, { winsA: number; winsB: number }> = {};

      for (const m of allMatches) {
        const teamA = (m.team_a as string[]);
        const teamB = (m.team_b as string[]);
        const winnerIsA = m.winner_team === "a";

        // Player wins/losses
        teamA.forEach((id) => {
          if (!playerRecord[id]) playerRecord[id] = { wins: 0, losses: 0 };
          winnerIsA ? playerRecord[id].wins++ : playerRecord[id].losses++;
        });
        teamB.forEach((id) => {
          if (!playerRecord[id]) playerRecord[id] = { wins: 0, losses: 0 };
          winnerIsA ? playerRecord[id].losses++ : playerRecord[id].wins++;
        });

        // Partnership stats (within each team)
        for (const team of [teamA, teamB]) {
          const won = team === teamA ? winnerIsA : !winnerIsA;
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const key = [name(team[i]), name(team[j])].sort().join(" & ");
              if (!partnerStats[key]) partnerStats[key] = { wins: 0, total: 0 };
              partnerStats[key].total++;
              if (won) partnerStats[key].wins++;
            }
          }
        }

        // Head-to-head (every player on teamA vs every player on teamB)
        for (const idA of teamA) {
          for (const idB of teamB) {
            const [nA, nB] = [name(idA), name(idB)].sort();
            const key = `${nA} vs ${nB}`;
            if (!h2h[key]) h2h[key] = { winsA: 0, winsB: 0 };
            const aIsFirst = name(idA) === nA;
            if (winnerIsA) { aIsFirst ? h2h[key].winsA++ : h2h[key].winsB++; }
            else           { aIsFirst ? h2h[key].winsB++ : h2h[key].winsA++; }
          }
        }
      }

      // Player records
      const playerRows = Object.entries(playerRecord)
        .map(([id, r]) => {
          const total = r.wins + r.losses;
          const pct   = total > 0 ? Math.round((r.wins / total) * 100) : 0;
          return { name: name(id), wins: r.wins, losses: r.losses, total, pct };
        })
        .sort((a, b) => b.wins - a.wins)
        .map((r) => `${r.name}: ${r.wins}W ${r.losses}L (${r.total} matches, ${r.pct}% win rate)`);
      parts.push(`PLAYER MATCH RECORDS:\n${playerRows.join("\n")}`);

      // Partnership stats sorted by total matches played
      const partnerRows = Object.entries(partnerStats)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([pair, s]) => {
          const pct = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
          return `${pair}: ${s.total} matches together, ${s.wins}W ${s.total - s.wins}L (${pct}% win rate)`;
        });
      parts.push(`PARTNERSHIP STATS (sorted by matches played together):\n${partnerRows.join("\n")}`);

      // Top 20 H2H matchups
      const h2hRows = Object.entries(h2h)
        .sort((a, b) => (b[1].winsA + b[1].winsB) - (a[1].winsA + a[1].winsB))
        .slice(0, 20)
        .map(([pair, r]) => {
          const [nA, nB] = pair.split(" vs ");
          return `${nA} vs ${nB}: ${r.winsA}-${r.winsB}`;
        });
      parts.push(`HEAD-TO-HEAD RECORDS (top 20):\n${h2hRows.join("\n")}`);
    }
  }

  // ── Sessions ──
  if (intents.includes("sessions")) {
    const { data: sessions } = await db
      .from("sessions")
      .select("id, date, format, winner_stays_on, is_active")
      .order("date", { ascending: false })
      .limit(50);

    if (sessions?.length) {
      const rows = sessions.map((s) =>
        `${s.date} | ${s.format.toUpperCase()}${s.winner_stays_on ? " WSO" : ""} | ${s.is_active ? "ACTIVE" : "completed"}`
      );
      parts.push(`SESSIONS (${sessions.length} total, newest first):\n${rows.join("\n")}`);
    }
  }

  // ── Achievements ──
  if (intents.includes("achievements")) {
    const { data: achievements } = await db
      .from("achievements")
      .select("player_id, badge_key, unlocked_at")
      .order("unlocked_at", { ascending: false })
      .limit(50);

    if (achievements?.length) {
      // Count badges per player
      const badgeCounts: Record<string, string[]> = {};
      for (const a of achievements) {
        const n = name(a.player_id);
        if (!badgeCounts[n]) badgeCounts[n] = [];
        badgeCounts[n].push(a.badge_key);
      }
      const rows = Object.entries(badgeCounts)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([n, badges]) => `${n}: ${badges.join(", ")} (${badges.length} total)`);
      parts.push(`ACHIEVEMENTS PER PLAYER:\n${rows.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });
  }

  const { question } = await req.json().catch(() => ({}));
  if (!question || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }

  let context: string;
  try {
    context = await fetchContext(question);
  } catch (err) {
    console.error("Supabase fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch match data." }, { status: 500 });
  }

  const systemPrompt = `You are Padel Bot, a friendly stats assistant for a private padel group.
Answer questions using ONLY the pre-computed data provided below. All numbers are already calculated — do NOT recount or re-derive them.
Keep answers short and friendly (2–4 sentences max). Use player first names where possible.
If the answer is clearly in the data, state it directly. If not, say so briefly.

DATA:
${context}`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 250,
        temperature: 0.1, // low temperature = stick to the data, less creativity
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: question },
        ],
      }),
    });

    if (!groqRes.ok) {
      const body = await groqRes.text();
      console.error("Groq error:", body);
      return NextResponse.json({ error: "AI request failed." }, { status: 500 });
    }

    const data = await groqRes.json();
    const answer = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Groq fetch error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 500 });
  }
}
