'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * URL-synced local tabs: ?tab= is read once at mount and written back on
 * every change via router.replace, so deep links, back/forward and
 * copied URLs all land on the right tab. The default tab keeps a clean URL.
 */
export function useUrlTab(defaultTab: string, param = 'tab'): [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<string>(() => searchParams?.get(param) ?? defaultTab);

  const change = useCallback(
    (next: string) => {
      setTab(next);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next === defaultTab) {
        params.delete(param);
      } else {
        params.set(param, next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, defaultTab, param]
  );

  return [tab, change];
}
