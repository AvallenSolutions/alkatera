'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRODUCT_TYPE_OPTIONS } from '@/lib/industry-benchmarks'
import { Building2, Loader2 } from 'lucide-react'

export default function CreateOrganizationPage() {
  const [organizationName, setOrganizationName] = useState('')
  const [productType, setProductType] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const { mutate, currentOrganization } = useOrganization()
  const { user } = useAuth()

  // Check if user already has organization access (including advisor access)
  useEffect(() => {
    async function checkExistingAccess() {
      if (!user) {
        setIsCheckingAccess(false)
        return
      }

      // If they already have an organization from context, redirect
      if (currentOrganization) {
        router.push('/dashboard')
        return
      }

      // Check for advisor access directly
      const { data: advisorAccess } = await supabase
        .from('advisor_organization_access')
        .select('organization_id')
        .eq('advisor_user_id', user.id)
        .eq('is_active', true)
        .limit(1)

      if (advisorAccess && advisorAccess.length > 0) {
        // User has advisor access, redirect to dashboard
        // The OrganizationContext will pick up the advisor access
        toast({
          title: 'Advisor Access Detected',
          description: 'Redirecting you to your organization...',
        })
        router.push('/dashboard')
        return
      }

      setIsCheckingAccess(false)
    }

    checkExistingAccess()
  }, [user, currentOrganization, router, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!organizationName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an organisation name.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast({
          title: 'Authentication Error',
          description: 'You must be logged in to create an organisation.',
          variant: 'destructive',
        })
        router.push('/login')
        return
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-organization`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: organizationName, product_type: productType || null }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create organisation')
      }

      await mutate({
        organization: result.organization,
        role: result.role,
        user: session.user
      })

      toast({
        title: 'Success',
        description: 'Your organisation has been created successfully.',
      })

      router.push('/settings?complete_subscription=true')
      router.refresh()
    } catch (error) {
      console.error('Error creating organisation:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organisation. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading while checking for existing access
  if (isCheckingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-slate-600" />
          <p className="text-sm text-muted-foreground">Checking access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-semibold">Create Your Company Account</CardTitle>
          <CardDescription className="text-base">
            Get started by creating an organisation for your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="organizationName" className="text-sm font-medium">
                Company Name
              </Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="Acme Ltd"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={isLoading}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productType" className="text-sm font-medium">
                What type of products do you primarily produce?
              </Label>
              <Select value={productType} onValueChange={setProductType} disabled={isLoading}>
                <SelectTrigger id="productType" className="h-11">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines the industry benchmarks used for your sustainability score. You can change this later in settings.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Organisation...
                </>
              ) : (
                'Create Company'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
