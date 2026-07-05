import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type PillVariant = 'ink' | 'outline' | 'room' | 'ghost';

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant;
  size?: 'sm' | 'md';
  href?: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<PillVariant, string> = {
  ink: 'bg-studio-ink text-studio-cream hover:bg-studio-ink/85',
  outline:
    'border border-studio-ink/25 bg-transparent text-foreground hover:border-studio-ink/60',
  room: 'bg-room text-room-on hover:opacity-90',
  ghost: 'bg-transparent text-studio-dim hover:bg-studio-ink/5 hover:text-foreground',
};

/**
 * Actions are pills. Ink is the default act, outline the second act,
 * the room's colour marks the one act the room exists for, ghost the rest.
 */
export function PillButton({
  variant = 'ink',
  size = 'md',
  href,
  className,
  children,
  ...props
}: PillButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-200 ease-studio focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    size === 'md' ? 'h-9 px-4 text-sm' : 'h-7 px-3 text-xs',
    VARIANT_CLASSES[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
