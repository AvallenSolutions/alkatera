'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface FactRowProps {
  /** Bold subject: a name, a brand, a thing. */
  subject: ReactNode;
  /** Quiet detail after the subject, separated by a middle dot. */
  detail?: ReactNode;
  /** Right-aligned mono meta: times, ages, scores. */
  meta?: ReactNode;
  href?: string;
  className?: string;
}

/** A fact on a hairline: bold subject, mono time. Detail is earned, not dumped. */
export function FactRow({ subject, detail, meta, href, className }: FactRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const row = (
    <div
      ref={ref}
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-studio-hairline py-3',
        shown ? 'studio-reveal' : 'opacity-0',
        className
      )}
    >
      <div className="min-w-0 truncate text-sm">
        <span className="font-display font-semibold text-foreground">{subject}</span>
        {detail ? <span className="text-studio-dim"> · {detail}</span> : null}
      </div>
      {meta ? (
        <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
          {meta}
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-colors duration-150 ease-studio hover:bg-studio-ink/[0.03]">
        {row}
      </Link>
    );
  }
  return row;
}
