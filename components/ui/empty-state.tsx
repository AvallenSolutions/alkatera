import type { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Panel } from '@/components/studio/panel';
import { PillButton } from '@/components/studio/pill-button';
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

/** Cream panel, hairline border: the studio's generic "nothing here yet" shell. */
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
      <Panel className={cn('w-full', compact ? 'max-w-none' : 'max-w-md')}>
        <div className="flex flex-col items-center text-center space-y-4">
          {Icon && (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-studio-hairline bg-studio-ink/5">
              <Icon className="h-5 w-5 text-studio-dim" />
            </div>
          )}
          <div className="space-y-2">
            <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-studio-dim">{description}</p>
          </div>
          {action
            ? action
            : actionLabel && actionHref && <PillButton href={actionHref}>{actionLabel}</PillButton>}
        </div>
      </Panel>
    </div>
  );
}
