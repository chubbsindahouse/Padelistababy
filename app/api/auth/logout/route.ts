import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin";
import { PLAYER_COOKIE } from "@/lib/player-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME,    "", { maxAge: 0, path: "/" });
  res.cookies.set(PLAYER_COOKIE,  "", { maxAge: 0, path: "/" });
  return res;
}
