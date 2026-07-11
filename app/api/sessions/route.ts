import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getCurrentPlayerId } from "@/lib/player-auth";

/** Returns true if the request is from an admin or a logged-in player */
async function isAuthenticated(): Promise<boolean> {
  if (await isAdmin()) return true;
  const playerId = await getCurrentPlayerId();
  return !!playerId;
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*, session_players(player_id)")
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { format, winner_stays_on, three_win_rule, players, mode, match_count, fixtures } = await req.json();

    if (!players || players.length < 4) {
      return NextResponse.json({ error: "At least 4 players required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Attach to the currently active season
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        format,
        winner_stays_on: winner_stays_on ?? false,
        three_win_rule: three_win_rule ?? false,
        is_active: true,
        season_id: activeSeason?.id ?? null,
        mode: mode ?? "live",
        match_count: match_count ?? null,
      })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    const { error: playersError } = await supabase
      .from("session_players")
      .insert(players.map((pid: string) => ({ session_id: session.id, player_id: pid })));

    if (playersError) {
      await supabase.from("sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    // For round robin: pre-create all fixtures as matches with no winner yet
    if (mode === "round_robin" && Array.isArray(fixtures) && fixtures.length > 0) {
      const { error: fixturesError } = await supabase
        .from("matches")
        .insert(
          fixtures.map((f: { team_a: string[]; team_b: string[] }, i: number) => ({
            session_id: session.id,
            team_a: f.team_a,
            team_b: f.team_b,
            match_order: i,
            consecutive_wins: 0,
          }))
        );

      if (fixturesError) {
        await supabase.from("sessions").delete().eq("id", session.id);
        return NextResponse.json({ error: fixturesError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ id: session.id });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
