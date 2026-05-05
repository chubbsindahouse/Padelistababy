import { NextRequest, NextResponse } from "next/server";
import { validateAdminCredentials, createAdminToken, COOKIE_NAME } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!validateAdminCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createAdminToken();
  const res   = NextResponse.json({ ok: true });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7, // 7 days
    secure:   process.env.NODE_ENV === "production",
  });

  return res;
}
