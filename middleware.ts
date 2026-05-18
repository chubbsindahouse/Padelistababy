import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminToken, COOKIE_NAME as ADMIN_COOKIE } from "@/lib/admin";
import { verifyPlayerToken, PLAYER_COOKIE } from "@/lib/player-auth";

// Routes only the admin can access
const ADMIN_ONLY = ["/admin", "/api/admin"];

// Routes that need a player OR admin session (any logged-in user)
const PLAYER_ROUTES = ["/profile", "/api/player", "/sessions/new", "/api/sessions"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const adminToken  = request.cookies.get(ADMIN_COOKIE)?.value;
  const playerToken = request.cookies.get(PLAYER_COOKIE)?.value;

  const [isAdmin, playerId] = await Promise.all([
    adminToken  ? verifyAdminToken(adminToken)  : Promise.resolve(false),
    playerToken ? verifyPlayerToken(playerToken) : Promise.resolve(null),
  ]);
  const isPlayer = !!playerId;

  // ── Admin-only routes ──
  if (ADMIN_ONLY.some((r) => pathname.startsWith(r))) {
    if (!isAdmin) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Admin access required" }, { status: 401 });
      }
      // If already logged in as a player, send them home — don't loop through /login
      const url = request.nextUrl.clone();
      url.pathname = isPlayer ? "/home" : "/login";
      if (!isPlayer) url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── Player (or admin) routes ──
  if (PLAYER_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!isAdmin && !isPlayer) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("tab", "player");
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── Already logged in — redirect away from /login ──
  if (pathname === "/login") {
    if (isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    if (isPlayer) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
