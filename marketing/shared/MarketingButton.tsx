'use client';

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

/**
 * The design system's Button (components/core/Button.jsx in the Claude
 * Design project), ported with the studio tokens inlined. Ink pill by
 * default; outline for the second voice.
 */
interface MarketingButtonProps {
  children: ReactNode;
  variant?: 'ink' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
  'aria-label'?: string;
}

const VARIANTS: Record<string, CSSProperties> = {
  ink: { background: '#1A1B1D', color: '#F2F1EA' },
  outline: { background: 'transparent', color: '#1A1B1D', border: '1px solid #1A1B1D' },
  ghost: { background: 'transparent', color: '#6F6F68' },
};

export function MarketingButton({
  children,
  variant = 'ink',
  size = 'md',
  onClick,
  style,
  ...rest
}: MarketingButtonProps) {
  const padding = size === 'sm' ? '7px 14px' : size === 'lg' ? '12px 24px' : '10px 20px';
  const fontSize = size === 'sm' ? 12.5 : size === 'lg' ? 15 : 13.5;
  return (
    <button
      type="button"
      className="mkt-btn"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-statement), 'Bricolage Grotesque', sans-serif",
        fontWeight: 600,
        fontSize,
        borderRadius: 999,
        padding,
        border: 'none',
        cursor: 'pointer',
        ...VARIANTS[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
