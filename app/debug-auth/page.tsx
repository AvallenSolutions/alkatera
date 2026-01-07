'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugAuthPage() {
  const { user, session, loading: authLoading } = useAuth()
  const { currentOrganization, organizations, isLoading: orgLoading, userRole } = useOrganization()
  const [testResults, setTestResults] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const runTests = async () => {
    setTesting(true)
    const results: any = {
      timestamp: new Date().toISOString(),
      auth: {},
      queries: {},
    }

    try {
      results.auth.hasSession = !!session
      results.auth.userId = user?.id
      results.auth.userEmail = user?.email
      results.auth.hasAccessToken = !!session?.access_token

      const { data: sessionData } = await supabase.auth.getSession()
      results.auth.sessionValid = !!sessionData.session
      results.auth.sessionUserId = sessionData.session?.user?.id

      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', user?.id || '')

      results.queries.memberships = {
        success: !membershipsError,
        count: memberships?.length || 0,
        data: memberships,
        error: membershipsError?.message,
      }

      if (memberships && memberships.length > 0) {
        const orgIds = memberships.map((m: any) => m.organization_id)

        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .in('id', orgIds)

        results.queries.organizations = {
          success: !orgsError,
          count: orgs?.length || 0,
          data: orgs,
          error: orgsError?.message,
        }
      }

      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('*')

      results.queries.roles = {
        success: !rolesError,
        count: roles?.length || 0,
        data: roles,
        error: rolesError?.message,
      }

    } catch (error: any) {
      results.error = error.message
    }

    setTestResults(results)
    setTesting(false)
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">Authentication Debug Page</h1>

      <Card>
        <CardHeader>
          <CardTitle>Auth State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Auth Loading:</strong> {authLoading ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Org Loading:</strong> {orgLoading ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>User ID:</strong> {user?.id || 'None'}
            </div>
            <div>
              <strong>Email:</strong> {user?.email || 'None'}
            </div>
            <div>
              <strong>Session:</strong> {session ? 'Active' : 'None'}
            </div>
            <div>
              <strong>Access Token:</strong> {session?.access_token ? 'Present' : 'None'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Current Org:</strong> {currentOrganization?.name || 'None'}
            </div>
            <div>
              <strong>Current Org ID:</strong> {currentOrganization?.id || 'None'}
            </div>
            <div>
              <strong>Organizations Count:</strong> {organizations.length}
            </div>
            <div>
              <strong>User Role:</strong> {userRole || 'None'}
            </div>
          </div>
          {organizations.length > 0 && (
            <div className="mt-4">
              <strong>Organizations:</strong>
              <ul className="list-disc list-inside mt-2">
                {organizations.map((org) => (
                  <li key={org.id}>{org.name} ({org.id})</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Query Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runTests} disabled={testing || !user}>
            {testing ? 'Testing...' : 'Run Query Tests'}
          </Button>

          {testResults && (
            <div className="mt-4">
              <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          {user && (
            <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-96 text-xs">
              {JSON.stringify(user.user_metadata, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
