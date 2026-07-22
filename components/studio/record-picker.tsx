'use client';

/**
 * Pick a record you already have, by typing part of its name.
 *
 * The composition surface asks the same question in three places ("which
 * liquid?", "which pack format?", and from a product, "which one instead?"),
 * and the entry design (`tasks/liquid-pack-entry-design.md` §4) says every
 * slot offers "pick existing" FIRST, with search. A dropdown answers a
 * different question: it assumes a short list you can eyeball. A producer with
 * forty liquids cannot eyeball forty liquids.
 *
 * So this is a search field over a plain list, not a Radix Select. That also
 * makes the flow testable: a popper rendered into a portal outside the layout
 * cannot be driven from the browser pane, which is exactly why the L1/L2
 * switch flow shipped unverified.
 */

import { useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

export interface RecordPickerOption {
  id: string;
  name: string;
  /** Quiet second line, e.g. "3 formats" or "700 ml · glass". */
  hint?: string;
}

interface RecordPickerProps {
  options: RecordPickerOption[];
  onSelect: (id: string) => void;
  placeholder?: string;
  /** Shown when the org has none of this record yet. */
  emptyLabel?: string;
  /** Distinguishes the inputs when two pickers share a screen. */
  id?: string;
  autoFocus?: boolean;
  /** Cap on rows rendered before scrolling; the rest stay reachable by typing. */
  maxVisible?: number;
}

export function RecordPicker({
  options,
  onSelect,
  placeholder = 'Search',
  emptyLabel = 'Nothing to pick yet.',
  id,
  autoFocus = true,
  maxVisible = 6,
}: RecordPickerProps) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="w-full">
      <Input
        id={id}
        value={query}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter commits the only remaining match: the fast path once you
          // have typed enough to be unambiguous.
          if (e.key === 'Enter' && matches.length === 1) {
            e.preventDefault();
            onSelect(matches[0].id);
          }
        }}
        className="h-9 text-xs"
        aria-label={placeholder}
      />

      <div
        ref={listRef}
        role="listbox"
        className="mt-2 divide-y divide-studio-hairline overflow-y-auto rounded-[4px] border border-studio-hairline"
        style={{ maxHeight: `${maxVisible * 44}px` }}
      >
        {matches.length === 0 ? (
          <p className="px-3 py-3 font-mono text-[10px] text-studio-dim">
            {options.length === 0 ? emptyLabel : `Nothing matches "${query.trim()}".`}
          </p>
        ) : (
          matches.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onSelect(o.id)}
              className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-studio-hairline/40"
            >
              <span className="min-w-0 truncate text-[13px] text-studio-ink">{o.name}</span>
              {o.hint && (
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.16em] text-studio-dim">
                  {o.hint}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
