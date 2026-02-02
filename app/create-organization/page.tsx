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
import Image from 'next/image'
import Link from 'next/link'

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
      // But if subscription is pending, let them go to complete-subscription
      if (currentOrganization) {
        if (currentOrganization.subscription_status === 'pending') {
          router.push('/complete-subscription')
        } else {
          router.push('/dashboard')
        }
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

      router.push('/complete-subscription')
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
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <Image src="/images/starry-night-bg3.jpg" alt="Starry night sky" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#ccff00]" />
          <p className="text-sm text-white/50">Checking access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
      <Image src="/images/starry-night-bg3.jpg" alt="Starry night sky" fill className="object-cover" priority quality={85} />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo */}
        <Link href="/" className="flex justify-center">
          <img
            src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
            alt="alkatera"
            className="h-10 md:h-14 w-auto object-contain mix-blend-screen brightness-125 contrast-150"
            style={{ mixBlendMode: 'screen' }}
          />
        </Link>

        {/* Glassmorphism Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[#ccff00]" />
            </div>
            <h1 className="text-2xl font-serif text-white">Create Your Company Account</h1>
            <p className="text-white/50 text-sm">
              Get started by creating an organisation for your team
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="organizationName" className="text-sm font-medium text-white/70">
                Company Name
              </Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="Acme Ltd"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={isLoading}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productType" className="text-sm font-medium text-white/70">
                What type of products do you primarily produce?
              </Label>
              <Select value={productType} onValueChange={setProductType} disabled={isLoading}>
                <SelectTrigger id="productType" className="h-11 bg-white/5 border-white/10 text-white">
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
              <p className="text-xs text-white/40">
                This determines the industry benchmarks used for your sustainability score. You can change this later in settings.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium bg-[#ccff00] text-black hover:bg-[#ccff00]/90 rounded-xl"
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
        </div>
      </div>

      {/* Photo credit */}
      <div className="relative z-10 mt-8 text-center text-[10px] text-white/20">
        Photo by{' '}
        <a
          href="https://unsplash.com/@graddes"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40"
        >
          Graddess
        </a>
        {' '}on{' '}
        <a
          href="https://unsplash.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40"
        >
          Unsplash
        </a>
      </div>
    </div>
  )
}
