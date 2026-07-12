import { redirect } from 'next/navigation'

/**
 * The old reports front door was a phantom: three tabs of hardcoded empty
 * states that fetched nothing. The real hub is the sustainability reports
 * page, so /reports/ now sends you straight there (the band's Reports tab
 * points there too). Kept as a redirect so any existing /reports/ link
 * keeps working; a permanent move waits for the go-live redirect pass.
 */
export default function ReportsPage() {
  redirect('/reports/sustainability')
}
