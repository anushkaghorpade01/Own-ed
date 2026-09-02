"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ExplainerSection {
  title: string;
  content: string;
}

export interface ExplainerProps {
  trigger?: string;
  sections: ExplainerSection[];
  defaultOpen?: boolean;
  className?: string;
}

export function Explainer({
  trigger = "What does this mean?",
  sections,
  defaultOpen = false,
  className,
}: ExplainerProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("mt-2", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-body-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        {trigger}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-explainer)] px-3 py-2.5 text-body-sm leading-relaxed text-[var(--text-secondary)]">
          {sections.map((s) => (
            <div key={s.title} className={sections.length > 1 ? "mb-2 last:mb-0" : ""}>
              {sections.length > 1 && (
                <p className="text-label mb-0.5 normal-case tracking-wide">{s.title}</p>
              )}
              <p>{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
