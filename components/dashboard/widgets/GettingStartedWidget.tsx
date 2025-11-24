import { Card, CardContent } from '@/components/ui/card'
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
    <Card className={disabled ? 'opacity-60' : ''}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                {icon}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{step}</p>
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button asChild className="w-full" disabled={disabled}>
            <Link href={href}>
              {disabled ? 'Coming Soon' : 'Get Started'}
              {!disabled && <ArrowRight className="ml-2 h-4 w-4" />}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function GettingStartedWidget() {
  return (
    <div className="col-span-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Getting Started</h2>
        <p className="text-sm text-muted-foreground">
          Follow these steps to set up your carbon management system
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard
          step="Step 1"
          title="Define Operations"
          description="Add your facilities and utility meters"
          icon={<Factory className="h-6 w-6 text-slate-700 dark:text-slate-300" />}
          href="/operations"
        />
        <ActionCard
          step="Step 2"
          title="Build Products"
          description="Create recipes using supplier data"
          icon={<Package className="h-6 w-6 text-slate-700 dark:text-slate-300" />}
          href="/products"
        />
        <ActionCard
          step="Step 3"
          title="Log Production"
          description="Track volumes to allocate impact"
          icon={<ClipboardList className="h-6 w-6 text-slate-700 dark:text-slate-300" />}
          href="/production"
        />
      </div>
    </div>
  )
}
