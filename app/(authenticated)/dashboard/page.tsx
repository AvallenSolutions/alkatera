import { redirect } from 'next/navigation'

// Dashboard absorbed into Rosa. The vitality strip + headline stats now live
// at the top of /rosa/'s "For you today" canvas, with deeper drill-downs
// reachable via the "Full breakdown" link or by asking Rosa directly.
//
// We keep this route for a few reasons:
//   1. Existing deep-links (emails, marketing pages, Slack messages)
//   2. ?view=vitality opens the deeper breakdown that Rosa's strip points at
//      (TODO Phase B: render the vitality breakdown here under a thin shell
//      rather than redirecting; for now the strip's link goes home with a
//      view query param Rosa's canvas can route to.)
export default function DashboardRedirect() {
  redirect('/rosa/')
}
