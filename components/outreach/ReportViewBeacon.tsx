'use client';

import { useEffect, useRef } from 'react';

/**
 * Fires a one-shot view beacon when a prospect opens /r/[token]. Rendered
 * (invisibly) by the report page. The server endpoint ignores authenticated
 * viewers, so this only registers genuine prospect opens.
 */
export default function ReportViewBeacon({ token }: { token: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    // keepalive so the beacon survives if the prospect navigates away quickly.
    void fetch('/api/outreach/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => {
      /* telemetry is best-effort; never affects the page */
    });
  }, [token]);

  return null;
}
