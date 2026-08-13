import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "cmc_teams";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h — reset overnight

function secret(): string {
  const s = process.env.AUTH_COOKIE_SECRET;
  if (!s) throw new Error("AUTH_COOKIE_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Server: verify the shared teams password and set the cookie. */
export function loginWithTeamsPin(pin: string): boolean {
  const expected = process.env.TEAMS_PIN;
  if (!expected) throw new Error("TEAMS_PIN is not set");
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

export function logoutTeams() {
  cookies().delete(COOKIE_NAME);
}

/** Server: is the current request allowed to edit teams? */
export function isTeamsEditor(): boolean {
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

/** Throw if not allowed to edit teams. */
export function requireTeamsEditor() {
  if (!isTeamsEditor()) throw new Error("UNAUTHORIZED");
}
