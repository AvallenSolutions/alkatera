'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/hooks/useNotifications'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Bell, MessageSquare, MessageCircle, AlertTriangle, CheckCheck, Inbox, Users } from 'lucide-react'

function getRelativeTime(dateString: string): string {
  const now = Date.now()
  const date = new Date(dateString).getTime()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) return `${diffWeeks}w ago`

  return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'feedback_ticket':
      return <MessageSquare className="h-4 w-4 text-amber-500 shrink-0" />
    case 'feedback_message':
      return <MessageCircle className="h-4 w-4 text-blue-500 shrink-0" />
    case 'feedback_reply':
      return <MessageCircle className="h-4 w-4 text-emerald-500 shrink-0" />
    case 'escalation':
    case 'ticket_escalated':
      return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
    case 'advisor_message':
      return <Users className="h-4 w-4 text-purple-500 shrink-0" />
    default:
      return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
  }
}

function getNotificationRoute(
  notification: { entity_type: string | null; entity_id: string | null; notification_type: string },
  isAdmin: boolean
): string | null {
  if (notification.entity_type === 'feedback_ticket' && notification.entity_id) {
    return isAdmin
      ? `/admin/feedback/${notification.entity_id}`
      : `/settings/feedback/${notification.entity_id}`
  }
  if (notification.entity_type === 'advisor_conversation' && notification.entity_id) {
    return `/settings/messages/${notification.entity_id}`
  }
  return null
}

export function NotificationBell() {
  const { isAlkateraAdmin } = useIsAlkateraAdmin()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    const route = getNotificationRoute(notification, isAlkateraAdmin)
    if (route) {
      setOpen(false)
      router.push(route)
    }
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
  }

  const feedbackRoute = isAlkateraAdmin ? '/admin/feedback' : '/settings/feedback'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">
            Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => {
              return (
                <button
                  key={notification.id}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent transition-colors flex items-start gap-3 ${
                    !notification.is_read ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug truncate ${!notification.is_read ? 'font-semibold' : ''}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {getRelativeTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setOpen(false)
                router.push(feedbackRoute)
              }}
            >
              {isAlkateraAdmin ? 'View all feedback' : 'View your tickets'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
