'use client';

/**
 * Pulse -- Two-way sync between ?drill=<target> URL query and drill context.
 *
 * Behaviour:
 *   - On first mount, if ?drill=<...> is set, open the overlay with that target.
 *     The open is flagged as source='url' so engagement telemetry can ignore it.
 *   - When the user opens/closes the overlay, push/strip ?drill accordingly via
 *     shallow routing (no page reload, preserves scroll position).
 *   - Back/forward browser buttons naturally re-trigger the URL sync.
 */

import { useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { decodeDrillTarget, encodeDrillTarget } from '@/lib/pulse/drill-target';

export function usePulseDrillUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeTarget, open, openDrill, closeDrill } = useWidgetDrill();
  const hasInitialised = useRef(false);

  // On first mount, reflect any incoming ?drill= value.
  useEffect(() => {
    if (hasInitialised.current) return;
    hasInitialised.current = true;
    const raw = searchParams?.get('drill') ?? null;
    const decoded = decodeDrillTarget(raw);
    if (decoded) {
      openDrill(decoded, 'url');
    }
    // Run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync context state -> URL when the user opens/closes the drill.
  useEffect(() => {
    if (!hasInitialised.current) return; // avoid racing the mount effect
    const urlRaw = searchParams?.get('drill') ?? null;
    const urlTarget = decodeDrillTarget(urlRaw);
    const ctxRaw = open ? encodeDrillTarget(activeTarget) : null;

    // Normalise by comparing the encoded strings -- cheap and avoids JSON deps.
    const urlEncoded = urlTarget ? encodeDrillTarget(urlTarget) : null;
    if (ctxRaw === urlEncoded) return; // already in sync

    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (ctxRaw) {
      params.set('drill', ctxRaw);
    } else {
      params.delete('drill');
    }
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { scroll: false });
  }, [open, activeTarget, pathname, router, searchParams]);

  // React to back/forward: when the URL changes externally, reflect it.
  useEffect(() => {
    if (!hasInitialised.current) return;
    const raw = searchParams?.get('drill') ?? null;
    const decoded = decodeDrillTarget(raw);
    const ctxEncoded = open ? encodeDrillTarget(activeTarget) : null;
    const urlEncoded = decoded ? encodeDrillTarget(decoded) : null;
    if (ctxEncoded === urlEncoded) return;
    if (decoded) {
      openDrill(decoded, 'url');
    } else {
      closeDrill();
    }
    // We only want to react to URL changes here, not to open/activeTarget,
    // which are handled by the writer effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
