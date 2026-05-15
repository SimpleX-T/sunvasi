import { Resend } from "resend";

/* ---------------------------------------------------------------------------
 * Outbound email via Resend. Server-only. The whole feature is optional —
 * `RESEND_API_KEY` controls whether real emails go out or the API route falls
 * back to a "you should use mailto:" response.
 * ------------------------------------------------------------------------ */

let _client: Resend | undefined;

export function getResend(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  _client = new Resend(key);
  return _client;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function fromAddress(): string {
  return process.env.RESEND_FROM ?? "Sunvasi <onboarding@resend.dev>";
}

interface ContractInviteParams {
  to: string;
  contractTitle: string;
  freelancerName: string;
  totalUsdc: number;
  shortId: string;
  appUrl: string;
  mode?: "new" | "updated";
}

export async function sendContractInvite(p: ContractInviteParams) {
  const fundingUrl = `${p.appUrl.replace(/\/$/, "")}/c/${p.shortId}`;
  const totalFormatted = p.totalUsdc.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const subject =
    p.mode === "updated"
      ? `${p.freelancerName} updated your Sunvasi contract`
      : `${p.freelancerName} sent you a contract on Sunvasi`;

  const text = `${p.freelancerName} has prepared a Sunvasi contract for you to review and fund.

Contract: ${p.contractTitle}
Total: $${totalFormatted} USDC

Open it here:
${fundingUrl}

You'll be able to read the full agreement and milestones before paying anything. Funds are held in a non-custodial smart contract on Stellar — Sunvasi never takes custody. They release on your approval, milestone by milestone.

If you didn't expect this email, you can ignore it.

— Sunvasi
sunvasi.app`;

  const html = renderHtmlInvite({ ...p, fundingUrl, totalFormatted, subject });

  const resend = getResend();
  return resend.emails.send({
    from: fromAddress(),
    to: [p.to],
    subject,
    text,
    html,
  });
}

/* ---------------------------------------------------------------------------
 * Best-effort auto-notify helper. Sends a contract invitation email and logs
 * the result to the activity timeline. Never throws — email failures must not
 * block contract creation / editing.
 * ------------------------------------------------------------------------ */

interface AutoNotifyParams {
  contractId: string;
  shortId: string;
  contractTitle: string;
  totalUsdc: number;
  clientEmail: string | null;
  freelancerDid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  mode: "new" | "updated";
  requestUrl: string;
}

export async function notifyClientOfContract(p: AutoNotifyParams): Promise<{
  attempted: boolean;
  ok: boolean;
  reason?: string;
}> {
  if (!p.clientEmail) return { attempted: false, ok: false, reason: "no_client_email" };
  if (!isEmailConfigured()) return { attempted: false, ok: false, reason: "resend_unconfigured" };

  const { data: profile } = await p.db
    .from("profiles")
    .select("display_name, email")
    .eq("id", p.freelancerDid)
    .maybeSingle();

  const freelancerName: string =
    profile?.display_name ?? profile?.email ?? "A freelancer";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(p.requestUrl).origin;
  try {
    const result = await sendContractInvite({
      to: p.clientEmail,
      contractTitle: p.contractTitle,
      freelancerName,
      totalUsdc: p.totalUsdc,
      shortId: p.shortId,
      appUrl,
      mode: p.mode,
    });
    if (result.error) {
      return { attempted: true, ok: false, reason: result.error.message };
    }
    await p.db.from("activity").insert({
      contract_id: p.contractId,
      actor_id: p.freelancerDid,
      type: "invited",
      metadata: {
        to: p.clientEmail,
        provider: "resend",
        id: result.data?.id ?? null,
        mode: p.mode,
        auto: true,
      },
    });
    return { attempted: true, ok: true };
  } catch (e) {
    return {
      attempted: true,
      ok: false,
      reason: e instanceof Error ? e.message : "send_failed",
    };
  }
}

function renderHtmlInvite(p: {
  contractTitle: string;
  freelancerName: string;
  totalFormatted: string;
  fundingUrl: string;
  subject: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(p.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Manrope,Helvetica,Arial,sans-serif;color:#1a1714;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d9d2c2;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8478;">A new contract</p>
          <h1 style="margin:18px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1;letter-spacing:-0.02em;color:#1a1714;">${escapeHtml(p.contractTitle)}</h1>
          <p style="margin:18px 0 0 0;font-size:15px;line-height:1.55;color:#5a554c;">
            <strong style="color:#1a1714;font-weight:600;">${escapeHtml(p.freelancerName)}</strong> has prepared a contract for you on Sunvasi. Funds are held in a non-custodial smart contract on Stellar and released milestone by milestone, on your approval.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <div style="height:1px;background:#d9d2c2;margin:24px 0;"></div>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8478;">Total to fund</p>
          <p style="margin:6px 0 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;color:#1a1714;font-variant-numeric:tabular-nums;">$${escapeHtml(p.totalFormatted)} <span style="color:#8a8478;font-size:14px;">USDC</span></p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px 32px;">
          <a href="${escapeHtml(p.fundingUrl)}" style="display:inline-block;background:#b85a3a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:4px;font-weight:600;font-size:15px;">Review &amp; fund this contract →</a>
          <p style="margin:14px 0 0 0;font-size:13px;color:#8a8478;">Or copy the link: <a href="${escapeHtml(p.fundingUrl)}" style="color:#b85a3a;">${escapeHtml(p.fundingUrl)}</a></p>
        </td></tr>
        <tr><td style="padding:0 32px 32px 32px;">
          <p style="margin:0;font-size:12px;line-height:1.55;color:#8a8478;">You'll be able to read the full agreement and milestones before paying anything. If you didn't expect this email, you can ignore it.</p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8478;">Sunvasi · made for the corridor</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
