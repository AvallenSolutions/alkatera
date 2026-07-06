'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

/**
 * Trial countdown banner.
 *
 * Shown for orgs on a 30-day free trial. Reads subscription_expires_at (mirrored
 * from Stripe's trial_end by the webhook) and counts down to conversion, with an
 * always-present "Subscribe now" CTA. Turns amber in the final 5 days.
 */
export function TrialBanner({
  organizationId,
  className,
}: {
  organizationId: string;
  className?: string;
}) {
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from('organizations')
        .select('subscription_expires_at')
        .eq('id', organizationId)
        .maybeSingle();
      if (active) setExpiresAt(data?.subscription_expires_at ?? null);
    }
    if (organizationId) load();
    return () => {
      active = false;
    };
  }, [organizationId]);

  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const urgent = daysRemaining !== null && daysRemaining <= 5;

  return (
    <div
      className={cn(
        'relative px-4 py-2.5 flex items-center justify-between gap-4 border-b border-border bg-card',
        className
      )}
      role="status"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={cn(
            'p-1.5 rounded-full shrink-0 bg-secondary',
            urgent ? 'text-studio-attention' : 'text-room-accent'
          )}
        >
          {urgent ? <Clock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>
        <p className="text-sm font-medium truncate">
          {daysRemaining === null ? (
            <>You&apos;re on a free trial. Subscribe to unlock downloads and unlimited usage.</>
          ) : daysRemaining === 0 ? (
            <>Your free trial ends today. Subscribe to keep your access.</>
          ) : (
            <>
              <span className="font-semibold">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
              </span>{' '}
              in your free trial. Downloads unlock when you subscribe.
            </>
          )}
        </p>
      </div>

      <Button size="sm" asChild className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
        <Link href="/settings?tab=subscription">
          Subscribe now
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
