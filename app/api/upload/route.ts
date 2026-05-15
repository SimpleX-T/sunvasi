import { NextResponse } from "next/server";
import { z } from "zod";
import { isCloudinaryConfigured, signUpload, uploadFolderFor } from "@/lib/cloudinary";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

const Body = z.object({
  contract_id: z.string().uuid(),
  milestone_id: z.string().uuid(),
  filename: z.string().min(1).max(160),
  resource_type: z.enum(["image", "video", "raw", "auto"]).default("auto"),
});

export async function POST(req: Request) {
  if (!isCloudinaryConfigured()) {
    return NextResponse.json({ error: "cloudinary_not_configured" }, { status: 503 });
  }
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: contract } = await db
    .from("contracts")
    .select("client_id, freelancer_id")
    .eq("id", parsed.data.contract_id)
    .single();

  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contract.client_id !== user.did && contract.freelancer_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const folder = uploadFolderFor(parsed.data.contract_id, parsed.data.milestone_id);
  const envelope = signUpload({
    folder,
    publicId: parsed.data.filename.replace(/\.[a-z0-9]+$/i, ""),
    resourceType: parsed.data.resource_type,
    tags: [`contract:${parsed.data.contract_id}`, `milestone:${parsed.data.milestone_id}`],
  });

  logger.info("upload.signed", {
    did: user.did,
    contract_id: parsed.data.contract_id,
    milestone_id: parsed.data.milestone_id,
  });
  return NextResponse.json(envelope);
}
