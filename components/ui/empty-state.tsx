import type { ReactNode } from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  /** Link-style action (label + href). For a button with an onClick, use `action`. */
  actionLabel?: string;
  actionHref?: string;
  /** Arbitrary action node (e.g. a Button with onClick). Takes precedence over actionLabel/Href. */
  action?: ReactNode;
  /** Drop the full-height centring for use inside a page section. */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={cn('flex items-center justify-center', compact ? '' : 'min-h-[60vh]')}>
      <Card className={cn('w-full', compact ? 'border-dashed' : 'max-w-md')}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {Icon && (
              <div className="rounded-full bg-muted p-3">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {action
              ? action
              : actionLabel && actionHref && (
                  <Button asChild>
                    <Link href={actionHref}>{actionLabel}</Link>
                  </Button>
                )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
