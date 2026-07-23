import { Space_Grotesk } from 'next/font/google';

/**
 * The marketing site's statement face. Loaded here rather than in the root
 * layout so the app pages don't pay for it; the variable is applied on the
 * home page's root element.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-statement',
  display: 'swap',
});
