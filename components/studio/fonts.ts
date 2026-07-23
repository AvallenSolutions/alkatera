import { Bricolage_Grotesque } from 'next/font/google';

/**
 * Bricolage Grotesque speaks (statements, big numbers, card titles, the
 * wordmark). It replaced Space Grotesk as the design system's statement voice.
 * Loaded app-wide from app/layout.tsx on the redesign branch.
 */
export const spaceGrotesk = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
