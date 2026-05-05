import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashPassword, createPlayerToken, PLAYER_COOKIE } from "@/lib/player-auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, password_hash")
    .eq("username", username.trim().toLowerCase())
    .single();

  if (!profile || !profile.password_hash) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const hash = await hashPassword(password, profile.id);
  if (hash !== profile.password_hash) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await createPlayerToken(profile.id);
  const res   = NextResponse.json({ ok: true, playerId: profile.id });
  res.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 30, // 30 days
    secure:   process.env.NODE_ENV === "production",
  });
  return res;
}
