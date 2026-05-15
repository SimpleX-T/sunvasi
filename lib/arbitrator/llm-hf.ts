/* ---------------------------------------------------------------------------
 * Hugging Face arbitrator backend.
 *
 * Talks to the HF Inference Providers OpenAI-compatible router
 *   POST https://router.huggingface.co/v1/chat/completions
 *
 * To keep the existing arbitrator loop in run.ts unchanged, we convert at the
 * boundary:
 *
 *   IN:  Gemini Content[] history + Gemini FunctionDeclaration[]
 *        → OpenAI ChatCompletion messages[] + tools[]
 *   OUT: OpenAI choices[0].message
 *        → Gemini-shaped response with .candidates[].content + .text +
 *          .functionCalls so the caller doesn't need to know which provider
 *          produced the answer.
 *
 * Tool-call IDs are preserved across the round-trip (Gemini and OpenAI both
 * have a per-call ID — naming differs but semantics are identical).
 * ------------------------------------------------------------------------ */

import type {
  Content,
  FunctionDeclaration,
  GenerateContentResponse,
} from "@google/genai";
import { logger } from "@/lib/logger";

const HF_ROUTER = "https://router.huggingface.co/v1/chat/completions";

interface OpenAIToolDef {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAIChatCompletion {
  id?: string;
  choices: Array<{
    index: number;
    message: OpenAIChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function isHuggingFaceConfigured(): boolean {
  return Boolean(process.env.HUGGING_FACE_TOKEN && process.env.HUGGING_FACE_MODEL);
}

export function getHuggingFaceModel(): string {
  return process.env.HUGGING_FACE_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct";
}

/* ---------------------------------------------------------------------------
 * Schema normaliser. Gemini's Type enum encodes JSON Schema types in
 * UPPERCASE ("OBJECT", "STRING", …). OpenAI tool specs require the canonical
 * JSON Schema lowercase. Walk the parameters tree and lowercase the `type`
 * field everywhere.
 * ------------------------------------------------------------------------ */

function lowercaseSchemaTypes(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(lowercaseSchemaTypes);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "type" && typeof v === "string") {
      out[k] = v.toLowerCase();
    } else {
      out[k] = lowercaseSchemaTypes(v);
    }
  }
  return out;
}

function toOpenAITools(declarations: FunctionDeclaration[]): OpenAIToolDef[] {
  return declarations.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name ?? "anon",
      description: d.description,
      parameters: (lowercaseSchemaTypes(d.parameters) as Record<string, unknown>) ?? {
        type: "object",
        properties: {},
      },
    },
  }));
}

/* ---------------------------------------------------------------------------
 * Message-history conversion.
 *
 *   Gemini stores the conversation as Content[] where each Content has
 *   .role ∈ {"user","model"} and .parts[] containing { text } | { functionCall }
 *   | { functionResponse }.
 *
 *   We map that to OpenAI's structure:
 *     - text on role "user"       → { role: "user", content: text }
 *     - text on role "model"      → { role: "assistant", content: text }
 *     - functionCall on "model"   → { role: "assistant", tool_calls: [{...}] }
 *     - functionResponse on "user"→ { role: "tool", tool_call_id, content }
 *
 *   The system prompt is prepended as a single { role: "system" } message.
 * ------------------------------------------------------------------------ */

