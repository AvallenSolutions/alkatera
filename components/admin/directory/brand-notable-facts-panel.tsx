import { Sparkles } from 'lucide-react';

interface Props {
  facts: string[];
}

/**
 * Brand-detail panel surfacing short narrative facts like "Carbon
 * negative since 2019" or "First B Corp distillery in Devon".
 * Verifiable one-liners only; no marketing puffery (the prompt
 * enforces this on the model side).
 */
export function BrandNotableFactsPanel({ facts }: Props) {
  if (facts.length === 0) return null;
  return (
    <div className="rounded-xl border border-neon-lime/30 bg-neon-lime/5 p-5 space-y-3">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-neon-lime" />
        Notable
        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
          {facts.length}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {facts.map((fact, i) => (
          <li
            key={i}
            className="text-[12px] rounded-full border border-neon-lime/30 bg-background/40 px-3 py-1 text-foreground/90"
          >
            {fact}
          </li>
        ))}
      </ul>
    </div>
  );
}
