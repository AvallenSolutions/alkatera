import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Factory, Package, ClipboardList, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ActionCardProps {
  step: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  disabled?: boolean
}

function ActionCard({ step, title, description, icon, href, disabled }: ActionCardProps) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700">
        {icon}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{step}</p>
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={disabled}>
          <Link href={href}>
            {disabled ? 'Coming Soon' : 'Get Started'}
            {!disabled && <ArrowRight className="ml-1 h-3 w-3" />}
          </Link>
        </Button>
      </div>
    </div>
  )
}

export function GettingStartedWidget() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Getting Started</CardTitle>
        <p className="text-xs text-muted-foreground">
          Set up your sustainability management
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ActionCard
          step="Step 1"
          title="Define Operations"
          description="Add your facilities and utility meters"
          icon={<Factory className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          href="/company/facilities"
        />
        <ActionCard
          step="Step 2"
          title="Build Products"
          description="Create recipes using supplier data"
          icon={<Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          href="/products"
        />
        <ActionCard
          step="Step 3"
          title="Log Production"
          description="Track volumes to allocate impact"
          icon={<ClipboardList className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          href="/company/production-allocation"
        />
      </CardContent>
    </Card>
  )
}
