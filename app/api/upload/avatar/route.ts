import { NextResponse } from "next/server";
import { z } from "zod";
import { isCloudinaryConfigured, signUpload } from "@/lib/cloudinary";
import { readUserFromHeaders } from "@/lib/privy";
import { logger } from "@/lib/logger";

const Body = z.object({
  filename: z.string().min(1).max(160),
});

export async function POST(req: Request) {
  if (!isCloudinaryConfigured()) {
    return NextResponse.json({ error: "cloudinary_not_configured" }, { status: 503 });
  }
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const base = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "sunvasi/dev";
  const slug = user.did.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 64);
  const envelope = signUpload({
    folder: `${base}/avatars`,
    publicId: `user_${slug}_${Date.now()}`,
    resourceType: "image",
    tags: ["avatar", `user:${slug}`],
  });
  logger.info("upload.avatar.signed", { did: user.did });
  return NextResponse.json(envelope);
}
