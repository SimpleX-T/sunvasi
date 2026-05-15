import { headers as nextHeaders } from "next/headers";
import { readUserFromHeaders, type PrivyVerifiedUser } from "./privy";
import { supabaseAdmin } from "./supabase";
import type { ProfileRow } from "./supabase";

/* ---------------------------------------------------------------------------
 * Server-side current-user resolver for App Router server components and API
 * routes. Returns null when no Privy token is present (anonymous request).
 * ------------------------------------------------------------------------ */

export async function getCurrentUser(): Promise<PrivyVerifiedUser | null> {
  const h = await nextHeaders();
  return readUserFromHeaders(h as unknown as Headers);
}

export async function requireUser(): Promise<PrivyVerifiedUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.did)
      .maybeSingle<ProfileRow>();
    return data ?? null;
  } catch {
    return null;
  }
}
