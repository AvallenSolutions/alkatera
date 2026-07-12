'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Panel, Statement } from '@/components/studio'
import { useSubscription } from '@/hooks/useSubscription'
import { GracePeriodBanner } from '@/components/subscription/GracePeriodBanner'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { FeatureGate } from '@/components/subscription/FeatureGate'
// Round 5 (auto-research): only one settings tab is visible at a time, so the
// other panels needn't be in /settings' First Load JS. Lazy-load all panels.
const ProfileSettings = dynamic(() => import('@/components/settings/ProfileSettings').then((m) => m.ProfileSettings), { ssr: false })
const DataPrivacySettings = dynamic(() => import('@/components/settings/DataPrivacySettings').then((m) => m.DataPrivacySettings), { ssr: false })
const TeamSettings = dynamic(() => import('@/components/settings/TeamSettings').then((m) => m.TeamSettings), { ssr: false })
const OrganisationSettings = dynamic(() => import('@/components/settings/OrganisationSettings').then((m) => m.OrganisationSettings), { ssr: false })
const SupportSettings = dynamic(() => import('@/components/settings/SupportSettings').then((m) => m.SupportSettings), { ssr: false })
const IntegrationsSettings = dynamic(() => import('@/components/settings/IntegrationsSettings').then((m) => m.IntegrationsSettings), { ssr: false })
const VineyardSettings = dynamic(() => import('@/components/settings/VineyardSettings').then((m) => m.VineyardSettings), { ssr: false })
const LcaTemplatesSettings = dynamic(() => import('@/components/settings/LcaTemplatesSettings').then((m) => m.LcaTemplatesSettings), { ssr: false })
const SubscriptionSettings = dynamic(() => import('@/components/settings/SubscriptionSettings').then((m) => m.SubscriptionSettings), { ssr: false })
const BillingSettings = dynamic(() => import('@/components/settings/BillingSettings').then((m) => m.BillingSettings), { ssr: false })
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { isViticultureEligible } from '@/lib/viticulture-utils'

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization, userRole } = useOrganization()

  // Check if user is an admin (owner or admin)
  const isOrgAdmin = userRole === 'owner' || userRole === 'admin'
  const { isAlkateraAdmin } = useIsAlkateraAdmin()
  const showVineyards = isViticultureEligible(currentOrganization, isAlkateraAdmin)
  const { usage, subscriptionStatus } = useSubscription()

  const [organizationData, setOrganizationData] = useState<any>(null)

  // Two-way tab sync: the URL is the single source of truth. Reading ?tab=
  // keeps the 8 inbound deep-link sources working; writing it back on change
  // fixes browser back/forward inside settings.
  const activeTab = searchParams.get('tab') || (isOrgAdmin ? 'subscription' : 'profile')

  function handleTabChange(value: string) {
    router.replace(`/settings?tab=${value}`, { scroll: false })
  }

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated successfully!')
      router.replace('/dashboard')
    }
    if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout cancelled, please select a plan to continue')
      router.replace('/settings')
    }
    if (searchParams.get('payment_required') === 'true') {
      toast.info('Please complete your subscription to access the platform')
      router.replace('/settings')
    }
    if (searchParams.get('complete_subscription') === 'true') {
      toast.info('Organisation created! Now select a plan to get started.')
      router.replace('/settings')
    }
    // Xero OAuth callback results - pass through to XeroConnectionCard
    // which handles auto-sync. Only intercept errors here.
    if (searchParams.get('xero') === 'error') {
      toast.error(searchParams.get('message') || 'Failed to connect Xero')
      router.replace('/settings?tab=integrations')
    }
  }, [searchParams, router])

  useEffect(() => {
    if (currentOrganization) {
      fetchOrganizationData()
    }
  }, [currentOrganization])

  async function fetchOrganizationData() {
    if (!currentOrganization) return

    try {
      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', currentOrganization.id)
        .single()

      if (error) throw error
      setOrganizationData(org)
    } catch (error) {
      console.error('Error fetching organization data:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Subscription Required Banner - only shown to admins */}
      {isOrgAdmin && subscriptionStatus !== 'active' && subscriptionStatus !== 'trial' && (
        <Panel className="mb-2 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-studio-attention" />
            <div>
              <h3 className="font-semibold text-foreground">
                Subscription Required
              </h3>
              <p className="mt-1 text-sm text-studio-dim">
                Please select a plan below to access the alkatera platform.
                Choose from Seed or Blossom to get started, or contact us for Canopy.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Grace Period Banner - only shown to admins */}
      {isOrgAdmin && organizationData?.grace_period_end && (
        <GracePeriodBanner
          gracePeriodEnd={organizationData.grace_period_end}
          resourceType={organizationData.grace_period_resource_type || 'items'}
          currentUsage={usage?.usage?.[organizationData.grace_period_resource_type as keyof typeof usage.usage]?.current || 0}
          limit={usage?.usage?.[organizationData.grace_period_resource_type as keyof typeof usage.usage]?.max || 0}
        />
      )}

      <div className="space-y-3">
        <Statement eyebrow="THE WIRING · SETTINGS" headline="The wiring." />
        <p className="text-sm text-studio-dim">
          Manage your account, team, and organisation settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          {isOrgAdmin && (
            <>
              <TabsTrigger value="subscription">Subscription</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </>
          )}
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {isOrgAdmin && (
            <>
              <TabsTrigger value="team">Team</TabsTrigger>
              {showVineyards && <TabsTrigger value="vineyards">Vineyards</TabsTrigger>}
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="lca-templates">LCA templates</TabsTrigger>
            </>
          )}
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        {isOrgAdmin && <TabsContent value="subscription" className="space-y-6">
          <SubscriptionSettings
            organizationData={organizationData}
            onSubscriptionChanged={fetchOrganizationData}
          />
        </TabsContent>}

        {isOrgAdmin && <TabsContent value="billing" className="space-y-4">
          <BillingSettings organizationData={organizationData} />
        </TabsContent>}

        <TabsContent value="profile" className="space-y-4">
          <ProfileSettings showHeader={false} />
          <DataPrivacySettings />
        </TabsContent>

        {isOrgAdmin && <TabsContent value="team" className="space-y-4">
          <TeamSettings showHeader={false} />
        </TabsContent>}

        {isOrgAdmin && showVineyards && <TabsContent value="vineyards" className="space-y-4">
          <FeatureGate feature="viticulture_beta">
            <VineyardSettings />
          </FeatureGate>
        </TabsContent>}

        {isOrgAdmin && <TabsContent value="integrations" className="space-y-4">
          <IntegrationsSettings showHeader={false} />
        </TabsContent>}

        {isOrgAdmin && <TabsContent value="lca-templates" className="space-y-4">
          <LcaTemplatesSettings showHeader={true} />
        </TabsContent>}

        <TabsContent value="organisation" className="space-y-4">
          <OrganisationSettings showHeader={false} />
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <SupportSettings showHeader={false} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
