import { Space_Grotesk } from 'next/font/google';

/**
 * Space Grotesk speaks (statements, big numbers, card titles).
 * Loaded app-wide from app/layout.tsx on the redesign branch.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
