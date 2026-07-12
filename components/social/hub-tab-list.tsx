'use client';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface HubTab {
  value: string;
  label: string;
}

/**
 * The hub's local tabs in the mono grammar: a hairline rule, the active
 * tab carrying a 3px underline in the room's accent. Pairs with the
 * shadcn Tabs root and useUrlTab for URL sync.
 */
export function HubTabList({ tabs }: { tabs: HubTab[] }) {
  return (
    <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-studio-hairline bg-transparent p-0">
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="relative -mb-px rounded-none border-b-[3px] border-transparent bg-transparent px-0 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground opacity-60 shadow-none transition-opacity duration-150 ease-studio hover:opacity-100 data-[state=active]:border-room-accent data-[state=active]:bg-transparent data-[state=active]:opacity-100 data-[state=active]:shadow-none"
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
