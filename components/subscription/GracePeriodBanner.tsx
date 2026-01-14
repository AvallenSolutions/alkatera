'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface GracePeriodBannerProps {
  gracePeriodEnd: string;
  resourceType: string;
  currentUsage: number;
  limit: number;
  onDismiss?: () => void;
  className?: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  facilities: 'facilities',
  products: 'products',
  team_members: 'team members',
  lcas: 'LCAs',
  suppliers: 'suppliers',
};

const RESOURCE_LINKS: Record<string, string> = {
  facilities: '/facilities',
  products: '/products',
  team_members: '/settings?tab=team',
  lcas: '/products',
  suppliers: '/suppliers',
};

export function GracePeriodBanner({
  gracePeriodEnd,
  resourceType,
  currentUsage,
  limit,
  onDismiss,
  className,
}: GracePeriodBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const end = new Date(gracePeriodEnd);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        return null;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      return { days, hours, minutes };
    };

    setTimeRemaining(calculateTimeRemaining());

    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [gracePeriodEnd]);

  if (dismissed || !timeRemaining) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in session storage so it reappears next session
    sessionStorage.setItem('gracePeriodBannerDismissed', 'true');
    onDismiss?.();
  };

  // Determine urgency level
  const totalHours = timeRemaining.days * 24 + timeRemaining.hours;
  const urgencyLevel: 'low' | 'medium' | 'high' =
    totalHours <= 24 ? 'high' : totalHours <= 72 ? 'medium' : 'low';

  const resourceLabel = RESOURCE_LABELS[resourceType] || resourceType;
  const resourceLink = RESOURCE_LINKS[resourceType] || '/settings';
  const excessCount = currentUsage - limit;

  return (
    <div
      className={cn(
        'relative px-4 py-3 flex items-center justify-between gap-4',
        urgencyLevel === 'high' && 'bg-red-50 border-b border-red-200 dark:bg-red-950/50 dark:border-red-900',
        urgencyLevel === 'medium' && 'bg-amber-50 border-b border-amber-200 dark:bg-amber-950/50 dark:border-amber-900',
        urgencyLevel === 'low' && 'bg-yellow-50 border-b border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-900',
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          className={cn(
            'p-2 rounded-full',
            urgencyLevel === 'high' && 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
            urgencyLevel === 'medium' && 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400',
            urgencyLevel === 'low' && 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400'
          )}
        >
          {urgencyLevel === 'high' ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Clock className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1">
          <p
            className={cn(
              'text-sm font-medium',
              urgencyLevel === 'high' && 'text-red-800 dark:text-red-200',
              urgencyLevel === 'medium' && 'text-amber-800 dark:text-amber-200',
              urgencyLevel === 'low' && 'text-yellow-800 dark:text-yellow-200'
            )}
          >
            <span className="font-semibold">
              {timeRemaining.days > 0
                ? `${timeRemaining.days} day${timeRemaining.days !== 1 ? 's' : ''}`
                : timeRemaining.hours > 0
                ? `${timeRemaining.hours} hour${timeRemaining.hours !== 1 ? 's' : ''}`
                : `${timeRemaining.minutes} minute${timeRemaining.minutes !== 1 ? 's' : ''}`}
            </span>{' '}
            to reduce your {resourceLabel} from{' '}
            <span className="font-semibold">{currentUsage}</span> to{' '}
            <span className="font-semibold">{limit}</span>
            {' '}or the oldest {excessCount} {excessCount === 1 ? 'item' : 'items'} will be automatically removed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={urgencyLevel === 'high' ? 'destructive' : 'default'}
            asChild
          >
            <Link href={resourceLink}>
              Manage {resourceLabel}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className={cn(
              'p-1 h-auto',
              urgencyLevel === 'high' && 'text-red-600 hover:text-red-800 hover:bg-red-100',
              urgencyLevel === 'medium' && 'text-amber-600 hover:text-amber-800 hover:bg-amber-100',
              urgencyLevel === 'low' && 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100'
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Wrapper component that fetches grace period data
export function GracePeriodBannerWrapper({
  organizationId,
  className,
}: {
  organizationId: string;
  className?: string;
}) {
  const [gracePeriodData, setGracePeriodData] = useState<{
    gracePeriodEnd: string;
    resourceType: string;
    currentUsage: number;
    limit: number;
  } | null>(null);

  useEffect(() => {
    async function fetchGracePeriodData() {
      try {
        const response = await fetch(`/api/organizations/${organizationId}/grace-period`);
        if (response.ok) {
          const data = await response.json();
          if (data.gracePeriodEnd) {
            setGracePeriodData(data);
          }
        }
      } catch (error) {
        console.error('Error fetching grace period data:', error);
      }
    }

    if (organizationId) {
      fetchGracePeriodData();
    }
  }, [organizationId]);

  if (!gracePeriodData) {
    return null;
  }

  return (
    <GracePeriodBanner
      gracePeriodEnd={gracePeriodData.gracePeriodEnd}
      resourceType={gracePeriodData.resourceType}
      currentUsage={gracePeriodData.currentUsage}
      limit={gracePeriodData.limit}
      className={className}
    />
  );
}
