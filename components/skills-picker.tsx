"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ALL_CATALOG_SKILLS, SKILL_CATEGORIES } from "@/lib/skills-catalog";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  className?: string;
  /** Maximum height of the catalog area before it scrolls. */
  catalogMaxHeight?: string;
}

export function SkillsPicker({
  value,
  onChange,
  max = 20,
  className,
  catalogMaxHeight = "260px",
}: Props) {
  const [custom, setCustom] = useState("");

  function toggle(skill: string) {
    const exists = value.includes(skill);
    if (exists) {
      onChange(value.filter((s) => s !== skill));
    } else if (value.length < max) {
      onChange([...value, skill]);
    }
  }

  function addCustom() {
    const s = custom.trim();
    if (!s) return;
    if (value.includes(s)) {
      setCustom("");
      return;
    }
    if (value.length >= max) {
      setCustom("");
      return;
    }
    onChange([...value, s]);
    setCustom("");
  }

  // Skills the user added that aren't in the catalog — surface them in their
  // own row so they're still visible/removable.
  const customSelected = value.filter((s) => !ALL_CATALOG_SKILLS.includes(s));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">
          Pick what applies — up to {max}
        </p>
        <span className="font-mono text-mono-sm text-fg-subtle tabular-nums">
          {value.length} / {max}
        </span>
      </div>

      <div
        className="rounded border border-border bg-bg p-4 space-y-4 overflow-y-auto"
        style={{ maxHeight: catalogMaxHeight }}
      >
        {SKILL_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <p className="text-caption uppercase tracking-[0.14em] text-fg-subtle mb-2">
              {cat.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cat.skills.map((s) => {
                const active = value.includes(s);
                const disabled = !active && value.length >= max;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    disabled={disabled}
                    className={cn(
                      "rounded px-2.5 py-1 text-body-sm border transition-colors duration-150 ease-sunvasi no-tap",
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
                      disabled && "opacity-40 cursor-not-allowed hover:border-border hover:text-fg-muted",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {customSelected.length > 0 ? (
          <div>
            <p className="text-caption uppercase tracking-[0.14em] text-fg-subtle mb-2">
              Custom
            </p>
            <div className="flex flex-wrap gap-1.5">
              {customSelected.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-body-sm border border-accent bg-accent/10 text-accent transition-colors no-tap"
                >
                  {s}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Something else? Add it"
          className="flex-1 rounded border border-border bg-bg-elevated px-3 py-2 text-body-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent transition-colors"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim() || value.length >= max}
          className="inline-flex items-center gap-1 rounded border border-border hover:border-border-strong px-3 py-2 text-body-sm text-fg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
