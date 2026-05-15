import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------------------------------------------------------------------------
 * Database row types — kept in this file for proximity to the schema.
 * ------------------------------------------------------------------------ */

export type ContractStatus =
  | "draft"
  | "awaiting_funding"
  | "active"
  | "completed"
  | "disputed"
  | "resolved"
  | "cancelled";

export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "submitted"
  | "approved"
  | "disputed"
  | "released"
  | "refunded";

export type DisputeStatus =
  | "open"
  | "evidence_collection"
  | "arbitrating"
  | "resolved"
  | "escalated";

export type ProfileRole = "freelancer" | "client" | "both";

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: ProfileRole;
  skills: string[] | null;
  hourly_rate_usdc: number | null;
  portfolio_links: Array<{ label: string; url: string }> | null;
  payout_address: string | null;
  stellar_wallet_id: string | null;
  country: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractVisibility = "public" | "restricted";

export interface ContractRow {
  id: string;
  short_id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  client_email: string | null;
  freelancer_id: string | null;
  total_amount_usdc: number;
  currency: string;
  status: ContractStatus;
  escrow_id: string | null;
  escrow_address: string | null;
  escrow_network: string | null;
  auto_release_days: number;
  platform_fee_percent: number;
  visibility: ContractVisibility;
  invitee_emails: string[];
  created_at: string;
  funded_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface MilestoneRow {
  id: string;
  contract_id: string;
  position: number;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  amount_usdc: number;
  status: MilestoneStatus;
  deliverable_files: DeliverableFile[] | null;
  deliverable_links: DeliverableLink[] | null;
  deliverable_note: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  released_at: string | null;
  auto_release_at: string | null;
  tw_milestone_index: number | null;
}

export interface DeliverableFile {
  cloudinary_url: string;
  type: string;
  size: number;
  filename: string;
  description?: string;
}

export interface DeliverableLink {
  label: string;
  url: string;
}

export interface DisputeRow {
  id: string;
  milestone_id: string;
  contract_id: string;
  filed_by: string | null;
  filed_at: string;
  client_evidence: ClientEvidence;
  freelancer_evidence: FreelancerEvidence;
  status: DisputeStatus;
  resolved_at: string | null;
}

export interface ClientEvidence {
  promised?: string;
  delivered?: string;
  gap?: string;
  files?: DeliverableFile[];
}

export interface FreelancerEvidence {
  rebuttal?: string;
  delivered?: string;
  files?: DeliverableFile[];
}

export interface VerdictRow {
  id: string;
  dispute_id: string;
  release_percentage: number;
  party_favored: "client" | "freelancer" | "split";
  reasoning: string;
  confidence: "high" | "medium" | "low" | "insufficient";
  tool_call_log: ToolCallLogEntry[];
  arbitrator_version: string;
  verdict_hash: string | null;
  created_at: string;
}

export interface ToolCallLogEntry {
  ts: string;
  name: string;
  args: Record<string, unknown>;
  result_summary: string;
}

export interface ClarificationRow {
  id: string;
  dispute_id: string;
  party: "client" | "freelancer";
  question: string;
  response: string | null;
  asked_at: string;
  responded_at: string | null;
  timed_out: boolean;
}

export interface ActivityRow {
  id: string;
  contract_id: string;
  milestone_id: string | null;
  actor_id: string | null;
  type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/* ---------------------------------------------------------------------------
 * Client factories. We expose two shapes:
 *   - browser/anon client (read-only public data)
 *   - server admin client (service-role, never expose to browser)
 * ------------------------------------------------------------------------ */

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function getSupabaseUrl(): string {
  const v = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return v;
}

let _browser: SupabaseClient | undefined;
export function supabaseBrowser(): SupabaseClient {
  if (_browser) return _browser;
  const url = getSupabaseUrl();
  const key =
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new) or NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy).",
    );
  }
  _browser = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _browser;
}

/** Server-only — never import from a "use client" file. */
export function supabaseAdmin(): SupabaseClient {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const service = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) {
    throw new Error("Supabase admin env vars are missing (URL / SERVICE_ROLE_KEY).");
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    readEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      (readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
        readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
  );
}
