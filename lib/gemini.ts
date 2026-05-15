import { GoogleGenAI } from "@google/genai";

/* ---------------------------------------------------------------------------
 * Server-only Gemini client. The arbitrator uses this — never expose to the
 * browser. The model id is env-driven; default is the latest Gemini 3.1 Pro
 * preview. Swap via `GEMINI_MODEL` if you want flash or a future version.
 * ------------------------------------------------------------------------ */

export const DEFAULT_GEMINI_MODEL = "gemini-3-pro-preview";
export const DEFAULT_GEMINI_VISION_MODEL = "gemini-3-pro-preview";

let _client: GoogleGenAI | undefined;

export function getGemini(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
}

export function getGeminiVisionModel(): string {
  return process.env.GEMINI_VISION_MODEL ?? DEFAULT_GEMINI_VISION_MODEL;
}
