import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/leaderboard?season_id=X
// Returns past-season leaderboard using snapshots (final ELO, points, rank, W/L).
export async function GET(req: NextRequest) {
  const seasonId = req.nextUrl.searchParams.get("season_id");
  const admin    = createAdminClient();

  if (!seasonId) {
    return NextResponse.json({ error: "season_id required" }, { status: 400 });
  }

  const { data: snapshots, error } = await admin
    .from("season_snapshots")
    .select("*, profiles(id, name, avatar_url)")
    .eq("season_id", seasonId)
    .order("final_rank", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(snapshots ?? []);
}
