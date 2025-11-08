'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Building2, Loader2 } from 'lucide-react'

export default function CreateOrganizationPage() {
  const [organizationName, setOrganizationName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

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
        body: JSON.stringify({ name: organizationName }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create organisation')
      }

      toast({
        title: 'Success',
        description: 'Your organisation has been created successfully.',
      })

      router.push('/dashboard')
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

  return (
    <div className="min-h-screen flex items-centre justify-centre bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-centre">
          <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-centre justify-centre">
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
