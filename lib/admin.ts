/**
 * Admin auth helpers.
 * Uses the Web Crypto API (crypto.subtle) so this module works in
 * both the Next.js Edge runtime (middleware) and Node.js (API routes).
 */

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin12345";
export const COOKIE_NAME = "padel_admin";

const SECRET =
  process.env.ADMIN_COOKIE_SECRET ?? "padel-admin-cookie-secret-change-me";

function textEncode(s: string) {
  return new TextEncoder().encode(s);
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacSign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, textEncode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function validateAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export async function createAdminToken(): Promise<string> {
  const ts = Date.now().toString();
  const payload = `${ADMIN_USERNAME}|${ts}`;
  const sig = await hmacSign(payload);
  return `${payload}|${sig}`;
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const parts = token.split("|");
    if (parts.length !== 3) return false;
    const [user, ts, sig] = parts;
    const expectedSig = await hmacSign(`${user}|${ts}`);
    return user === ADMIN_USERNAME && sig === expectedSig;
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return false;
    return verifyAdminToken(token);
  } catch {
    return false;
  }
}
