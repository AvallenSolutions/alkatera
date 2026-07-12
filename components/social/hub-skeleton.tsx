import { cn } from '@/lib/utils';

/**
 * The house loading state: quiet cream blocks, no shimmering card grids.
 */
export function HubSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)} aria-hidden="true">
      <div className="h-24 animate-pulse rounded-[6px] bg-studio-cream" />
      <div className="h-64 animate-pulse rounded-[6px] bg-studio-cream" />
      <div className="h-40 animate-pulse rounded-[6px] bg-studio-cream" />
    </div>
  );
}
