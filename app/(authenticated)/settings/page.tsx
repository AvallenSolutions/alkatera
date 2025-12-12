'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Users, Building2, Truck, Plus, CreditCard, Check, Sparkles, Crown, Gem, Star, Infinity } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { useSubscription, TierName } from '@/hooks/useSubscription'
import { TierBadge } from '@/components/subscription/TierBadge'
import { UsageMeter } from '@/components/subscription/UsageMeter'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const {
    usage,
    tierName,
    tierDisplayName,
    subscriptionStatus,
    allTiers,
    isLoading,
  } = useSubscription()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Manage your account, team, and organisation settings
        </p>
      </div>

      <Tabs defaultValue="subscription" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  Your subscription details and billing information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-8 w-32 bg-muted rounded" />
                    <div className="h-4 w-48 bg-muted rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <TierBadge tier={tierName} size="lg" />
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        subscriptionStatus === 'active' && "bg-green-100 text-green-700",
                        subscriptionStatus === 'trial' && "bg-blue-100 text-blue-700",
                        subscriptionStatus === 'suspended' && "bg-amber-100 text-amber-700",
                        subscriptionStatus === 'cancelled' && "bg-red-100 text-red-700"
                      )}>
                        {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {allTiers.find(t => t.tier_name === tierName)?.description || 'Manage your sustainability tracking'}
                    </p>
                    <Button variant="outline" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Upgrade Plan
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage This Month</CardTitle>
                <CardDescription>
                  Track your resource consumption against plan limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading || !usage ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-2 w-full bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <UsageMeter
                      label="Products"
                      current={usage.usage.products.current}
                      max={usage.usage.products.max}
                      isUnlimited={usage.usage.products.is_unlimited}
                    />
                    <UsageMeter
                      label="Reports (Monthly)"
                      current={usage.usage.reports_monthly.current}
                      max={usage.usage.reports_monthly.max}
                      isUnlimited={usage.usage.reports_monthly.is_unlimited}
                    />
                    <UsageMeter
                      label="LCAs"
                      current={usage.usage.lcas.current}
                      max={usage.usage.lcas.max}
                      isUnlimited={usage.usage.lcas.is_unlimited}
                    />
                    <UsageMeter
                      label="Team Members"
                      current={usage.usage.team_members.current}
                      max={usage.usage.team_members.max}
                      isUnlimited={usage.usage.team_members.is_unlimited}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Compare Plans</CardTitle>
              <CardDescription>
                Find the right plan for your organisation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {allTiers.map((tier) => {
                  const isCurrent = tier.tier_name === tierName
                  const tierIcons: Record<TierName, React.ComponentType<{ className?: string }>> = {
                    basic: Star,
                    premium: Gem,
                    enterprise: Crown,
                  }
                  const Icon = tierIcons[tier.tier_name]

                  return (
                    <div
                      key={tier.tier_name}
                      className={cn(
                        "relative rounded-lg border p-6",
                        isCurrent && "border-neon-lime bg-neon-lime/5",
                        tier.tier_name === 'premium' && !isCurrent && "border-blue-200"
                      )}
                    >
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="rounded-full bg-neon-lime px-3 py-1 text-xs font-medium text-black">
                            Current Plan
                          </span>
                        </div>
                      )}
                      {tier.tier_name === 'premium' && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                            Popular
                          </span>
                        </div>
                      )}

                      <div className="mb-4 flex items-center gap-2 pt-2">
                        <Icon className={cn(
                          "h-5 w-5",
                          tier.tier_name === 'basic' && "text-slate-500",
                          tier.tier_name === 'premium' && "text-blue-500",
                          tier.tier_name === 'enterprise' && "text-amber-500"
                        )} />
                        <span className="font-semibold">{tier.display_name}</span>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                        {tier.description}
                      </p>

                      <ul className="space-y-2 mb-6">
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_products ?? <Infinity className="h-3 w-3 inline" />} Products</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_reports_per_month ?? <Infinity className="h-3 w-3 inline" />} Reports/month</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_team_members ?? <Infinity className="h-3 w-3 inline" />} Team members</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_lcas ?? <Infinity className="h-3 w-3 inline" />} LCAs</span>
                        </li>
                      </ul>

                      {isCurrent ? (
                        <Button variant="outline" className="w-full" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          variant={tier.tier_name === 'premium' ? 'default' : 'outline'}
                          className="w-full"
                        >
                          {tier.tier_level > (allTiers.find(t => t.tier_name === tierName)?.tier_level || 1) ? 'Upgrade' : 'Contact Us'}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Settings
              </CardTitle>
              <CardDescription>
                Manage your personal account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/settings/profile">Edit Profile</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Management
              </CardTitle>
              <CardDescription>
                Invite members, manage roles and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/settings/team">Manage Team</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Supplier Management
              </CardTitle>
              <CardDescription>
                Add and manage your suppliers for supply chain tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Truck className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Suppliers Added</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start tracking your supply chain by adding your suppliers
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Supplier
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organisation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organisation Details
              </CardTitle>
              <CardDescription>
                View and update your organisation information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/company/overview">View Organisation</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
