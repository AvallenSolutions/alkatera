'use client';

import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRosaContext } from '@/lib/rosa/RosaContextProvider';
import { helpForPath, WIKI_TITLES } from '@/lib/support/help-map';
import { Eyebrow } from './eyebrow';

/**
 * The room band's "?" affordance (Phase 3 support spine, see
 * tasks/onboarding-support-plan.md). A quiet anchored panel: what this page
 * is for, up to three wiki pages that go deeper, and a one-click route into
 * Rosa. Radix Popover gives outside-click and Escape dismissal for free,
 * matching how the bell (NotificationBell) already behaves.
 */
export function HelpPanel() {
  const pathname = usePathname();
  const { askRosa } = useRosaContext();
  const entry = helpForPath(pathname);
  const wikiLinks = (entry?.wikiSlugs ?? []).slice(0, 3);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-current opacity-90 hover:opacity-100"
          aria-label="Help with this page"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-[6px] border border-studio-hairline bg-studio-cream p-4 text-foreground shadow-lg"
      >
        <Eyebrow tone="dim">This page</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {entry?.summary ?? 'Ask Rosa if you are not sure what this page is for.'}
        </p>

        {wikiLinks.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {wikiLinks.map((slug) => (
              <a
                key={slug}
                href={`/wiki/${slug}`}
                className="block text-sm text-studio-dim underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                {WIKI_TITLES[slug] ?? slug}
              </a>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-studio-hairline pt-3">
          <a
            href="/wiki"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
          >
            Search the wiki.
          </a>
          <button
            type="button"
            onClick={() => askRosa(entry?.rosaPrompt ?? 'Help me with this page.')}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent underline-offset-2 hover:underline"
          >
            Ask Rosa.
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
