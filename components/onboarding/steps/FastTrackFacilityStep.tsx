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
import { ArrowRight, Factory, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

const FACILITY_TYPE_OPTIONS = [
  { value: 'owned', label: 'Own facility', description: 'You own or lease your production space' },
  { value: 'third_party', label: 'Contract producer', description: 'A third party manufactures on your behalf' },
] as const

type OperationalControl = 'owned' | 'third_party'

const FUNCTION_OPTIONS = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'storage', label: 'Storage / warehousing' },
  { value: 'office', label: 'Office / admin' },
] as const

type FacilityFunction = (typeof FUNCTION_OPTIONS)[number]['value']

export function FastTrackFacilityStep() {
  const { completeStep, state } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name ?? ''

  const [operationalControl, setOperationalControl] = useState<OperationalControl>('owned')
  const [facilityName, setFacilityName] = useState(orgName ? `${orgName} Facility` : '')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [functions, setFunctions] = useState<FacilityFunction[]>(['manufacturing', 'packaging'])
  const [isSaving, setIsSaving] = useState(false)

  const toggleFunction = (fn: FacilityFunction) => {
    setFunctions(prev =>
      prev.includes(fn) ? prev.filter(f => f !== fn) : [...prev, fn],
    )
  }

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
          functions: functions.length > 0 ? functions : null,
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
          <div className="mx-auto w-16 h-16 bg-card border border-border rounded-[6px] flex items-center justify-center">
            <Factory className="w-8 h-8 text-studio-forest" />
          </div>
          <h3 className="text-xl font-display font-bold tracking-tight text-foreground">Your production facility.</h3>
          <p className="text-sm text-muted-foreground">
            This links your products to a location so we can track Scope 1 and 2 emissions accurately.
          </p>
        </div>

        {/* Production type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">How do you produce?</Label>
          <div className="grid grid-cols-2 gap-2">
            {FACILITY_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setOperationalControl(opt.value)}
                className={cn(
                  'flex flex-col gap-1 p-4 rounded-[6px] border text-left transition-colors',
                  operationalControl === opt.value
                    ? 'bg-secondary border-studio-forest'
                    : 'bg-card border-border hover:bg-secondary hover:border-studio-ink/25'
                )}
              >
                <span className={cn('text-sm font-semibold', operationalControl === opt.value ? 'text-studio-forest' : 'text-foreground')}>
                  {opt.label}
                </span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Facility name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Facility name <span className="text-studio-dim">(required)</span>
          </Label>
          <Input
            placeholder='e.g., "Bristol Distillery"'
            value={facilityName}
            onChange={e => setFacilityName(e.target.value)}
          />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Address</Label>
          <LocationPicker
            value={location?.address}
            onLocationSelect={setLocation}
            placeholder="Search for your facility address..."
          />
          {location && (
            <p className="text-xs text-muted-foreground">
              {[location.city, location.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* What happens here — drives Scope 1/2/3 boundary calculations */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">What happens at this site?</Label>
          <div className="flex flex-wrap gap-1.5">
            {FUNCTION_OPTIONS.map(opt => {
              const picked = functions.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleFunction(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs border transition-colors',
                    picked
                      ? 'bg-secondary border-studio-forest text-studio-forest'
                      : 'bg-card border-border text-muted-foreground hover:bg-secondary hover:border-studio-ink/25',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-studio-dim">Helps us draw the right Scope 1, 2 and 3 boundaries.</p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>

        <button
          onClick={completeStep}
          className="w-full flex items-center justify-center gap-2 text-sm text-studio-dim hover:text-foreground transition-colors py-2"
        >
          <SkipForward className="w-4 h-4" />
          Skip for now
        </button>

      </div>
    </div>
  )
}
