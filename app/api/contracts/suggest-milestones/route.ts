import { NextResponse } from "next/server";
import { z } from "zod";
import { getGemini, getGeminiModel, isGeminiConfigured } from "@/lib/gemini";

const Body = z.object({
  title: z.string().min(2),
  description: z.string().optional().default(""),
  total_amount_usdc: z.coerce.number().positive(),
});

const FALLBACK = (total: number) => [
  {
    title: "Discovery & planning",
    description: "Scope, success criteria, key references.",
    acceptance_criteria: "Written brief approved by client.\nKickoff call held.",
    amount_usdc: Math.round((total * 0.25) * 100) / 100,
  },
  {
    title: "Build",
    description: "Core delivery of the engagement.",
    acceptance_criteria: "Working build shared with client.\nTwo rounds of revisions included.",
    amount_usdc: Math.round((total * 0.5) * 100) / 100,
  },
  {
    title: "Launch & handover",
    description: "Final polish, deploy, documentation.",
    acceptance_criteria: "Live deployment.\nHandover documentation.",
    amount_usdc: Math.round((total * 0.25) * 100) / 100,
  },
];

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { title, description, total_amount_usdc } = parsed.data;

  if (!isGeminiConfigured()) {
    return NextResponse.json({
      milestones: FALLBACK(total_amount_usdc).map((m, position) => ({ ...m, position })),
    });
  }

  const gemini = getGemini();
  try {
    const res = await gemini.models.generateContent({
      model: getGeminiModel(),
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `Suggest exactly 3 milestones for a freelance contract titled "${title}". ` +
                `Description: ${description || "(none)"}. ` +
                `Total budget: $${total_amount_usdc.toFixed(2)} USDC. ` +
                `Respond with JSON only, of shape:` +
                `{"milestones":[{"title":string,"description":string,"acceptance_criteria":string,"amount_usdc":number}]}. ` +
                `Amounts must sum exactly to the total.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          "You write tight, professional milestone breakdowns for freelance contracts. Output strict JSON, nothing else.",
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });
    const text = res.text ?? "";
    const json = JSON.parse(text) as {
      milestones: Array<{
        title: string;
        description: string;
        acceptance_criteria: string;
        amount_usdc: number;
      }>;
    };
    const milestones = (json.milestones ?? []).map((m, position) => ({
      position,
      title: m.title,
      description: m.description ?? "",
      acceptance_criteria: m.acceptance_criteria ?? "",
      amount_usdc: Number(m.amount_usdc) || 0,
    }));
    if (milestones.length === 0) throw new Error("empty");
    return NextResponse.json({ milestones });
  } catch {
    return NextResponse.json({
      milestones: FALLBACK(total_amount_usdc).map((m, position) => ({ ...m, position })),
    });
  }
}
