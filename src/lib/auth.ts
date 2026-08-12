import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "cmc_scorer";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h — reset overnight

function secret(): string {
  const s = process.env.SCORER_COOKIE_SECRET;
  if (!s) throw new Error("SCORER_COOKIE_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Server: verify the shared PIN and set the cookie. */
export function loginWithPin(pin: string): boolean {
  const expected = process.env.SCORER_PIN;
  if (!expected) throw new Error("SCORER_PIN is not set");
  if (!pin || pin !== expected) return false;

  const payload = `v1.${Date.now()}`;
  const value = `${payload}.${sign(payload)}`;
  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
  });
  return true;
}

export function logout() {
  cookies().delete(COOKIE_NAME);
}

/** Server: is the current request a scorer? */
export function isScorer(): boolean {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [payload, sig] = raw.split(/\.(?=[^.]+$)/); // split on last dot
  if (!payload || !sig) return false;
  try {
    const expected = sign(payload);
    // constant-time compare
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Throw if not a scorer. */
export function requireScorer() {
  if (!isScorer()) throw new Error("UNAUTHORIZED");
}

