import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        'neon-lime': 'border-neon-lime bg-neon-lime/10 text-neon-lime font-data',
        'neon-cyan': 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan font-data',
        'neon-purple': 'border-neon-purple bg-neon-purple/10 text-neon-purple font-data',
        'neon-emerald': 'border-neon-emerald bg-neon-emerald/10 text-neon-emerald font-data',
        success: 'border-transparent bg-green-500/10 text-green-500 dark:bg-green-400/10 dark:text-green-400',
        warning: 'border-transparent bg-orange-500/10 text-orange-500 dark:bg-orange-400/10 dark:text-orange-400',
        info: 'border-transparent bg-blue-500/10 text-blue-500 dark:bg-blue-400/10 dark:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
