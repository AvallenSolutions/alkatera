import Link from 'next/link';

export interface QuickAction {
  title: string;
  description: string;
  href: string;
}

/**
 * The hub's doors to its detail pages: quiet hairline blocks, no icon
 * medallions, no shadows. The title and one line are enough.
 */
export function QuickActionRow({ items }: { items: QuickAction[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group rounded-[6px] border border-studio-hairline bg-studio-cream p-4 transition-colors duration-200 ease-studio hover:border-studio-ink/40"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-sm font-semibold text-foreground">
              {item.title}
            </span>
            <span
              aria-hidden="true"
              className="font-mono text-[10px] text-studio-dim transition-colors group-hover:text-foreground"
            >
              &rarr;
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}
