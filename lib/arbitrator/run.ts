import type { Content, FunctionCall } from "@google/genai";
import { getGemini, getGeminiModel } from "@/lib/gemini";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  ContractRow,
  DeliverableFile,
  DeliverableLink,
  DisputeRow,
  MilestoneRow,
  ToolCallLogEntry,
  VerdictRow,
} from "@/lib/supabase";
import { isTrustlessWorkConfigured } from "@/lib/trustless-work";
import { resolveMilestoneDisputeOnChain } from "@/lib/tw-actions";
import { logger } from "@/lib/logger";
import { ARBITRATOR_VERSION, SUNVASI_ARBITRATOR_SYSTEM_PROMPT } from "./system-prompt";
import { TOOL_NAMES, arbitratorTools, type ToolName } from "./tools";

/* ---------------------------------------------------------------------------
 * Arbitration orchestration loop.
 *
 *   • Server-Sent Events: every event is yielded as { type, data } so the
 *     /api/arbitration/[disputeId] route can pipe it to the browser.
 *   • Every tool call is appended to verdicts.tool_call_log for audit.
 *   • submit_verdict terminates the loop and writes the verdict + (if not
 *     "insufficient") triggers the on-chain resolution via Trustless Work.
 * ------------------------------------------------------------------------ */

export type ArbitrationEvent =
  | { type: "started"; data: { dispute_id: string; contract_id: string; milestone_id: string; arbitrator_version: string } }
  | { type: "text"; data: { delta: string } }
  | { type: "tool_call"; data: { id: string; name: ToolName; args: Record<string, unknown>; ts: string } }
  | { type: "tool_result"; data: { id: string; name: ToolName; summary: string; ts: string } }
  | { type: "verdict"; data: VerdictRow }
  | { type: "resolution_broadcast"; data: { txHash?: string | null } }
  | { type: "error"; data: { message: string } }
  | { type: "done"; data: Record<string, never> };

const MAX_ITERATIONS = 12;
const CLARIFICATION_TIMEOUT_MS = 10 * 60 * 1000;

interface ArbitrationContextData {
  dispute: DisputeRow;
  contract: ContractRow;
  milestone: MilestoneRow;
  milestones: MilestoneRow[];
  toolLog: ToolCallLogEntry[];
  clarificationsUsed: { client: number; freelancer: number };
}