function toOpenAIMessages(
  history: Content[],
  systemPrompt: string,
): OpenAIChatMessage[] {
  const messages: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const turn of history) {
    const role: OpenAIChatMessage["role"] = turn.role === "model" ? "assistant" : "user";
    const parts = turn.parts ?? [];

    // Group parts into one assistant message (with text + tool_calls) or
    // emit each functionResponse as its own role:"tool" message.
    if (role === "assistant") {
      const texts: string[] = [];
      const toolCalls: NonNullable<OpenAIChatMessage["tool_calls"]> = [];
      for (const part of parts) {
        if ("text" in part && part.text) texts.push(part.text);
        if ("functionCall" in part && part.functionCall) {
          toolCalls.push({
            id: part.functionCall.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
            type: "function",
            function: {
              name: part.functionCall.name ?? "anon",
              arguments: JSON.stringify(part.functionCall.args ?? {}),
            },
          });
        }
      }
      messages.push({
        role: "assistant",
        content: texts.length ? texts.join("") : null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    // role === "user" — could be plain user text OR functionResponse(s).
    let userText: string | null = null;
    for (const part of parts) {
      if ("text" in part && part.text) {
        userText = (userText ?? "") + part.text;
      }
      if ("functionResponse" in part && part.functionResponse) {
        messages.push({
          role: "tool",
          tool_call_id:
            part.functionResponse.id ??
            `call_${Math.random().toString(36).slice(2, 10)}`,
          content: JSON.stringify(part.functionResponse.response ?? {}),
        });
      }
    }
    if (userText !== null) {
      messages.push({ role: "user", content: userText });
    }
  }

  return messages;
}

/* ---------------------------------------------------------------------------
 * Response conversion: OpenAI choices[0].message → Gemini-shaped response.
 *
 *   We populate just enough of GenerateContentResponse for the runner:
 *     - .candidates[0].content = { role: "model", parts: [...] }
 *     - .text                  = concatenated text deltas (string)
 *     - .functionCalls         = unused by the runner today (it reads via
 *                                collectFunctionCalls on candidates[0].content)
 * ------------------------------------------------------------------------ */

function toGeminiResponse(completion: OpenAIChatCompletion): GenerateContentResponse {
  const msg = completion.choices[0]?.message;
  if (!msg) {
    return {
      candidates: [{ content: { role: "model", parts: [] } }],
      text: "",
    } as unknown as GenerateContentResponse;
  }

  const parts: Content["parts"] = [];
  if (msg.content) {
    parts.push({ text: msg.content });
  }
  if (msg.tool_calls?.length) {
    for (const tc of msg.tool_calls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs =
          typeof tc.function.arguments === "string" && tc.function.arguments.length
            ? JSON.parse(tc.function.arguments)
            : {};
      } catch {
        // Some open models occasionally emit malformed JSON in arguments.
        // Surface the raw string so the operator can see what was wrong.
        parsedArgs = { _raw: tc.function.arguments };
      }
      parts.push({
        functionCall: {
          id: tc.id,
          name: tc.function.name,
          args: parsedArgs,
        },
      });
    }
  }

  return {
    candidates: [{ content: { role: "model", parts } }],
    text: msg.content ?? "",
  } as unknown as GenerateContentResponse;
}

/* ---------------------------------------------------------------------------
 * Public entrypoint — same call signature shape as gemini.models.generateContent
 * so the orchestrator only needs a single-line swap.
 * ------------------------------------------------------------------------ */

export interface HFCallInput {
  history: Content[];
  tools: FunctionDeclaration[];
  systemPrompt: string;
  temperature?: number;
}

export async function callHuggingFace(
  input: HFCallInput,
): Promise<GenerateContentResponse> {
  const token = process.env.HUGGING_FACE_TOKEN;
  if (!token) throw new Error("HUGGING_FACE_TOKEN is not set");
  const model = getHuggingFaceModel();

  const messages = toOpenAIMessages(input.history, input.systemPrompt);
  const tools = toOpenAITools(input.tools);

  const body = {
    model,
    messages,
    tools,
    tool_choice: "auto",
    temperature: input.temperature ?? 0.2,
  };

  const res = await fetch(HF_ROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("hf.chat_completion_failed", {
      status: res.status,
      model,
      body: text.slice(0, 500),
    });
    if (res.status === 429) {
      throw new Error(
        "Hugging Face rate limit reached — wait a minute or upgrade your HF plan.",
      );
    }
    if (res.status === 503) {
      throw new Error(
        "Hugging Face model is loading — retry in 20–60s (cold start on this model).",
      );
    }
    throw new Error(
      `Hugging Face inference failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }

  const completion = (await res.json()) as OpenAIChatCompletion;
  return toGeminiResponse(completion);
}
