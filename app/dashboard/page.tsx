"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/lib/organizationContext"
import { ProtectedLayout } from "@/components/layouts/ProtectedLayout"
import { Button } from "@/components/ui/button"
import { LogOut, Loader2, Settings } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import {
  KPISnapshotWidget,
  GHGEmissionsSummaryWidget,
  RecentActivityWidget,
  ActionItemsWidget,
  SupplierEngagementWidget,
} from "@/components/dashboard/widgets"

export default function DashboardPage() {
  const router = useRouter()
  const { currentOrganization, userRole } = useOrganization()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="container mx-auto py-8 px-4 lg:px-8 max-w-[1600px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-centre justify-between gap-4 mb-8">
            <div className="space-y-1">
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                {currentOrganization ? (
                  <>
                    <span className="font-medium">{currentOrganization.name}</span>
                    {userRole && <span className="ml-2">• {userRole}</span>}
                  </>
                ) : (
                  'Welcome to AlkaTera'
                )}
              </p>
            </div>

            <div className="flex items-centre gap-2">
              <Button
                onClick={() => router.push('/dashboard/settings/team')}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                disabled={signingOut}
                className="gap-2"
              >
                {signingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
            <KPISnapshotWidget />

            <GHGEmissionsSummaryWidget />

            <SupplierEngagementWidget />

            <RecentActivityWidget />

            <ActionItemsWidget />
          </div>
        </div>
      </main>
    </ProtectedLayout>
  )
}
