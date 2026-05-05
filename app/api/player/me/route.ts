import { NextResponse } from "next/server";
import { getCurrentPlayerId } from "@/lib/player-auth";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();

  // Admin acting as themselves
  if (await isAdmin()) {
    return NextResponse.json({ role: "admin" });
  }

  const playerId = await getCurrentPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url, elo_rating, total_points")
    .eq("id", playerId)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json({ role: "player", profile });
}
