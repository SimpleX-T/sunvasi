import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Zod schemas shared between the create-contract stepper, the API route, and
 * the seed script. All amounts are stored as numbers; client-side renderers
 * format with `formatUsdc`.
 * ------------------------------------------------------------------------ */

export const MilestoneInputSchema = z.object({
  position: z.number().int().nonnegative(),
  title: z.string().min(2, "Give the milestone a name.").max(120),
  description: z.string().max(800).optional().default(""),
  acceptance_criteria: z.string().max(1200).optional().default(""),
  amount_usdc: z.coerce
    .number()
    .positive("Amount must be greater than zero.")
    .max(1_000_000, "That seems too high for a single milestone."),
});

export type MilestoneInput = z.infer<typeof MilestoneInputSchema>;

export const ContractDraftSchema = z
  .object({
    title: z.string().min(3, "Give the contract a title.").max(140),
    description: z.string().max(2000).optional().default(""),
    client_email: z.string().email("Enter a valid client email."),
    total_amount_usdc: z.coerce
      .number()
      .positive("Total budget must be greater than zero.")
      .max(5_000_000),
    auto_release_days: z.coerce.number().int().min(3).max(14).default(7),
    milestones: z.array(MilestoneInputSchema).min(1, "Add at least one milestone."),
  })
  .superRefine((value, ctx) => {
    const sum = value.milestones.reduce((acc, m) => acc + Number(m.amount_usdc || 0), 0);
    const total = Number(value.total_amount_usdc);
    if (Math.abs(sum - total) > 0.005) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Milestone total ($${sum.toFixed(2)}) must equal contract budget ($${total.toFixed(2)}).`,
        path: ["milestones"],
      });
    }
  });

export type ContractDraft = z.infer<typeof ContractDraftSchema>;

export const SubmitDeliverableSchema = z.object({
  files: z
    .array(
      z.object({
        cloudinary_url: z.string().url(),
        type: z.string().min(1),
        size: z.number().int().nonnegative(),
        filename: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .default([]),
  links: z
    .array(z.object({ label: z.string().min(1).max(80), url: z.string().url() }))
    .default([]),
  note: z.string().max(2000).optional().default(""),
});

export type SubmitDeliverableInput = z.infer<typeof SubmitDeliverableSchema>;

export const DisputeEvidenceSchema = z.object({
  promised: z.string().min(10).max(2000),
  delivered: z.string().min(5).max(2000),
  gap: z.string().min(5).max(2000),
  files: z
    .array(
      z.object({
        cloudinary_url: z.string().url(),
        type: z.string(),
        size: z.number().int().nonnegative(),
        filename: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),
});

export type DisputeEvidence = z.infer<typeof DisputeEvidenceSchema>;
