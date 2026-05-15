/* ---------------------------------------------------------------------------
 * Skills catalog for the onboarding modal + profile form. Grouped by domain
 * so users can scan quickly. The list is intentionally tight — the corridor
 * Sunvasi serves first is high-skill knowledge work, not every imaginable
 * trade. Users can still add custom skills outside this list.
 * ------------------------------------------------------------------------ */

export interface SkillCategory {
  label: string;
  skills: readonly string[];
}

export const SKILL_CATEGORIES: readonly SkillCategory[] = [
  {
    label: "Engineering",
    skills: [
      "Frontend",
      "Backend",
      "Mobile",
      "DevOps",
      "Data engineering",
      "AI / ML",
      "Smart contracts",
      "QA & testing",
    ],
  },
  {
    label: "Design",
    skills: [
      "Brand identity",
      "Product design",
      "Visual design",
      "Motion & 3D",
      "Illustration",
      "Design systems",
    ],
  },
  {
    label: "Marketing",
    skills: [
      "SEO",
      "Performance ads",
      "Email",
      "Social media",
      "Growth",
    ],
  },
  {
    label: "Content",
    skills: [
      "Copywriting",
      "Technical writing",
      "Editing",
      "Translation",
      "Video editing",
      "Photography",
    ],
  },
  {
    label: "Operations",
    skills: [
      "Project management",
      "Product management",
      "Customer support",
      "Virtual assistant",
      "Bookkeeping",
    ],
  },
] as const;

/** Flat array of every catalog skill — useful for de-dup / custom checks. */
export const ALL_CATALOG_SKILLS: readonly string[] = SKILL_CATEGORIES.flatMap(
  (c) => c.skills,
);
