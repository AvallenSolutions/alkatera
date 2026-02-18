'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'

/**
 * Persistent banner shown at top of the app when the current user has
 * unread admin replies on their feedback tickets.
 * Dismissible per session — reappears on next page load if still unread.
 */
export function UnreadRepliesBanner() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    async function checkUnread() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      // Get user's tickets
      const { data: tickets } = await supabase
        .from('feedback_tickets')
        .select('id')
        .eq('created_by', userData.user.id)

      if (!tickets || tickets.length === 0) return

      // Count unread admin replies
      const { count } = await supabase
        .from('feedback_messages')
        .select('id', { count: 'exact', head: true })
        .in('ticket_id', tickets.map((t) => t.id))
        .eq('is_admin_reply', true)
        .eq('is_read', false)

      setUnreadCount(count || 0)
    }

    checkUnread()
  }, [])

  if (unreadCount === 0 || dismissed) return null

  return (
    <div className="bg-lime-500/10 border-b border-lime-500/20 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <MessageCircle className="h-4 w-4 text-lime-500" />
          <span>
            You have{' '}
            <strong className="text-lime-400">
              {unreadCount} unread {unreadCount === 1 ? 'reply' : 'replies'}
            </strong>{' '}
            from the alkatera team.
          </span>
          <Link
            href="/settings/feedback"
            className="font-medium text-lime-400 hover:text-lime-300 underline underline-offset-2"
          >
            View messages
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
