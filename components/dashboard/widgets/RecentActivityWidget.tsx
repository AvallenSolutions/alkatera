import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Activity,
  FileText,
  Users,
  Settings,
  AlertCircle,
  UserPlus,
  Building,
  Leaf,
  TrendingUp,
  Package,
  CheckCircle,
  Send
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivityStream } from "@/hooks/data/useActivityStream"
import { formatDistanceToNow } from "date-fns"

const eventTypeConfig: Record<string, {
  icon: any
  label: string
  color: string
  bgColor: string
}> = {
  USER_INVITED: {
    icon: Send,
    label: 'User Invited',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  USER_JOINED: {
    icon: UserPlus,
    label: 'User Joined',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  SUPPLIER_ADDED: {
    icon: Building,
    label: 'Supplier Added',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  SUPPLIER_INVITED: {
    icon: Send,
    label: 'Supplier Invited',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  SUPPLIER_ACTIVATED: {
    icon: CheckCircle,
    label: 'Supplier Activated',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  SUPPLIER_DATA_RECEIVED: {
    icon: Package,
    label: 'Data Received',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
  },
  EMISSION_DATA_ADDED: {
    icon: Leaf,
    label: 'Emissions Recorded',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  KPI_DATA_RECORDED: {
    icon: TrendingUp,
    label: 'KPI Updated',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  SYSTEM_NOTIFICATION: {
    icon: AlertCircle,
    label: 'System Event',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
  },
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-4 items-start p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-centre justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

function getEventDescription(eventType: string, details: Record<string, any>): string {
  switch (eventType) {
    case 'USER_INVITED':
      return `${details.user_name || details.user_email} was invited to join the organisation`
    case 'USER_JOINED':
      return `${details.user_name || details.user_email} joined as ${details.role}`
    case 'SUPPLIER_ADDED':
      return `${details.supplier_name} added to supplier network`
    case 'SUPPLIER_INVITED':
      return `${details.supplier_name} invited to provide data`
    case 'SUPPLIER_ACTIVATED':
      return `${details.supplier_name} is now active`
    case 'SUPPLIER_DATA_RECEIVED':
      return `${details.supplier_name} submitted emissions data`
    case 'EMISSION_DATA_ADDED':
      return `${details.total_emissions} ${details.unit} recorded for ${details.category} (${details.reporting_period})`
    case 'KPI_DATA_RECORDED':
      return `${details.kpi_name}: ${details.value} ${details.unit}`
    case 'SYSTEM_NOTIFICATION':
      return details.message || 'System notification'
    default:
      return 'Activity recorded'
  }
}

export function RecentActivityWidget() {
  const { data: activities, isLoading, error } = useActivityStream(10)

  const getEventConfig = (eventType: string) => {
    return eventTypeConfig[eventType] || {
      icon: Activity,
      label: eventType.replace(/_/g, ' ').toLowerCase(),
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    }
  }

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-centre gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest updates and changes</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
            </div>
          </ScrollArea>
        ) : error ? (
          <div className="flex flex-col items-centre justify-centre py-12 px-4 text-centre">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Activity</h3>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="flex flex-col items-centre justify-centre py-12 px-4 text-centre">
            <Activity className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
            <p className="text-sm text-muted-foreground">
              Activity will appear here once you start tracking emissions and managing your organisation
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {activities.map((activity) => {
                const config = getEventConfig(activity.event_type)
                const IconComponent = config.icon
                const description = getEventDescription(activity.event_type, activity.details)
                const timeAgo = formatDistanceToNow(new Date(activity.event_timestamp), {
                  addSuffix: true
                })

                return (
                  <div
                    key={activity.event_id}
                    className="flex gap-4 items-start p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colours"
                  >
                    <div className="mt-1">
                      <div className={`h-8 w-8 rounded-full ${config.bgColor} flex items-centre justify-centre`}>
                        <IconComponent className={`h-4 w-4 ${config.color}`} />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-centre justify-between gap-2">
                        <p className="text-sm font-medium leading-none">{config.label}</p>
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {timeAgo}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {description}
                      </p>
                      {activity.actor_name && activity.actor_name !== 'System' && (
                        <p className="text-xs text-muted-foreground">
                          by {activity.actor_name}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