export async function* runArbitration(disputeId: string): AsyncGenerator<ArbitrationEvent> {
  const supabase = supabaseAdmin();

  const { data: dispute, error: dErr } = await supabase
    .from("disputes")
    .select("*")
    .eq("id", disputeId)
    .single();
  if (dErr || !dispute) {
    yield { type: "error", data: { message: dErr?.message ?? "Dispute not found" } };
    return;
  }
  const typedDispute = dispute as DisputeRow;

  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", typedDispute.contract_id)
    .single<ContractRow>();
  const { data: milestone } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", typedDispute.milestone_id)
    .single<MilestoneRow>();
  const { data: allMilestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("contract_id", typedDispute.contract_id)
    .order("position", { ascending: true });

  if (!contract || !milestone) {
    yield { type: "error", data: { message: "Contract or milestone missing" } };
    return;
  }

  await supabase
    .from("disputes")
    .update({ status: "arbitrating" })
    .eq("id", typedDispute.id);

  const ctx: ArbitrationContextData = {
    dispute: typedDispute,
    contract,
    milestone,
    milestones: (allMilestones ?? []) as MilestoneRow[],
    toolLog: [],
    clarificationsUsed: { client: 0, freelancer: 0 },
  };

  yield {
    type: "started",
    data: {
      dispute_id: typedDispute.id,
      contract_id: contract.id,
      milestone_id: milestone.id,
      arbitrator_version: ARBITRATOR_VERSION,
    },
  };

  const gemini = getGemini();
  const model = getGeminiModel();

  const history: Content[] = [
    {
      role: "user",
      parts: [
        {
          text:
            `A dispute has been filed and you are the arbitrator. ` +
            `Contract ID: ${contract.id}. ` +
            `Disputed milestone ID: ${milestone.id}. ` +
            `Begin by gathering facts with your tools. End with submit_verdict.`,
        },
      ],
    },
  ];

  let iterations = 0;
  let verdictWritten: VerdictRow | null = null;

  while (iterations < MAX_ITERATIONS && !verdictWritten) {
    iterations += 1;

    let response;
    try {
      response = await gemini.models.generateContent({
        model,
        contents: history,
        config: {
          systemInstruction: SUNVASI_ARBITRATOR_SYSTEM_PROMPT,
          tools: [{ functionDeclarations: arbitratorTools }],
          temperature: 0.2,
        },
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Gemini call failed";
      const message = formatGeminiError(raw);
      yield { type: "error", data: { message } };
      return;
    }

    const candidate = response.candidates?.[0];
    const assistantContent: Content = candidate?.content ?? { role: "model", parts: [] };
    history.push(assistantContent);

    const text = response.text;
    if (text && text.trim()) {
      for (const chunk of chunkText(text, 24)) {
        yield { type: "text", data: { delta: chunk } };
      }
    }

    const calls = collectFunctionCalls(assistantContent);
    if (calls.length === 0) {
      // No more tool calls and no verdict — bail with insufficient.
      break;
    }

    const toolResultParts: Content["parts"] = [];

    for (const call of calls) {
      const callId = call.id ?? `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const name = call.name as ToolName;
      const args = (call.args ?? {}) as Record<string, unknown>;
      const ts = new Date().toISOString();
      yield { type: "tool_call", data: { id: callId, name, args, ts } };

      const result = await executeTool({ name, args, ctx });
      ctx.toolLog.push({ ts, name, args, result_summary: result.summary });

      yield {
        type: "tool_result",
        data: { id: callId, name, summary: result.summary, ts: new Date().toISOString() },
      };

      if (name === TOOL_NAMES.SUBMIT_VERDICT) {
        verdictWritten = await persistVerdict({
          dispute: typedDispute,
          contract,
          milestone,
          verdict: args as unknown as VerdictArgs,
          toolLog: ctx.toolLog,
        });
        yield { type: "verdict", data: verdictWritten };

        if ((args as unknown as VerdictArgs).confidence !== "insufficient") {
          const tx = await tryResolveOnChain({
            contract,
            milestone,
            releasePercentage: (args as unknown as VerdictArgs).release_percentage,
          });
          yield { type: "resolution_broadcast", data: { txHash: tx?.hash ?? null } };
        }
        break;
      }

      toolResultParts.push({
        functionResponse: {
          id: callId,
          name,
          response: { result: result.payload },
        },
      });
    }

    if (verdictWritten) break;
    if (toolResultParts.length > 0) {
      history.push({ role: "user", parts: toolResultParts });
    }
  }

  if (!verdictWritten) {
    yield {
      type: "error",
      data: { message: "Arbitration exited without a verdict (iteration limit reached)." },
    };
  }

  yield { type: "done", data: {} };
}

interface VerdictArgs {
  release_percentage: number;
  party_favored: "client" | "freelancer" | "split";
  reasoning: string;
  confidence: "high" | "medium" | "low" | "insufficient";
}

function collectFunctionCalls(content: Content): FunctionCall[] {
  const out: FunctionCall[] = [];
  for (const part of content.parts ?? []) {
    if ("functionCall" in part && part.functionCall) {
      out.push(part.functionCall);
    }
  }
  return out;
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

async function executeTool({
  name,
  args,
  ctx,
}: {
  name: ToolName;
  args: Record<string, unknown>;
  ctx: ArbitrationContextData;
}): Promise<{ summary: string; payload: unknown }> {
  switch (name) {
    case TOOL_NAMES.GET_CONTRACT_DETAILS:
      return getContractDetailsImpl(ctx);
    case TOOL_NAMES.GET_MILESTONE_HISTORY:
      return getMilestoneHistoryImpl(ctx);
    case TOOL_NAMES.GET_EVIDENCE:
      return getEvidenceImpl(ctx, args.party as "client" | "freelancer");
    case TOOL_NAMES.GET_DELIVERABLE_FILES:
      return getDeliverableFilesImpl(ctx);
    case TOOL_NAMES.REQUEST_CLARIFICATION:
      return requestClarificationImpl(ctx, args as { party: "client" | "freelancer"; question: string });
    case TOOL_NAMES.SUBMIT_VERDICT:
      return {
        summary: `Verdict submitted: ${(args as unknown as VerdictArgs).release_percentage}% to freelancer, confidence=${(args as unknown as VerdictArgs).confidence}.`,
        payload: { accepted: true },
      };
    default:
      return {
        summary: `Unknown tool: ${String(name)}`,
        payload: { error: "unknown_tool" },
      };
  }
}

function getContractDetailsImpl(ctx: ArbitrationContextData) {
  const payload = {
    contract_id: ctx.contract.id,
    title: ctx.contract.title,
    description: ctx.contract.description,
    total_amount_usdc: ctx.contract.total_amount_usdc,
    auto_release_days: ctx.contract.auto_release_days,
    created_at: ctx.contract.created_at,
    parties: { client: "client", freelancer: "freelancer" },
    milestones: ctx.milestones.map((m) => ({
      id: m.id,
      position: m.position,
      title: m.title,
      description: m.description,
      acceptance_criteria: m.acceptance_criteria,
      amount_usdc: m.amount_usdc,
      status: m.status,
      is_disputed: m.id === ctx.milestone.id,
    })),
  };
  return {
    summary: `Contract "${ctx.contract.title}" — ${ctx.milestones.length} milestone(s), $${ctx.contract.total_amount_usdc} total.`,
    payload,
  };
}

function getMilestoneHistoryImpl(ctx: ArbitrationContextData) {
  const events = ctx.milestones.map((m) => ({
    milestone_id: m.id,
    position: m.position,
    title: m.title,
    status: m.status,
    submitted_at: m.submitted_at,
    approved_at: m.approved_at,
    released_at: m.released_at,
    is_disputed: m.id === ctx.milestone.id,
  }));
  const approved = events.filter((e) => e.status === "approved" || e.status === "released").length;
  return {
    summary: `${approved} prior milestone(s) approved; current dispute on position ${ctx.milestone.position}.`,
    payload: { events },
  };
}

function getEvidenceImpl(ctx: ArbitrationContextData, party: "client" | "freelancer") {
  const evidence = party === "client" ? ctx.dispute.client_evidence : ctx.dispute.freelancer_evidence;
  return {
    summary: `Returned ${party} evidence (${Object.keys(evidence ?? {}).length} field(s)).`,
    payload: { party, evidence: evidence ?? {} },
  };
}

function getDeliverableFilesImpl(ctx: ArbitrationContextData) {
  const files: DeliverableFile[] = (ctx.milestone.deliverable_files ?? []) as DeliverableFile[];
  const links: DeliverableLink[] = (ctx.milestone.deliverable_links ?? []) as DeliverableLink[];
  return {
    summary: `${files.length} file(s), ${links.length} link(s) submitted for the disputed milestone.`,
    payload: {
      note: ctx.milestone.deliverable_note,
      files: files.map((f) => ({
        filename: f.filename,
        type: f.type,
        size_bytes: f.size,
        url: f.cloudinary_url,
        description: f.description ?? null,
      })),
      links,
    },
  };
}

async function requestClarificationImpl(
  ctx: ArbitrationContextData,
  args: { party: "client" | "freelancer"; question: string },
) {
  const used = ctx.clarificationsUsed[args.party];
  if (used >= 1) {
    return {
      summary: `Clarification quota exhausted for ${args.party}.`,
      payload: { status: "quota_exhausted", party: args.party },
    };
  }
  ctx.clarificationsUsed[args.party] += 1;
  const supabase = supabaseAdmin();
  const { data: insert, error } = await supabase
    .from("clarifications")
    .insert({
      dispute_id: ctx.dispute.id,
      party: args.party,
      question: args.question,
    })
    .select()
    .single();
  if (error || !insert) {
    return {
      summary: `Clarification could not be sent (${error?.message ?? "unknown error"}).`,
      payload: { status: "error", message: error?.message },
    };
  }
  const id = (insert as { id: string }).id;

  const started = Date.now();
  while (Date.now() - started < CLARIFICATION_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 4000));
    const { data: row } = await supabase
      .from("clarifications")
      .select("response, responded_at")
      .eq("id", id)
      .single();
    if (row && (row as { response: string | null }).response) {
      return {
        summary: `${args.party} answered the clarification.`,
        payload: { status: "answered", response: (row as { response: string }).response },
      };
    }
  }
  await supabase.from("clarifications").update({ timed_out: true }).eq("id", id);
  return {
    summary: `Clarification timed out after 10 minutes; ${args.party} did not respond.`,
    payload: { status: "timeout" },
  };
}

async function persistVerdict(args: {
  dispute: DisputeRow;
  contract: ContractRow;
  milestone: MilestoneRow;
  verdict: VerdictArgs;
  toolLog: ToolCallLogEntry[];
}): Promise<VerdictRow> {
  const supabase = supabaseAdmin();
  const hash = await sha256Hex(
    JSON.stringify({
      dispute_id: args.dispute.id,
      verdict: args.verdict,
      arbitrator_version: ARBITRATOR_VERSION,
    }),
  );
  const { data, error } = await supabase
    .from("verdicts")
    .insert({
      dispute_id: args.dispute.id,
      release_percentage: args.verdict.release_percentage,
      party_favored: args.verdict.party_favored,
      reasoning: args.verdict.reasoning,
      confidence: args.verdict.confidence,
      tool_call_log: args.toolLog,
      arbitrator_version: ARBITRATOR_VERSION,
      verdict_hash: hash,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to persist verdict: ${error?.message}`);

  await supabase
    .from("disputes")
    .update({
      status: args.verdict.confidence === "insufficient" ? "escalated" : "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", args.dispute.id);

  await supabase.from("activity").insert({
    contract_id: args.contract.id,
    milestone_id: args.milestone.id,
    type: "verdict",
    metadata: {
      release_percentage: args.verdict.release_percentage,
      party_favored: args.verdict.party_favored,
      confidence: args.verdict.confidence,
    },
  });
  return data as VerdictRow;
}

async function tryResolveOnChain(args: {
  contract: ContractRow;
  milestone: MilestoneRow;
  releasePercentage: number;
}): Promise<{ hash?: string | null } | null> {
  if (
    !args.contract.escrow_id ||
    String(args.contract.escrow_id).startsWith("mock_") ||
    !isTrustlessWorkConfigured()
  ) {
    return null;
  }
  // The disputeResolver wallet for this escrow. In Sunvasi's current setup
  // it's the client's wallet (set at escrow init). For production we want a
  // Sunvasi-controlled wallet to remove client conflict-of-interest.
  // Configurable via SUNVASI_DISPUTE_RESOLVER_WALLET_ID + ADDRESS.
  const resolverWalletId =
    process.env.SUNVASI_DISPUTE_RESOLVER_WALLET_ID ?? "";
  const resolverAddress =
    process.env.SUNVASI_DISPUTE_RESOLVER_ADDRESS ?? "";

  // Fallback: look up the client's wallet from profiles (they're the
  // disputeResolver in the current escrow init flow).
  const supabase = supabaseAdmin();
  let walletId = resolverWalletId;
  let address = resolverAddress;
  if (!walletId || !address) {
    if (!args.contract.client_id) return null;
    const { data: client } = await supabase
      .from("profiles")
      .select("stellar_wallet_id, payout_address")
      .eq("id", args.contract.client_id)
      .maybeSingle();
    const cl = client as { stellar_wallet_id: string | null; payout_address: string | null } | null;
    if (!cl?.stellar_wallet_id || !cl?.payout_address) return null;
    walletId = cl.stellar_wallet_id;
    address = cl.payout_address;
  }

  // Compute distributions: release_percentage of the milestone amount goes to
  // the freelancer (receiver); the rest refunds to the client (approver).
  const { data: freelancer } = await supabase
    .from("profiles")
    .select("payout_address")
    .eq("id", args.contract.freelancer_id ?? "")
    .maybeSingle();
  const freelancerAddress = (freelancer as { payout_address: string | null } | null)?.payout_address;
  const { data: clientRow } = await supabase
    .from("profiles")
    .select("payout_address")
    .eq("id", args.contract.client_id ?? "")
    .maybeSingle();
  const clientAddress = (clientRow as { payout_address: string | null } | null)?.payout_address;
  if (!freelancerAddress || !clientAddress) return null;

  const amount = Number(args.milestone.amount_usdc);
  const toFreelancer = Math.round((amount * args.releasePercentage) / 100 * 100) / 100;
  const toClient = Math.round((amount - toFreelancer) * 100) / 100;
  const distributions = [
    { address: freelancerAddress, amount: toFreelancer },
    { address: clientAddress, amount: toClient },
  ].filter((d) => d.amount > 0);

  const milestoneIndex = args.milestone.tw_milestone_index ?? args.milestone.position;
  try {
    const result = await resolveMilestoneDisputeOnChain({
      escrowContractId: args.contract.escrow_id,
      milestoneIndex,
      distributions,
      signer: { walletId, address },
    });
    return { hash: result.tx_hash };
  } catch (e) {
    logger.warn("arbitrator.on_chain_resolution_failed", {
      contract_id: args.contract.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/** Turn raw Gemini error strings into something the UI can show without
 * leaking implementation details. The 429 case is the one that bites people
 * on the free tier, so we surface a clear retry message. */
function formatGeminiError(raw: string): string {
  const has429 = /429|RESOURCE_EXHAUSTED|quota/i.test(raw);
  if (has429) {
    const retryMatch = raw.match(/retry.*?(\d+)\s*s/i);
    const retry = retryMatch ? `${retryMatch[1]}s` : "shortly";
    return `Gemini rate limit reached (free tier: 20 requests/day). The arbitrator can't continue right now — please retry in ${retry}, or upgrade your Gemini plan / switch GEMINI_MODEL to a less-quota-constrained variant.`;
  }
  if (/timeout|ETIMEDOUT|fetch failed/i.test(raw)) {
    return `Couldn't reach Gemini (${raw}). Check your network and GEMINI_API_KEY.`;
  }
  return `Arbitration paused — Gemini error: ${raw.slice(0, 240)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
