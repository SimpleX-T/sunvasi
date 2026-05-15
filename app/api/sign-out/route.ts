import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
 * Server-side cookie sweep on sign-out. Privy's client SDK handles its own
 * local state via `usePrivy().logout()`; this route clears the cookie-set
 * tokens so the next server render sees an anonymous user.
 * ------------------------------------------------------------------------ */

const COOKIES_TO_CLEAR = [
  "privy-token",
  "privy-id-token",
  "privy-refresh-token",
  "privy-session",
];

export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of COOKIES_TO_CLEAR) {
    res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
  return res;
}
