'use client'

/**
 * The org-less advisor's landing: an advisor account whose
 * advisor_organization_access rows are all gone (revoked, expired, or the
 * invite was never accepted). There is no organisation to open and no
 * arrival ritual to walk — advisors never create orgs — so AppLayout
 * renders this quiet studio screen in place. Previously this case was
 * redirected to /create-organization, which (once that page became a
 * bounce to /desk/) span in a redirect loop.
 */

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export function AdvisorNoAccess() {
  const router = useRouter()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-studio-cream">
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[6px] border border-studio-hairline bg-background p-9">
          <p className="mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-forest">
            alkatera·OS
          </p>
          <h1 className="mb-3 font-statement text-3xl font-bold tracking-tight text-foreground">
            No studio access yet.
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            Advisor access arrives by invitation from a client organisation.
            Open the invite link from your email to connect to their studio,
            or ask your client to send a fresh one. If something looks wrong,
            write to{' '}
            <a href="mailto:hello@alkatera.com" className="font-medium text-studio-forest underline underline-offset-2">
              hello@alkatera.com
            </a>{' '}
            and a human will sort it.
          </p>
          <button
            onClick={signOut}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Sign out
          </button>
        </div>
      </main>
      <footer className="px-7 pb-6">
        <p className="font-mono text-[10px] tracking-[0.08em] text-studio-dim">
          © 2026 ALKATERA LTD · AVALLEN SOLUTIONS LTD T/A ALKATERA
        </p>
      </footer>
    </div>
  )
}
