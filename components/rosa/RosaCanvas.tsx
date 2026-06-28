'use client'

import { useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ForYouToday } from './ForYouToday'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'

// Round 1 (auto-research /rosa): RosaQueue only renders on the non-default
// `?view=queue` surface, so it needn't sit in /rosa's First Load JS.
const RosaQueue = dynamic(() => import('@/components/agents/RosaQueue').then((m) => m.RosaQueue), { ssr: false })

/**
 * Single-canvas Rosa.
 *
 * Two surfaces, one shell:
 *   1. "home"   — ForYouToday cards (welcome, what needs you, ask Rosa,
 *                 recently, conversations, quick actions)
 *   2. "queue"  — RosaQueue (the agent's exception queue)
 *
 * When the user submits a prompt — via the welcome chips, the Ask Rosa
 * card, the input bar, or a deep-link `?prompt=` — the home cards get
 * replaced inline by a streaming conversation. The sticky input bar at
 * the bottom keeps feeding the SAME conversation; it doesn't reload, it
 * doesn't switch routes, and it doesn't render the old GaiaChat layout.
 *
 * "New chat" on the conversation header clears the thread and the home
 * cards return.
 */
export function RosaCanvas({ initialPrompt }: { initialPrompt?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const rosa = useRosaContext()

  // /rosa/ is now a *hub* for deep work with Rosa — past activity, queue
  // access, the welcome/quick-prompt cards. Conversations don't happen
  // here; they happen in the right-side drawer (which is mounted by
  // AppLayout and available on every page). Clicking a chip on the hub
  // opens the drawer and seeds the prompt — same UX everywhere.
  const showQueue = viewParam === 'queue'

  // Deep-link `/rosa/?prompt=...` opens the drawer and seeds the prompt.
  useEffect(() => {
    if (initialPrompt) {
      rosa.askRosa(initialPrompt)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('prompt')
      router.replace(`/rosa/${params.toString() ? `?${params.toString()}` : ''}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  const setView = useCallback(
    (next: 'home' | 'queue') => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'home') params.delete('view')
      else params.set('view', next)
      router.replace(`/rosa/${params.toString() ? `?${params.toString()}` : ''}`)
    },
    [router, searchParams],
  )

  // When a hub chip asks Rosa something, open the drawer with the prompt
  // seeded — no page takeover, the drawer handles the conversation.
  const handleAsk = useCallback(
    (prompt: string) => rosa.askRosa(prompt),
    [rosa],
  )

  const handleOpenQueue = useCallback(() => setView('queue'), [setView])
  const handleBackToHome = useCallback(() => setView('home'), [setView])

  if (showQueue) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToHome}
          className="text-muted-foreground hover:text-foreground -ml-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
        </Button>
        <RosaQueue />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
      <ForYouToday onOpenQueue={handleOpenQueue} onSubmit={handleAsk} />
    </div>
  )
}
