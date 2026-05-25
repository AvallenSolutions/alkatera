import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminSourcingRedirectPage() {
  // The standalone Find Brands page was folded into the unified intake
  // page (alongside Paste a list and CSV upload). Keep the old URL alive
  // for any external links / muscle memory.
  redirect('/admin/directory/intake');
}
