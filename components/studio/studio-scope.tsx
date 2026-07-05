'use client';

import { useEffect } from 'react';

/**
 * Puts the studio theme classes on <html> for the distributor section.
 *
 * The inline script runs during HTML parse, before first paint, so there
 * is no dark flash. The classes must live on <html> (not a wrapper div)
 * because Radix portals mount on document.body and would otherwise miss
 * both the theme variables and the display font. The effect cleans the
 * classes up again on client-side navigation away from the portal.
 */
export function StudioScope({ fontClass }: { fontClass: string }) {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add('studio', fontClass);
    return () => {
      el.classList.remove('studio', fontClass);
    };
  }, [fontClass]);

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.classList.add('studio',${JSON.stringify(
          fontClass
        )});`,
      }}
    />
  );
}
