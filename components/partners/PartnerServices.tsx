import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ACCENT_STYLES, type PartnerServiceCategory } from '@/lib/partners/service-styles'

interface PartnerServicesProps {
  heading: string
  categories: PartnerServiceCategory[]
}

/**
 * Shared renderer for an expert partner's service catalogue. Each category gets an
 * accent-coloured header and a responsive grid of service cards. Used by every
 * partner detail page so the layout stays consistent across partners.
 */
export function PartnerServices({ heading, categories }: PartnerServicesProps) {
  return (
    <div className="space-y-10">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{heading}</h2>

      {categories.map((category) => {
        const styles = ACCENT_STYLES[category.accent]
        return (
          <div key={category.label} className="space-y-4">
            {/* Category header */}
            <div className={cn('pl-4 border-l-4', styles.section)}>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {category.label}
                </h3>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', styles.badge)}>
                  {category.services.length} {category.services.length === 1 ? 'service' : 'services'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{category.tagline}</p>
            </div>

            {/* Service cards */}
            <div className="grid gap-3 md:grid-cols-2">
              {category.services.map((service) => {
                const Icon = service.icon
                return (
                  <Card
                    key={service.title}
                    className={cn('transition-all duration-200 hover:shadow-md border', styles.cardBorder)}
                  >
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        <div className={cn('rounded-lg p-2.5 shrink-0 h-fit', styles.iconBg)}>
                          <Icon className={cn('h-5 w-5', styles.iconColor)} />
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-sm leading-snug text-slate-900 dark:text-slate-100">
                            {service.title}
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {service.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
