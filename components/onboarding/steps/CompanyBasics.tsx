'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Building2, SkipForward } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function CompanyBasics() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const { currentOrganization, refreshOrganizations } = useOrganization()
  const { toast } = useToast()

  const [companyName, setCompanyName] = useState(currentOrganization?.name || '')
  const [address, setAddress] = useState(currentOrganization?.address || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!currentOrganization) return

    setIsSaving(true)
    try {
      const updates: Record<string, any> = {}
      if (companyName.trim() && companyName !== currentOrganization.name) {
        updates.name = companyName.trim()
      }
      if (address.trim()) {
        updates.address = address.trim()
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('organizations')
          .update(updates)
          .eq('id', currentOrganization.id)

        if (error) throw error

        await refreshOrganizations()
        toast({
          title: 'Company details updated',
          description: 'Your company information has been saved.',
        })
      }

      completeStep()
    } catch (err) {
      console.error('Error saving company basics:', err)
      toast({
        title: 'Error',
        description: 'Failed to save company details. You can update these later in Settings.',
        variant: 'destructive',
      })
      // Still advance even if save fails
      completeStep()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            Let&apos;s add your company details
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onb-company-name" className="text-sm font-medium">
              Company Name
            </Label>
            <Input
              id="onb-company-name"
              placeholder='e.g., "Oxford Artisan Distillery"'
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="onb-address" className="text-sm font-medium">
              Headquarters Address
            </Label>
            <Input
              id="onb-address"
              placeholder="Start typing address..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Used for location-based emission factors and regulations.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Seeing your branding makes this feel like YOUR platform. You can add a logo later in Settings.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
