import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
 * Integration health checks. Each result has:
 *   - status: "ok" | "warn" | "fail" | "unconfigured"
 *   - latency_ms (if a network call was made)
 *   - detail: short human string
 *   - hint?: how to fix
 * ------------------------------------------------------------------------ */

type Status = "ok" | "warn" | "fail" | "unconfigured";

interface CheckResult {
  status: Status;
  latency_ms?: number;
  detail: string;
  hint?: string;
  config_present: boolean;
}

interface ReportShape {
  generated_at: string;
  checks: Record<string, CheckResult>;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, CheckResult> = {};

  checks.supabase = await checkSupabase();
  checks.privy = checkPrivy();
  checks.privy_stellar = await checkPrivyStellar();
  checks.cloudinary = checkCloudinary();
  checks.gemini = await checkGemini();
  checks.resend = await checkResend();
  checks.trustless_work = await checkTrustlessWork();
  checks.stellar_rpc = await checkStellarRpc();

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    checks,
  } satisfies ReportShape);
}

/* ------------------------------------------------------------------------- */

async function checkSupabase(): Promise<CheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    return {
      status: "unconfigured",
      detail: "URL or service-role key missing.",
      hint: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      config_present: false,
    };
  }
  const started = Date.now();
  try {
    // Hit the REST root with the service role — also confirms the contracts
    // table exists, since PostgREST 404s with `PGRST205` if it doesn't.
    const res = await fetch(`${url}/rest/v1/contracts?select=count`, {
      method: "GET",
      headers: { apikey: service, Authorization: `Bearer ${service}`, Prefer: "count=exact" },
      cache: "no-store",
    });
    const latency = Date.now() - started;
    if (res.ok) {
      return {
        status: "ok",
        latency_ms: latency,
        detail: "Reachable and the contracts table exists.",
        config_present: true,
      };
    }
    const body = await res.text();
    if (res.status === 404 || body.includes("PGRST205")) {
      return {
        status: "fail",
        latency_ms: latency,
        detail: "Reachable but the contracts table is missing.",
        hint: "Paste db/schema.sql into the Supabase SQL Editor and run it.",
        config_present: true,
      };
    }
    return {
      status: "fail",
      latency_ms: latency,
      detail: `Unexpected response: ${res.status}.`,
      hint: body.slice(0, 200),
      config_present: true,
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - started,
      detail: e instanceof Error ? e.message : "Network error.",
      hint: "Project may be paused, URL may be wrong, or DNS is failing.",
      config_present: true,
    };
  }
}

function checkPrivy(): CheckResult {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId) {
    return {
      status: "unconfigured",
      detail: "App ID missing.",
      hint: "Set NEXT_PUBLIC_PRIVY_APP_ID (and PRIVY_APP_SECRET for server-side verification).",
      config_present: false,
    };
  }
  if (!secret) {
    return {
      status: "warn",
      detail: "App ID set, but secret missing.",
      hint: "Client-side login will work; server-side token verification won't.",
      config_present: false,
    };
  }
  return {
    status: "ok",
    detail: "App ID + secret configured. Client login flow is live.",
    config_present: true,
  };
}

async function checkPrivyStellar(): Promise<CheckResult> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) {
    return {
      status: "unconfigured",
      detail: "PRIVY_APP_SECRET missing — needed for server-side Stellar wallet provisioning.",
      hint: "Set PRIVY_APP_SECRET in .env.local to enable on-chain funding.",
      config_present: false,
    };
  }
  const started = Date.now();
  try {
    const basic = Buffer.from(`${appId}:${secret}`).toString("base64");
    // Cheap probe: list app metadata. If Stellar isn't enabled on the app
    // the create-wallet call would later 400; we surface that hint here.
    const res = await fetch(`https://api.privy.io/v1/apps/${appId}`, {
      method: "GET",
      headers: { "privy-app-id": appId, Authorization: `Basic ${basic}` },
      cache: "no-store",
    });
    const latency = Date.now() - started;
    if (res.status === 401 || res.status === 403) {
      return {
        status: "fail",
        latency_ms: latency,
        detail: "Privy rejected auth.",
        hint: "Verify NEXT_PUBLIC_PRIVY_APP_ID + PRIVY_APP_SECRET pair.",
        config_present: true,
      };
    }
    if (!res.ok) {
      return {
        status: "fail",
        latency_ms: latency,
        detail: `Privy returned ${res.status}.`,
        config_present: true,
      };
    }
    return {
      status: "ok",
      latency_ms: latency,
      detail:
        "Privy server creds valid. Stellar wallets will provision on first profile sync (verify chain enabled in dashboard if creation fails).",
      config_present: true,
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - started,
      detail: e instanceof Error ? e.message : "Network error.",
      config_present: true,
    };
  }
}

