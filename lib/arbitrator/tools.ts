import { Type, type FunctionDeclaration } from "@google/genai";

/* ---------------------------------------------------------------------------
 * Tool definitions for the Sunvasi Arbitrator. Schema is Gemini's OpenAPI 3.0
 * subset (accessed via `Type` enum). The arbitrator orchestration loop
 * executes these manually against Supabase — see lib/arbitrator/run.ts.
 *
 * IMPORTANT: tool names and descriptions are surfaced verbatim on the public
 * /arbitration page. Keep them readable.
 * ------------------------------------------------------------------------ */

export const TOOL_NAMES = {
  GET_CONTRACT_DETAILS: "get_contract_details",
  GET_MILESTONE_HISTORY: "get_milestone_history",
  GET_EVIDENCE: "get_evidence",
  GET_DELIVERABLE_FILES: "get_deliverable_files",
  REQUEST_CLARIFICATION: "request_clarification",
  SUBMIT_VERDICT: "submit_verdict",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const arbitratorTools: FunctionDeclaration[] = [
  {
    name: TOOL_NAMES.GET_CONTRACT_DETAILS,
    description:
      "Returns the full contract: title, description, parties (anonymized to 'client' / 'freelancer'), all milestones with status, amounts, acceptance criteria.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        contract_id: { type: Type.STRING, description: "The Sunvasi contract UUID." },
      },
      required: ["contract_id"],
    },
  },
  {
    name: TOOL_NAMES.GET_MILESTONE_HISTORY,
    description:
      "Returns chronological history of all milestones on this contract: which were approved, when, and any prior disputes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        contract_id: { type: Type.STRING, description: "The Sunvasi contract UUID." },
      },
      required: ["contract_id"],
    },
  },
  {
    name: TOOL_NAMES.GET_EVIDENCE,
    description:
      "Returns structured evidence submitted by the named party for the disputed milestone.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        party: {
          type: Type.STRING,
          enum: ["client", "freelancer"],
          description: "Which party's evidence to fetch.",
        },
      },
      required: ["party"],
    },
  },
  {
    name: TOOL_NAMES.GET_DELIVERABLE_FILES,
    description:
      "Returns the list of files and links the freelancer submitted for the disputed milestone, with file types and Cloudinary URLs. For images and videos, a short description generated at upload time is provided instead of the raw media.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        milestone_id: { type: Type.STRING, description: "The Sunvasi milestone UUID." },
      },
      required: ["milestone_id"],
    },
  },
  {
    name: TOOL_NAMES.REQUEST_CLARIFICATION,
    description:
      "Send a specific question to one party. Returns their response, or a timeout marker after 10 minutes. Use sparingly — once per party maximum across the whole arbitration.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        party: {
          type: Type.STRING,
          enum: ["client", "freelancer"],
        },
        question: {
          type: Type.STRING,
          description: "A single, specific question. Don't bundle multiple questions.",
        },
      },
      required: ["party", "question"],
    },
  },
  {
    name: TOOL_NAMES.SUBMIT_VERDICT,
    description:
      "Final verdict. Ends the arbitration. release_percentage is the share of the disputed milestone amount that goes to the freelancer; the remainder refunds to the client. Confidence 'insufficient' escalates to human review and moves no funds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        release_percentage: {
          type: Type.INTEGER,
          description: "0–100. Share of disputed milestone amount that goes to the freelancer.",
        },
        party_favored: {
          type: Type.STRING,
          enum: ["client", "freelancer", "split"],
        },
        reasoning: {
          type: Type.STRING,
          description:
            "Plain-English explanation. Cite the acceptance criteria; cite specific evidence; explain the split.",
        },
        confidence: {
          type: Type.STRING,
          enum: ["high", "medium", "low", "insufficient"],
        },
      },
      required: ["release_percentage", "party_favored", "reasoning", "confidence"],
    },
  },
];

/** Tool descriptions for public rendering on /arbitration. */
export const PUBLIC_TOOL_INDEX = arbitratorTools.map((t) => ({
  name: t.name,
  description: t.description,
}));
