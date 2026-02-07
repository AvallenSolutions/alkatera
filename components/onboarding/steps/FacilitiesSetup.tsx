'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight, SkipForward, Factory, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const FACILITY_TYPES = [
  { value: 'distillery', label: 'Distillery' },
  { value: 'brewery', label: 'Brewery' },
  { value: 'winery', label: 'Winery' },
  { value: 'bottling', label: 'Bottling facility' },
  { value: 'packing', label: 'Packing facility' },
  { value: 'office', label: 'Office' },
  { value: 'retail', label: 'Retail location' },
  { value: 'warehouse', label: 'Warehouse' },
]

export function FacilitiesSetup() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const { toast } = useToast()

  const [facilityName, setFacilityName] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [address, setAddress] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!currentOrganization || !facilityName.trim()) return

    setIsSaving(true)
    try {
      const { error } = await supabase.from('production_sites').insert({
        organization_id: currentOrganization.id,
        name: facilityName.trim(),
        site_type: facilityType || 'office',
        address: address.trim() || null,
      })

      if (error) throw error

      toast({
        title: 'Facility added!',
        description: `${facilityName} has been added to your facilities.`,
      })

      completeStep()
    } catch (err) {
      console.error('Error saving facility:', err)
      toast({
        title: 'Error',
        description: 'Failed to add facility. You can add facilities later.',
        variant: 'destructive',
      })
      completeStep()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-cyan-400/20 rounded-2xl flex items-center justify-center">
            <Factory className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            Facilities Setup
          </h3>
          <p className="text-sm text-muted-foreground">
            Let&apos;s map out where your operations happen.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onb-facility-name">Facility Name</Label>
            <Input
              id="onb-facility-name"
              placeholder="e.g., Main Distillery"
              value={facilityName}
              onChange={e => setFacilityName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label>Facility Type</Label>
            <Select value={facilityType} onValueChange={setFacilityType} disabled={isSaving}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FACILITY_TYPES.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onb-facility-address">Address</Label>
            <Input
              id="onb-facility-address"
              placeholder="Start typing address..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can add contract partners and co-packers too &mdash; they count toward your Scope 3 emissions. You can add more facilities later.
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
              disabled={!facilityName.trim() || isSaving}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
