/**
 * Player auth helpers.
 * Uses Web Crypto API (crypto.subtle) — works in Edge runtime and Node.js.
 * Passwords are hashed with PBKDF2-SHA256 (100 000 iterations).
 */

export const PLAYER_COOKIE = "padel_player";

const SECRET =
  process.env.PLAYER_COOKIE_SECRET ?? "padel-player-cookie-secret-change-me";

function enc(s: string) {
  return new TextEncoder().encode(s);
}

// ── HMAC signing (for session cookies) ──────────────────────────────────────

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw", enc(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign", "verify"]
  );
}

async function hmacSign(payload: string): Promise<string> {
  const key = await getHmacKey();
  const sig  = await crypto.subtle.sign("HMAC", key, enc(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Password hashing (PBKDF2) ─────────────────────────────────────────────

/**
 * Hash a password. Uses the player's UUID as salt so no separate salt column
 * is needed. Call this before storing or verifying.
 */
export async function hashPassword(password: string, playerId: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc(password),
    { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc(playerId), iterations: 100_000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Player session tokens ─────────────────────────────────────────────────

export async function createPlayerToken(playerId: string): Promise<string> {
  const ts      = Date.now().toString();
  const payload = `${playerId}|${ts}`;
  const sig     = await hmacSign(payload);
  return `${payload}|${sig}`;
}

/** Returns the playerId if the token is valid, null otherwise. */
export async function verifyPlayerToken(token: string): Promise<string | null> {
  try {
    const parts = token.split("|");
    if (parts.length !== 3) return null;
    const [playerId, ts, sig] = parts;
    const expected = await hmacSign(`${playerId}|${ts}`);
    return sig === expected ? playerId : null;
  } catch {
    return null;
  }
}

/** Returns the current player's ID from the cookie, or null. */
export async function getCurrentPlayerId(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const token = store.get(PLAYER_COOKIE)?.value;
    if (!token) return null;
    return verifyPlayerToken(token);
  } catch {
    return null;
  }
}
