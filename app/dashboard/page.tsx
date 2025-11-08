"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/lib/organizationContext"
import { ProtectedLayout } from "@/components/layouts/ProtectedLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { LogOut, Loader2, User, Users, Building2 } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

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

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase()
  }

  const fullName = user?.user_metadata?.full_name

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              {currentOrganization ? `${currentOrganization.name}` : 'Welcome to AlkaTera'}
            </p>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            disabled={signingOut}
            className="flex items-center gap-2"
          >
            {signingOut ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Sign Out
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-lg">
                    {user?.email ? getInitials(user.email) : <User className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  {fullName && <p className="text-lg font-medium">{fullName}</p>}
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account ID</span>
                  <span className="font-mono text-xs">{user?.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Created</span>
                  <span>
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-GB")
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Sign In</span>
                  <span>
                    {user?.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString("en-GB")
                      : "N/A"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
              <CardDescription>Manage your organisation settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentOrganization && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-centre justify-centre">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{currentOrganization.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: {userRole || 'Member'}
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/dashboard/settings/team')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage Team
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <User className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Next steps for your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  You're all set! Your account is ready to use.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Complete your profile</li>
                  <li>Set up your preferences</li>
                  <li>Explore the dashboard</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
    </ProtectedLayout>
  )
}
