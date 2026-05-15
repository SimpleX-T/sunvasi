import { v2 as cloudinary } from "cloudinary";

/* ---------------------------------------------------------------------------
 * Cloudinary — server-only. The secret key never leaves the API route.
 * The browser uploads directly to Cloudinary with a signed payload returned
 * by `signUpload()`.
 * ------------------------------------------------------------------------ */

let _configured = false;
export function getCloudinary() {
  if (!_configured) {
    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    _configured = true;
  }
  return cloudinary;
}

export interface SignUploadParams {
  folder: string;
  publicId?: string;
  resourceType?: "image" | "video" | "raw" | "auto";
  tags?: string[];
}

export interface SignedUploadEnvelope {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId?: string;
  /** Comma-separated tag list — included only if non-empty. The client MUST
   * forward this exact string back as `tags` in the multipart upload, or
   * Cloudinary will reject the signature. */
  tags?: string;
  resourceType: "image" | "video" | "raw" | "auto";
}

export function signUpload(params: SignUploadParams): SignedUploadEnvelope {
  const c = getCloudinary();
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary env vars are not set");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const tags = params.tags?.join(",");
  const toSign: Record<string, string | number> = { folder: params.folder, timestamp };
  if (params.publicId) toSign.public_id = params.publicId;
  if (tags) toSign.tags = tags;
  const signature = c.utils.api_sign_request(toSign, apiSecret);
  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: params.folder,
    publicId: params.publicId,
    tags: tags || undefined,
    resourceType: params.resourceType ?? "auto",
  };
}

export function uploadFolderFor(contractId: string, milestoneId: string): string {
  const base = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "sunvasi/dev";
  return `${base}/contracts/${contractId}/milestones/${milestoneId}`;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}
