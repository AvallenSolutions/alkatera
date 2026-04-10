'use client'

import { useState, useEffect } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationPicker } from '@/components/shared/LocationPicker'
import type { LocationData } from '@/components/shared/LocationPicker'
import { ArrowRight, Factory, Loader2, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

const FACILITY_TYPE_OPTIONS = [
  { value: 'owned', label: 'Own facility', description: 'You own or lease your production space' },
  { value: 'third_party', label: 'Contract producer', description: 'A third party manufactures on your behalf' },
] as const

type OperationalControl = 'owned' | 'third_party'

export function FastTrackFacilityStep() {
  const { completeStep, state } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name ?? ''

  const [operationalControl, setOperationalControl] = useState<OperationalControl>('owned')
  const [facilityName, setFacilityName] = useState(orgName ? `${orgName} Facility` : '')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Update facility name if org name loads after mount
  useEffect(() => {
    if (orgName && !facilityName) {
      setFacilityName(`${orgName} Facility`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgName])

  const isValid = facilityName.trim().length > 0

  const handleSave = async () => {
    if (!isValid || !currentOrganization) return
    setIsSaving(true)

    try {
      // Create the facility
      const { data: facility, error } = await supabase
        .from('facilities')
        .insert({
          organization_id: currentOrganization.id,
          name: facilityName.trim(),
          operational_control: operationalControl,
          address_line1: location?.address || null,
          address_city: location?.city || null,
          address_country: location?.country || null,
          address_lat: location?.lat || null,
          address_lng: location?.lng || null,
          location_city: location?.city || null,
          location_address: location?.address || null,
          location_country_code: location?.countryCode || null,
          latitude: location?.lat || null,
          longitude: location?.lng || null,
        })
        .select('id')
        .single()

      if (error || !facility) throw error

      // Link all draft products created in this session (last 30 min) to this facility
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      await supabase
        .from('products')
        .update({ core_operations_facility_id: facility.id })
        .eq('organization_id', currentOrganization.id)
        .eq('is_draft', true)
        .gte('created_at', cutoff)
    } catch {
      // Continue even if facility creation fails — don't block the user
    }

    setIsSaving(false)
    completeStep()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-5">

        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl flex items-center justify-center">
            <Factory className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">Your production facility</h3>
          <p className="text-sm text-white/50">
            This links your products to a location so we can track Scope 1 and 2 emissions accurately.
          </p>
        </div>

        {/* Production type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">How do you produce?</Label>
          <div className="grid grid-cols-2 gap-2">
            {FACILITY_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setOperationalControl(opt.value)}
                className={cn(
                  'flex flex-col gap-1 p-4 rounded-xl border text-left transition-all',
                  operationalControl === opt.value
                    ? 'bg-[#ccff00]/15 border-[#ccff00]/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                )}
              >
                <span className={cn('text-sm font-semibold', operationalControl === opt.value ? 'text-[#ccff00]' : 'text-white')}>
                  {opt.label}
                </span>
                <span className="text-xs text-white/40">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Facility name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">
            Facility name <span className="text-white/30">(required)</span>
          </Label>
          <Input
            placeholder='e.g., "Bristol Distillery"'
            value={facilityName}
            onChange={e => setFacilityName(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
          />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">Address</Label>
          <LocationPicker
            value={location?.address}
            onLocationSelect={setLocation}
            placeholder="Search for your facility address..."
            className="[&_button]:bg-white/5 [&_button]:border-white/10 [&_button]:text-white [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/20"
          />
          {location && (
            <p className="text-xs text-white/40">
              {[location.city, location.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="w-full bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>

        <button
          onClick={completeStep}
          className="w-full flex items-center justify-center gap-2 text-sm text-white/30 hover:text-white/50 transition-colors py-2"
        >
          <SkipForward className="w-4 h-4" />
          Skip for now
        </button>

      </div>
    </div>
  )
}
