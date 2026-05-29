'use client';

/**
 * Pulse -- per-card explainer.
 *
 * A small "i" affordance in the card header. Clicking it opens a popover with
 * a fixed, plain-language structure: what this shows, why it matters, what to
 * do next, and where the number comes from. Modelled figures carry an
 * "Estimate" badge so we never present a modelled number as measured fact.
 *
 * Copy lives on each widget in the registry (WidgetMeta.explainer), so this
 * component is purely presentational.
 */

import { Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { WidgetExplainer } from '@/lib/pulse/widget-registry';

export function PulseExplainer({
  label,
  explainer,
}: {
  label: string;
  explainer: WidgetExplainer;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Stop the click bubbling to the whole-card drill button.
          onClick={e => e.stopPropagation()}
          aria-label={`What is ${label}?`}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-50 transition hover:text-foreground hover:opacity-100 data-[state=open]:opacity-100"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-72 text-left"
        onClick={e => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              {label}
            </p>
            {explainer.isEstimate && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                Estimate
              </span>
            )}
          </div>

          <Field heading="What this shows" body={explainer.what} />
          <Field heading="Why it matters" body={explainer.why} />
          {explainer.todo && <Field heading="What to do next" body={explainer.todo} />}
          {explainer.source && (
            <Field heading="Where this comes from" body={explainer.source} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#ccff00]">
        {heading}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
