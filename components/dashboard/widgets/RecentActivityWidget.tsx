import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, FileText, Users, Settings, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export function RecentActivityWidget() {
  const placeholderActivities = [
    {
      id: 1,
      type: 'info',
      icon: AlertCircle,
      title: 'No recent activity',
      description: 'Activity will appear here once you start tracking emissions',
      time: 'Just now',
      variant: 'secondary' as const,
    },
  ]

  const getIconComponent = (IconComponent: any) => {
    return <IconComponent className="h-4 w-4" />
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
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {placeholderActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex gap-4 items-start p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="mt-1">
                  <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-centre justify-centre">
                    {getIconComponent(activity.icon)}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-centre justify-between gap-2">
                    <p className="text-sm font-medium leading-none">{activity.title}</p>
                    <Badge variant={activity.variant} className="text-xs">
                      {activity.time}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
