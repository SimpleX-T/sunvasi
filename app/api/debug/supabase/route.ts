import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
 * Diagnostic endpoint — bypasses supabase-js and hits the Supabase REST API
 * directly, so we can see exactly which layer is failing.
 *
 *   GET /api/debug/supabase            → checks /rest/v1/contracts read
 *   GET /api/debug/supabase?write=1    → also attempts a no-op write
 * ------------------------------------------------------------------------ */

interface UndiciCauseLike {
  code?: string;
  syscall?: string;
  hostname?: string;
  port?: number | string;
  message?: string;
}

function detail(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { message: String(err) };
  const e = err as { message?: string; name?: string; cause?: unknown };
  const out: Record<string, unknown> = { name: e.name, message: e.message };
  const c = e.cause as UndiciCauseLike | undefined;
  if (c && typeof c === "object") {
    out.cause = {
      code: c.code,
      syscall: c.syscall,
      hostname: c.hostname,
      port: c.port,
      message: c.message,
    };
  }
  return out;
}

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    return NextResponse.json({ ok: false, reason: "env_missing" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const tryWrite = searchParams.get("write") === "1";

  const start = Date.now();
  const out: Record<string, unknown> = {
    supabase_url: url,
    has_service_role: Boolean(service),
    read: null,
    write: null,
  };

  // 1. Read attempt — list 1 contract.
  try {
    const res = await fetch(`${url}/rest/v1/contracts?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
      },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // leave as text
    }
    out.read = {
      ok: res.ok,
      status: res.status,
      body,
      duration_ms: Date.now() - start,
    };
  } catch (e) {
    out.read = {
      ok: false,
      error: detail(e),
      duration_ms: Date.now() - start,
    };
  }

  // 2. Write attempt — insert + rollback via a non-permanent row.
  if (tryWrite) {
    const writeStart = Date.now();
    try {
      const res = await fetch(`${url}/rest/v1/contracts`, {
        method: "POST",
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          short_id: `DBG${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          title: "debug ping",
          client_email: "debug@sunvasi.local",
          total_amount_usdc: 1,
          auto_release_days: 7,
          status: "draft",
        }),
        cache: "no-store",
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        // leave as text
      }
      out.write = {
        ok: res.ok,
        status: res.status,
        body,
        duration_ms: Date.now() - writeStart,
      };
      // Clean up the debug row if it landed.
      if (res.ok && Array.isArray(body) && body[0]?.id) {
        await fetch(`${url}/rest/v1/contracts?id=eq.${body[0].id}`, {
          method: "DELETE",
          headers: {
            apikey: service,
            Authorization: `Bearer ${service}`,
          },
        }).catch(() => undefined);
      }
    } catch (e) {
      out.write = {
        ok: false,
        error: detail(e),
        duration_ms: Date.now() - writeStart,
      };
    }
  }

  return NextResponse.json(out);
}
