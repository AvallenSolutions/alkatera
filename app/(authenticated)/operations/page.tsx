import { redirect } from 'next/navigation'

/**
 * /operations was a legacy duplicate of the facilities page (old Card/Badge
 * design), reachable only from the now-retired reports front door. The
 * canonical facilities surface is /company/facilities (the workbench), so
 * this redirects there. Kept as a redirect so any stale link keeps working;
 * a permanent move waits for the go-live redirect pass.
 */
export default function OperationsPage() {
  redirect('/company/facilities')
}
