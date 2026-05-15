import { runArbitration, type ArbitrationEvent } from "@/lib/arbitrator/run";
import { supabaseAdmin } from "@/lib/supabase";

/* ---------------------------------------------------------------------------
 * Server-Sent Events endpoint that drives the live arbitration UI.
 *
 *   • GET-based so we can use the browser's native EventSource.
 *   • Idempotent: if a verdict already exists we replay it as a single event
 *     stream so refresh-on-the-arbitration-page still shows the verdict.
 *   • Anti-buffering: explicit headers + an initial padding event to flush
 *     proxies (Vercel/Nginx) past their buffer thresholds.
 * ------------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseEncode(event: ArbitrationEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ disputeId: string }> },
) {
  const { disputeId } = await ctx.params;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: ArbitrationEvent) => controller.enqueue(enc.encode(sseEncode(e)));
      // Padding to defeat proxy buffers.
      controller.enqueue(enc.encode(`: padding ${" ".repeat(2048)}\n\n`));

      try {
        // Replay path: if there's already a verdict, stream a synthetic recap.
        const db = supabaseAdmin();
        const { data: existing } = await db
          .from("verdicts")
          .select("*")
          .eq("dispute_id", disputeId)
          .maybeSingle();
        if (existing) {
          const verdict = existing as {
            dispute_id: string;
            release_percentage: number;
            party_favored: "client" | "freelancer" | "split";
            reasoning: string;
            confidence: "high" | "medium" | "low" | "insufficient";
            tool_call_log: Array<{ ts: string; name: string; args: Record<string, unknown>; result_summary: string }>;
          };
          send({
            type: "started",
            data: {
              dispute_id: verdict.dispute_id,
              contract_id: "",
              milestone_id: "",
              arbitrator_version: "replay",
            },
          });
          for (const entry of verdict.tool_call_log ?? []) {
            const id = `replay_${entry.ts}_${entry.name}`;
            send({
              type: "tool_call",
              data: {
                id,
                name: entry.name as never,
                args: entry.args,
                ts: entry.ts,
              },
            });
            send({
              type: "tool_result",
              data: { id, name: entry.name as never, summary: entry.result_summary, ts: entry.ts },
            });
          }
          send({
            type: "verdict",
            data: {
              id: "replay",
              dispute_id: verdict.dispute_id,
              release_percentage: verdict.release_percentage,
              party_favored: verdict.party_favored,
              reasoning: verdict.reasoning,
              confidence: verdict.confidence,
              tool_call_log: verdict.tool_call_log,
              arbitrator_version: "replay",
              verdict_hash: null,
              created_at: new Date().toISOString(),
            },
          });
          send({ type: "done", data: {} });
          controller.close();
          return;
        }

        for await (const event of runArbitration(disputeId)) {
          send(event);
        }
      } catch (e) {
        send({
          type: "error",
          data: { message: e instanceof Error ? e.message : "Arbitration crashed." },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
