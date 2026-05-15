/* ---------------------------------------------------------------------------
 * scripts/seed-demo.ts
 *
 *   Seeds the demo contract used by the "Try the demo" landing-page link.
 *   Idempotent: re-running clears existing demo rows first.
 *
 *   Run with:  pnpm seed
 *   Requires:  Supabase env vars set in .env.local
 * ------------------------------------------------------------------------ */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const DEMO_FREELANCER_DID = "did:privy:demo-freelancer";
const DEMO_CLIENT_DID = "did:privy:demo-client";
const DEMO_SHORT_ID = "DEMOH3LX";

async function main() {
  console.log("• Cleaning prior demo rows…");

  const { data: oldContract } = await db
    .from("contracts")
    .select("id")
    .eq("short_id", DEMO_SHORT_ID)
    .maybeSingle();
  if (oldContract) {
    await db.from("contracts").delete().eq("id", (oldContract as { id: string }).id);
  }
  await db.from("profiles").delete().in("id", [DEMO_FREELANCER_DID, DEMO_CLIENT_DID]);

  console.log("• Inserting profiles…");
  const { error: pErr } = await db.from("profiles").insert([
    {
      id: DEMO_FREELANCER_DID,
      email: "amara@sunvasi.demo",
      display_name: "Amara Okafor",
      role: "freelancer",
      country: "NG",
      bio: "Frontend developer based in Lagos. Builds for foreign clients.",
      skills: ["React", "Next.js", "Design systems"],
      hourly_rate_usdc: 65,
      payout_address: "GBQWAR2EWYJZB47VJOC3CTBOAGPLNFJDPMI7DZSCHENRGFTQXGUWOWMK",
      avatar_url: null,
    },
    {
      id: DEMO_CLIENT_DID,
      email: "david@helix.demo",
      display_name: "David Engel",
      role: "client",
      country: "DE",
      bio: "Founder, Helix Software (Berlin).",
      avatar_url: null,
    },
  ]);
  if (pErr) {
    console.error("Profile insert failed:", pErr.message);
    process.exit(1);
  }

  console.log("• Inserting contract…");
  const { data: contract, error: cErr } = await db
    .from("contracts")
    .insert({
      short_id: DEMO_SHORT_ID,
      title: "Marketing site redesign for Helix Software",
      description:
        "A full marketing site refresh: discovery + wireframes, a visual design system, then implementation and launch. Six-week engagement, three milestones.",
      client_id: DEMO_CLIENT_DID,
      client_email: "david@helix.demo",
      freelancer_id: DEMO_FREELANCER_DID,
      total_amount_usdc: 2000,
      auto_release_days: 7,
      status: "disputed",
      escrow_id: "demo_escrow_helx_2026",
      escrow_address: "GBQDEMOESCROWHELXSAMPLEZ7CSXIWBR2EWYJZB47VJOC3CTBOAGPLNFJDP",
      escrow_network: "testnet",
      funded_at: daysAgo(28),
    })
    .select()
    .single();
  if (cErr || !contract) {
    console.error("Contract insert failed:", cErr?.message);
    process.exit(1);
  }
  const contractId = (contract as { id: string }).id;

  console.log("• Inserting milestones…");
  const { data: milestones, error: mErr } = await db
    .from("milestones")
    .insert([
      {
        contract_id: contractId,
        position: 0,
        title: "Discovery & wireframes",
        description: "Audit the current site, interview two stakeholders, deliver low-fi wireframes.",
        acceptance_criteria:
          "Stakeholder interviews scheduled and completed.\nFigma wireframes for 4 core pages.\nWritten audit summary (<= 2 pages).",
        amount_usdc: 500,
        status: "released",
        submitted_at: daysAgo(22),
        approved_at: daysAgo(20),
        released_at: daysAgo(20),
      },
      {
        contract_id: contractId,
        position: 1,
        title: "Visual design system",
        description: "Design tokens, type scale, component library in Figma, applied to wireframes.",
        acceptance_criteria:
          "Type, color, spacing tokens defined.\nFigma library with 12+ components.\nHi-fi mocks of 4 pages.",
        amount_usdc: 700,
        status: "approved",
        submitted_at: daysAgo(10),
        approved_at: daysAgo(8),
        deliverable_links: [
          { label: "Figma library", url: "https://www.figma.com/file/demo-helix" },
        ],
      },
      {
        contract_id: contractId,
        position: 2,
        title: "Implementation & launch",
        description: "Code the marketing site in Next.js, deploy to Vercel, handover to client team.",
        acceptance_criteria:
          "Deployed at helix.com via Vercel.\nLighthouse Performance score >= 90 on mobile.\nResponsive on 375px and 1440px.\nCMS hooked up to existing Contentful space.",
        amount_usdc: 800,
        status: "disputed",
        submitted_at: daysAgo(2),
        auto_release_at: daysAgo(-5),
        deliverable_links: [
          { label: "Live preview", url: "https://helix-preview.demo.sunvasi.com" },
          { label: "GitHub repo", url: "https://github.com/helix/marketing-site" },
        ],
        deliverable_note:
          "Site is live and responsive. Lighthouse score 87 on mobile (close to the 90 target). CMS is hooked up.",
      },
    ])
    .select();
  if (mErr || !milestones) {
    console.error("Milestone insert failed:", mErr?.message);
    process.exit(1);
  }

  const disputed = (milestones as Array<{ id: string; position: number }>).find((m) => m.position === 2);
  if (!disputed) throw new Error("Disputed milestone not found");

  console.log("• Inserting dispute & evidence…");
  const { data: disputeRow, error: dErr } = await db
    .from("disputes")
    .insert({
      milestone_id: disputed.id,
      contract_id: contractId,
      filed_by: DEMO_CLIENT_DID,
      status: "resolved",
      resolved_at: daysAgo(0),
    client_evidence: {
      promised:
        "Deployed at helix.com via Vercel. Lighthouse Performance score >= 90 on mobile. Responsive on 375px and 1440px. CMS hooked up to existing Contentful space.",
      delivered:
        "Deployed at helix-preview.demo.sunvasi.com — not helix.com. Lighthouse mobile score is 87, not 90.",
      gap:
        "Two of four acceptance criteria are not met: (1) site lives on a preview domain, not helix.com; (2) Lighthouse mobile score is below 90.",
      files: [],
    },
      freelancer_evidence: {
        delivered:
          "The site is fully built, responsive, and CMS-integrated. Lighthouse 87 is within typical noise of the 90 target; I've identified the LCP issue and can push the fix in <2 hours. The helix.com DNS swap is blocked on the client's IT team — I cannot deploy to a domain I don't control.",
        rebuttal:
          "Lighthouse score is a known browser-noise metric; 87 vs 90 is within margin and is a fixable last-mile detail. The domain swap requires client-side DNS access I was never given.",
        files: [],
      },
    })
    .select()
    .single();
  if (dErr || !disputeRow) {
    console.error("Dispute insert failed:", dErr?.message);
    process.exit(1);
  }
  const disputeId = (disputeRow as { id: string }).id;

  console.log("• Inserting pre-recorded verdict…");
  await db.from("verdicts").insert({
    dispute_id: disputeId,
    release_percentage: 75,
    party_favored: "split",
    confidence: "medium",
    reasoning:
      "Two of four acceptance criteria are clearly met: the site is built, responsive across the requested viewports, and the Contentful CMS is integrated. The remaining two are partially met: (1) Deployment is live but on a preview subdomain rather than helix.com — the freelancer's claim that the DNS swap is blocked on the client's IT side is consistent with the evidence and is a fixable last-mile detail. (2) Lighthouse Performance is 87 vs the contractual 90; this is within typical run-to-run noise on mobile but technically misses the bar.\n\nThe freelancer has demonstrated good-faith delivery of the bulk of the milestone. Both prior milestones on this contract were approved on time, which earns a measured benefit of the doubt. The 87 → 90 fix and the DNS swap are short, well-scoped follow-ups that don't justify withholding the full payment.\n\nVerdict: release 75% to the freelancer (USDC 600.00), refund 25% to the client (USDC 200.00) — the refund covers the remaining work the freelancer commits to delivering at no additional cost (LCP fix + DNS swap once the client provides access).",
    tool_call_log: [
      {
        ts: daysAgo(0),
        name: "get_contract_details",
        args: { contract_id: contractId },
        result_summary: 'Contract "Marketing site redesign for Helix Software" — 3 milestone(s), $2000 total.',
      },
      {
        ts: daysAgo(0),
        name: "get_milestone_history",
        args: { contract_id: contractId },
        result_summary: "2 prior milestone(s) approved; current dispute on position 3.",
      },
      {
        ts: daysAgo(0),
        name: "get_evidence",
        args: { party: "client" },
        result_summary: "Returned client evidence (4 field(s)).",
      },
      {
        ts: daysAgo(0),
        name: "get_evidence",
        args: { party: "freelancer" },
        result_summary: "Returned freelancer evidence (3 field(s)).",
      },
      {
        ts: daysAgo(0),
        name: "get_deliverable_files",
        args: { milestone_id: disputed.id },
        result_summary: "0 file(s), 2 link(s) submitted for the disputed milestone.",
      },
      {
        ts: daysAgo(0),
        name: "submit_verdict",
        args: {
          release_percentage: 75,
          party_favored: "split",
          confidence: "medium",
        },
        result_summary: "Verdict submitted: 75% to freelancer, confidence=medium.",
      },
    ],
    arbitrator_version: "sunvasi-arbitrator/2026-05-15.1",
    verdict_hash: "demo-replay-verdict",
  });

  console.log("• Inserting activity log…");
  await db.from("activity").insert([
    { contract_id: contractId, actor_id: DEMO_FREELANCER_DID, type: "created", metadata: {}, created_at: daysAgo(30) },
    { contract_id: contractId, actor_id: DEMO_CLIENT_DID, type: "funded", metadata: { amount: 2000 }, created_at: daysAgo(28) },
    { contract_id: contractId, actor_id: DEMO_FREELANCER_DID, type: "submitted", metadata: { milestone_position: 0 }, created_at: daysAgo(22) },
    { contract_id: contractId, actor_id: DEMO_CLIENT_DID, type: "approved", metadata: { milestone_position: 0 }, created_at: daysAgo(20) },
    { contract_id: contractId, actor_id: DEMO_FREELANCER_DID, type: "submitted", metadata: { milestone_position: 1 }, created_at: daysAgo(10) },
    { contract_id: contractId, actor_id: DEMO_CLIENT_DID, type: "approved", metadata: { milestone_position: 1 }, created_at: daysAgo(8) },
    { contract_id: contractId, actor_id: DEMO_FREELANCER_DID, type: "submitted", metadata: { milestone_position: 2 }, created_at: daysAgo(2) },
    { contract_id: contractId, actor_id: DEMO_CLIENT_DID, type: "disputed", metadata: { milestone_position: 2 }, created_at: daysAgo(0) },
    {
      contract_id: contractId,
      actor_id: null,
      type: "verdict",
      metadata: { release_percentage: 75, party_favored: "split", confidence: "medium" },
      created_at: daysAgo(0),
    },
  ]);

  console.log("\n✓ Demo seeded.");
  console.log(`  Public funding page:  /c/${DEMO_SHORT_ID}`);
  console.log(`  Contract detail:      /app/contracts/${DEMO_SHORT_ID}`);
  console.log(`  Arbitration:          /app/contracts/${DEMO_SHORT_ID}/arbitration`);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
