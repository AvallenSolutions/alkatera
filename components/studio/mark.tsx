import { cn } from '@/lib/utils';
import { STUDIO, type MarkShape } from './theme';

const CORNER_CLASSES = {
  br: '-bottom-8 -right-8',
  bl: '-bottom-8 -left-8',
  tr: '-top-8 -right-8',
  tl: '-top-8 -left-8',
} as const;

interface MarkProps {
  shape: MarkShape;
  /** 'paper': room colour at 8%. 'poster': cream at 20%, waking on hover. */
  tone?: 'paper' | 'poster';
  corner?: keyof typeof CORNER_CLASSES;
  className?: string;
}

/**
 * A maker's stamp: one geometric mark per surface, cropped by the nearest
 * corner, always behind content. The parent needs `relative` and
 * `overflow-hidden`; poster hover-wake needs `group` on the parent.
 * The mark never carries meaning; it is a signature, not an icon.
 */
export function Mark({ shape, tone = 'paper', corner = 'br', className }: MarkProps) {
  const fill = tone === 'poster' ? STUDIO.cream : 'rgb(var(--room-rgb))';

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn(
        'studio-mark pointer-events-none absolute h-40 w-40 select-none',
        CORNER_CLASSES[corner],
        tone === 'poster'
          ? 'opacity-20 group-hover:rotate-[8deg] group-hover:opacity-[0.28]'
          : 'opacity-[0.08]',
        className
      )}
    >
      {shape === 'circle' && <circle cx="50" cy="50" r="50" fill={fill} />}
      {shape === 'triangle' && <polygon points="50,2 98,98 2,98" fill={fill} />}
      {shape === 'square' && (
        <rect x="18" y="18" width="64" height="64" fill={fill} transform="rotate(14 50 50)" />
      )}
      {shape === 'quarter' && <path d="M 0 100 A 100 100 0 0 1 100 0 L 100 100 Z" fill={fill} />}
      {shape === 'diamond' && <polygon points="50,2 98,50 50,98 2,50" fill={fill} />}
      {shape === 'arch' && <path d="M 10 100 L 10 50 A 40 40 0 0 1 90 50 L 90 100 Z" fill={fill} />}
      {shape === 'ring' && (
        <circle cx="50" cy="50" r="36" fill="none" stroke={fill} strokeWidth="24" />
      )}
    </svg>
  );
}