function checkCloudinary(): CheckResult {
  const cn = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cn || !key || !secret) {
    return {
      status: "unconfigured",
      detail: "Cloudinary credentials missing.",
      hint: "Set CLOUD_NAME + API_KEY + API_SECRET. Without these, deliverable + avatar uploads are blocked.",
      config_present: false,
    };
  }
  return {
    status: "ok",
    detail: `Signed uploads ready · cloud: ${cn}`,
    config_present: true,
  };
}

async function checkGemini(): Promise<CheckResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      status: "unconfigured",
      detail: "GEMINI_API_KEY missing.",
      hint: "Without this, the arbitrator and 'Suggest milestones' fall back to a hardcoded skeleton.",
      config_present: false,
    };
  }
  const started = Date.now();
  try {
    // List models is a cheap probe.
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      method: "GET",
      headers: { "x-goog-api-key": key },
      cache: "no-store",
    });
    const latency = Date.now() - started;
    if (res.ok) {
      return {
        status: "ok",
        latency_ms: latency,
        detail: `API key valid · model: ${process.env.GEMINI_MODEL ?? "gemini-3-pro-preview"}`,
        config_present: true,
      };
    }
    return {
      status: "fail",
      latency_ms: latency,
      detail: `Gemini returned ${res.status}.`,
      hint: "Key may be revoked, quota exhausted, or region-restricted.",
      config_present: true,
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - started,
      detail: e instanceof Error ? e.message : "Network error.",
      config_present: true,
    };
  }
}

async function checkResend(): Promise<CheckResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return {
      status: "unconfigured",
      detail: "RESEND_API_KEY missing.",
      hint: "Without this, 'Send invitation' opens the user's local mail client instead of emailing the server-side.",
      config_present: false,
    };
  }
  const started = Date.now();
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const latency = Date.now() - started;
    if (res.ok) {
      return {
        status: "ok",
        latency_ms: latency,
        detail: "Resend key valid. Outbound email is wired.",
        config_present: true,
      };
    }
    return {
      status: "fail",
      latency_ms: latency,
      detail: `Resend returned ${res.status}.`,
      hint: "Regenerate the key in the Resend dashboard.",
      config_present: true,
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - started,
      detail: e instanceof Error ? e.message : "Network error.",
      config_present: true,
    };
  }
}

async function checkTrustlessWork(): Promise<CheckResult> {
  const key = process.env.TRUSTLESS_WORK_API_KEY;
  const network = process.env.TRUSTLESS_WORK_NETWORK ?? "testnet";
  if (!key) {
    return {
      status: "unconfigured",
      detail: "TRUSTLESS_WORK_API_KEY missing.",
      hint: "Without this, funding runs in mock mode — escrows are simulated locally and no Stellar transactions occur.",
      config_present: false,
    };
  }
  const base =
    network === "mainnet" ? "https://api.trustlesswork.com" : "https://dev.api.trustlesswork.com";
  const started = Date.now();
  try {
    // Indexer GET is the cheapest auth-validating probe. A nonexistent ID
    // gives us a structured 404 — that's "auth + network are fine".
    const res = await fetch(
      `${base}/indexer/get-escrow-by-contract-id?contractId=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH`,
      {
        method: "GET",
        headers: { "x-api-key": key },
        cache: "no-store",
      },
    );
    const latency = Date.now() - started;
    if (res.status === 401 || res.status === 403) {
      return {
        status: "fail",
        latency_ms: latency,
        detail: `Auth rejected (${res.status}).`,
        hint: "Generate a fresh API key at dapp.trustlesswork.com → Settings → API Keys.",
        config_present: true,
      };
    }
    if (res.status >= 500) {
      return {
        status: "fail",
        latency_ms: latency,
        detail: `Trustless Work upstream error (${res.status}).`,
        hint: "TW may be down — try again shortly.",
        config_present: true,
      };
    }
    return {
      status: "ok",
      latency_ms: latency,
      detail: `Reachable on ${network} · base: ${base}`,
      config_present: true,
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - started,
      detail: e instanceof Error ? e.message : "Network error.",
      hint: "Check TRUSTLESS_WORK_NETWORK and your outbound network.",
      config_present: true,
    };
  }
}

async function checkStellarRpc(): Promise<CheckResult> {
  const rpc = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const started = Date.now();
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      cache: "no-store",
    });
    const latency = Date.now() - started;
    if (!res.ok) {
      return {
        status: "fail",
        latency_ms: latency,
        detail: `Soroban RPC ${res.status}.`,
        config_present: true,
      };
    }
    return {
      status: "ok",
      latency_ms: latency,
      detail: `Soroban RPC healthy · ${rpc}`,
      config_present: true,
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - started,
      detail: e instanceof Error ? e.message : "Network error.",
      config_present: true,
    };
  }
}
