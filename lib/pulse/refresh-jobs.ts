/**
 * Single source of truth for the Pulse on-demand refresh jobs.
 *
 * These are the same five data jobs that normally run as scheduled Netlify
 * functions (see netlify.toml). The "Refresh data" button lets an owner/admin
 * run them on demand — but they're far too heavy to run synchronously in one
 * request (snapshots + per-org Gemini insights blow past the platform's sync
 * timeout, which is what produced the "<HTML>… is not valid JSON" gateway
 * error). They now run in the background via Inngest, one `step.run` per job,
 * with progress written to `pulse_refresh_runs` and polled by the UI.
 *
 * The `path` fields are public route paths (no secrets), so this module is safe
 * to import from both the client (button labels) and the server (Inngest fetch).
 */

export const PULSE_REFRESH_JOBS = [
  { key: 'snapshots', label: 'Daily snapshots', path: '/api/cron/generate-snapshots' },
  { key: 'anomalies', label: 'Anomaly detection', path: '/api/cron/detect-anomalies' },
  { key: 'grid_carbon', label: 'Grid carbon', path: '/api/cron/refresh-grid-carbon' },
  { key: 'insights', label: 'Insights', path: '/api/cron/generate-insights' },
  { key: 'shadow_prices', label: 'Shadow prices', path: '/api/cron/refresh-shadow-prices' },
] as const;

export type PulseJobKey = (typeof PULSE_REFRESH_JOBS)[number]['key'];

export type PulseJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PulseJobState {
  status: PulseJobStatus;
  httpStatus?: number;
  error?: string;
}

export type PulseRefreshStatus = 'queued' | 'running' | 'completed' | 'failed';

/** The shape returned by GET /api/pulse/admin/refresh/status. */
export interface PulseRefreshRun {
  id: string;
  status: PulseRefreshStatus;
  jobs: Record<string, PulseJobState>;
  error: string | null;
}

/** Seed a fresh jobs map with every job pending. */
export function seedPulseJobs(): Record<PulseJobKey, PulseJobState> {
  return Object.fromEntries(
    PULSE_REFRESH_JOBS.map((j) => [j.key, { status: 'pending' as const }]),
  ) as Record<PulseJobKey, PulseJobState>;
}
