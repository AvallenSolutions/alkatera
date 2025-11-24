import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, Circle, AlertTriangle, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export function ActionItemsWidget() {
  const placeholderItems = [
    {
      id: 1,
      title: 'Set up your operations',
      description: 'Add your facilities and utility meters to track operational data',
      priority: 'high' as const,
      status: 'pending' as const,
      dueDate: 'This week',
      href: '/operations',
    },
    {
      id: 2,
      title: 'Create your first product',
      description: 'Build product recipes using supplier data',
      priority: 'medium' as const,
      status: 'pending' as const,
      dueDate: 'Next week',
      href: '/products',
    },
    {
      id: 3,
      title: 'Configure team access',
      description: 'Invite team members and set up roles and permissions',
      priority: 'medium' as const,
      status: 'pending' as const,
      dueDate: 'Next month',
      href: '/settings',
    },
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
      case 'medium':
        return 'text-amber-500 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
      case 'low':
        return 'text-green-500 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
      default:
        return 'text-slate-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <Clock className="h-4 w-4" />
      default:
        return <Circle className="h-4 w-4" />
    }
  }

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Action Items
        </CardTitle>
        <CardDescription>Tasks and next steps</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {placeholderItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-semibold leading-none">{item.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pl-6">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getPriorityColor(item.priority)}`}
                      >
                        <span className="mr-1">{getPriorityIcon(item.priority)}</span>
                        {item.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{item.dueDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full" size="sm">
            View All Tasks
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
