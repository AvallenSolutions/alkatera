'use client';

import { Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

/**
 * Read-only paywall banner.
 *
 * Shown for orgs whose trial has ended without converting (status 'cancelled').
 * Their data is preserved and viewable, but creating/editing and downloads are
 * blocked. A persistent CTA routes them to pick a plan.
 */
export function ReadOnlyPaywallBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative px-4 py-2.5 flex items-center justify-between gap-4 border-b',
        'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-900',
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="p-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400 shrink-0">
          <Lock className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium text-red-800 dark:text-red-200 truncate">
          Your free trial has ended. Your data is safe and viewable, but you&apos;ll need to
          subscribe to create, edit or download.
        </p>
      </div>

      <Button size="sm" variant="destructive" asChild>
        <Link href="/complete-subscription">
          Subscribe to continue
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
