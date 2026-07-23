import { Bricolage_Grotesque } from 'next/font/google';

/**
 * The marketing site's statement face: Bricolage Grotesque, the design
 * system's statement voice (it replaced Space Grotesk). Loaded here rather
 * than in the root layout so the app pages don't pay for it; the variable
 * is applied on each marketing page's root element.
 */
export const spaceGrotesk = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-statement',
  display: 'swap',
});
