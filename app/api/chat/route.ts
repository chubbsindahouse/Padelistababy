import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Intent classifier ─────────────────────────────────────────────────────────
// Decide which Supabase tables to query based on keywords in the question.

type Intent = "leaderboard" | "matches" | "sessions" | "achievements" | "general";

function classifyIntent(q: string): Intent[] {
  const s = q.toLowerCase();

  const intents: Intent[] = [];

  const leaderboardKw = ["leaderboard", "rank", "ranking", "top", "best", "worst", "points", "pts", "elo", "rating", "score", "standings"];
  const matchesKw     = ["match", "matches", "game", "games", "win", "won", "loss", "lost", "beat", "played", "record", "vs", "versus", "head to head", "h2h", "partnership", "pair", "partner", "team"];
  const sessionsKw    = ["session", "sessions", "last session", "recent session", "latest session", "when", "date", "how many sessions"];
  const achievementsKw = ["badge", "badges", "achievement", "achievements", "award", "unlock", "earned", "trophy"];

  if (leaderboardKw.some((k) => s.includes(k)))   intents.push("leaderboard");
  if (matchesKw.some((k) => s.includes(k)))        intents.push("matches");
  if (sessionsKw.some((k) => s.includes(k)))       intents.push("sessions");
  if (achievementsKw.some((k) => s.includes(k)))  intents.push("achievements");

  return intents.length > 0 ? intents : ["general"];
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchContext(question: string): Promise<string> {
  const db      = createAdminClient();
  const intents = classifyIntent(question);
  const parts: string[] = [];

  // Always fetch a minimal player list for name resolution
  const { data: profiles } = await db
    .from("profiles")
    .select("id, name, elo_rating, total_points")
    .order("total_points", { ascending: false })
    .limit(50);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name as string]));

  if (intents.includes("leaderboard") || intents.includes("general")) {
    const rows = (profiles ?? []).map((p, i) => (
      `${i + 1}. ${p.name} — ${p.total_points} pts, ELO ${p.elo_rating}`
    ));
    parts.push(`LEADERBOARD (sorted by points):\n${rows.join("\n")}`);
  }

  if (intents.includes("matches")) {
    const { data: matches } = await db
      .from("matches")
      .select("team_a, team_b, winner_team, session_id, created_at")
      .not("winner_team", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (matches?.length) {
      const rows = matches.map((m) => {
        const teamA = (m.team_a as string[]).map((id) => profileMap.get(id) ?? id).join(" & ");
        const teamB = (m.team_b as string[]).map((id) => profileMap.get(id) ?? id).join(" & ");
        const winner = m.winner_team === "a" ? teamA : teamB;
        return `${teamA} vs ${teamB} → winner: ${winner}`;
      });
      parts.push(`RECENT MATCHES (latest 50):\n${rows.join("\n")}`);
    }
  }

  if (intents.includes("sessions")) {
    const { data: sessions } = await db
      .from("sessions")
      .select("id, date, format, winner_stays_on, is_active, ended_at")
      .order("date", { ascending: false })
      .limit(50);

    if (sessions?.length) {
      const rows = sessions.map((s) => (
        `${s.date} | ${s.format.toUpperCase()}${s.winner_stays_on ? " WSO" : ""} | ${s.is_active ? "ACTIVE" : "ended"}`
      ));
      parts.push(`SESSIONS (latest 50):\n${rows.join("\n")}`);
    }
  }

  if (intents.includes("achievements")) {
    const { data: achievements } = await db
      .from("achievements")
      .select("player_id, badge_key, unlocked_at")
      .order("unlocked_at", { ascending: false })
      .limit(50);

    if (achievements?.length) {
      const rows = achievements.map((a) => (
        `${profileMap.get(a.player_id) ?? a.player_id}: ${a.badge_key} (${a.unlocked_at.slice(0, 10)})`
      ));
      parts.push(`ACHIEVEMENTS (latest 50):\n${rows.join("\n")}`);
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
Answer questions using ONLY the data provided below. Keep answers short and friendly (2–4 sentences max).
If the data doesn't contain enough info to answer, say so briefly.
Never make up stats. Use player first names where possible.

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
