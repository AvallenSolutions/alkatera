'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CountrySelect } from '@/components/shared/CountrySelect'
import { COUNTRIES } from '@/lib/countries'
import { LocationPicker, type LocationData } from '@/components/shared/LocationPicker'
import { Eyebrow, PillButton } from '@/components/studio'
import { ArrowRight, MapPin } from 'lucide-react'

/**
 * Screen 5 of 8: "Where do you make it?" — the first facility, folded into the
 * ritual so the workbench room is never cold on arrival.
 *
 * Confirm-not-ask: if Companies House gave us a registered address we lead with
 * it as a one-tap card ("Is this where production happens?"). One address is
 * enough — it gives the estimate step a real country grid factor for Scope 2,
 * and (once geocoded) a precise point. A contract producer gets a lighter path
 * (name + country, no owned site). Skippable, but usually one tap.
 */

function labelForCountry(raw: string | undefined | null): string {
  const t = raw?.trim()
  if (!t) return ''
  return COUNTRIES.find(c => c.label.toLowerCase() === t.toLowerCase())?.label
    ?? COUNTRIES.find(c => c.value.toLowerCase() === t.toLowerCase())?.label
    ?? t
}

function codeForCountry(raw: string | undefined | null): string {
  const t = raw?.trim()
  if (!t) return ''
  return COUNTRIES.find(c => c.value.toLowerCase() === t.toLowerCase())?.value
    ?? COUNTRIES.find(c => c.label.toLowerCase() === t.toLowerCase())?.value
    ?? ''
}

type Mode = 'confirm' | 'address' | 'partner'

export function ArrivalFacilityStep() {
  const { completeStep, skipStep, updatePersonalization, state } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const orgName = currentOrganization?.name ?? ''

  const registered = state.personalization?.companiesHouse?.registeredAddress
  const registeredLine = registered
    ? [registered.line1, registered.city, registered.country].filter(Boolean).join(', ')
    : ''
  const hasRegistered = registeredLine.length > 0

  const [mode, setMode] = useState<Mode>(hasRegistered ? 'confirm' : 'address')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [partnerName, setPartnerName] = useState('')
  const [partnerCountry, setPartnerCountry] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Insert the facility, link this session's draft products, stash the id +
   * country for the estimate and the warmth meter, then advance. Never blocks
   * on the background geocode. */
  async function createFacility(opts: {
    name: string
    control: 'owned' | 'third_party'
    functions: string[]
    addressLine1?: string | null
    city?: string | null
    countryLabel?: string | null
    countryCode?: string | null
    lat?: number | null
    lng?: number | null
    geocodeFromText?: boolean
  }) {
    if (!currentOrganization) return
    setIsSaving(true)
    setError(null)
    let facilityId: string | undefined
    try {
      const { data: facility, error: insertError } = await supabase
        .from('facilities')
        .insert({
          organization_id: currentOrganization.id,
          name: opts.name,
          operational_control: opts.control,
          functions: opts.functions.length > 0 ? opts.functions : null,
          address_line1: opts.addressLine1 ?? null,
          address_city: opts.city ?? null,
          address_country: opts.countryLabel ?? null,
          address_lat: opts.lat ?? null,
          address_lng: opts.lng ?? null,
          location_city: opts.city ?? null,
          location_address: opts.addressLine1 ?? null,
          location_country_code: opts.countryCode ?? null,
          latitude: opts.lat ?? null,
          longitude: opts.lng ?? null,
        })
        .select('id')
        .single()
      if (insertError || !facility) throw insertError ?? new Error('no facility')
      facilityId = facility.id

      // Link the draft products this arrival session created.
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      await supabase
        .from('products')
        .update({ core_operations_facility_id: facility.id })
        .eq('organization_id', currentOrganization.id)
        .eq('is_draft', true)
        .gte('created_at', cutoff)

      // From a Companies House text address we have no coordinates yet — geocode
      // in the background so the point-based data (grid, map) fills in later.
      if (opts.geocodeFromText && facility.id) {
        void fetch('/api/facilities/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facilityId: facility.id }),
        }).catch(() => {})
      }
    } catch (err) {
      // Don't strand the user on a DB hiccup — record it, but let them move on.
      console.warn('[arrival-facility] facility creation failed:', err)
    }

    updatePersonalization({
      ...(facilityId ? { facilityId } : {}),
      ...(opts.countryLabel ? { facilityCountry: opts.countryLabel } : {}),
    })
    setIsSaving(false)
    completeStep()
  }

  const confirmRegistered = () =>
    createFacility({
      name: orgName ? `${orgName} Facility` : 'Production facility',
      control: 'owned',
      functions: ['manufacturing', 'packaging'],
      addressLine1: registered?.line1 ?? null,
      city: registered?.city ?? null,
      countryLabel: labelForCountry(registered?.country),
      countryCode: codeForCountry(registered?.country) || null,
      geocodeFromText: true,
    })

  const saveFromLocation = () => {
    if (!location) { setError('Search for your address, or skip for now.'); return }
    createFacility({
      name: orgName ? `${orgName} Facility` : 'Production facility',
      control: 'owned',
      functions: ['manufacturing', 'packaging'],
      addressLine1: location.address ?? null,
      city: location.city ?? null,
      countryLabel: location.country ?? null,
      countryCode: location.countryCode ?? null,
      lat: location.lat,
      lng: location.lng,
    })
  }

  const savePartner = () => {
    if (!partnerCountry) { setError('Where is your partner based?'); return }
    createFacility({
      name: partnerName.trim() || (orgName ? `${orgName} contract site` : 'Contract producer'),
      control: 'third_party',
      functions: ['manufacturing'],
      countryLabel: labelForCountry(partnerCountry),
      countryCode: codeForCountry(partnerCountry) || null,
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center animate-in fade-in duration-500">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          <Eyebrow tone="dim" className="justify-center flex">The workbench</Eyebrow>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
            Where do you make it?
          </h1>
          <p className="text-sm text-muted-foreground">
            One address answers a dozen questions: your grid, your country&apos;s factors, your map.
          </p>
        </div>

        {mode === 'confirm' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3 rounded-[6px] border border-studio-hairline bg-studio-cream p-4">
              <MapPin className="h-5 w-5 shrink-0 text-studio-cobalt" />
              <div>
                <p className="font-display text-sm font-semibold text-foreground">{registeredLine}</p>
                <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-studio-forest">From Companies House.</p>
              </div>
            </div>
            {error && <p className="text-xs text-studio-stale">{error}</p>}
            <div className="flex flex-col gap-2">
              <PillButton onClick={confirmRegistered} disabled={isSaving} variant="ink" size="md" className="w-full">
                {isSaving ? 'One moment…' : (<>Yes, that&apos;s where<ArrowRight className="h-4 w-4" /></>)}
              </PillButton>
              <PillButton onClick={() => { setMode('address'); setError(null) }} disabled={isSaving} variant="ghost" size="md" className="w-full">
                Somewhere else
              </PillButton>
              <PillButton onClick={() => { setMode('partner'); setError(null) }} disabled={isSaving} variant="ghost" size="md" className="w-full">
                A partner makes it for us
              </PillButton>
            </div>
          </div>
        )}

        {mode === 'address' && (
          <div className="space-y-3 text-left">
            <Label className="text-sm font-medium text-foreground">Your production address</Label>
            <LocationPicker
              value={location?.address}
              onLocationSelect={loc => { setLocation(loc); setError(null) }}
              placeholder="Search for your facility address…"
            />
            {location && (
              <p className="text-xs text-muted-foreground">{[location.city, location.country].filter(Boolean).join(', ')}</p>
            )}
            {error && <p className="text-xs text-studio-stale">{error}</p>}
            <PillButton onClick={saveFromLocation} disabled={isSaving} variant="ink" size="md" className="w-full">
              {isSaving ? 'One moment…' : (<>Continue<ArrowRight className="h-4 w-4" /></>)}
            </PillButton>
            <PillButton onClick={() => { setMode('partner'); setError(null) }} disabled={isSaving} variant="ghost" size="md" className="w-full">
              A partner makes it for us
            </PillButton>
          </div>
        )}

        {mode === 'partner' && (
          <div className="space-y-3 text-left">
            <Label className="text-sm font-medium text-foreground">Your production partner</Label>
            <Input
              placeholder="Partner name (optional)"
              value={partnerName}
              onChange={e => { setPartnerName(e.target.value); setError(null) }}
              className="h-11"
            />
            <CountrySelect value={codeForCountry(partnerCountry)} onChange={setPartnerCountry} placeholder="Where are they based?" />
            {error && <p className="text-xs text-studio-stale">{error}</p>}
            <PillButton onClick={savePartner} disabled={isSaving} variant="ink" size="md" className="w-full">
              {isSaving ? 'One moment…' : (<>Continue<ArrowRight className="h-4 w-4" /></>)}
            </PillButton>
            {hasRegistered && (
              <PillButton onClick={() => { setMode('confirm'); setError(null) }} disabled={isSaving} variant="ghost" size="md" className="w-full">
                Back
              </PillButton>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={skipStep}
          disabled={isSaving}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground disabled:opacity-50"
        >
          I&apos;ll place it later.
        </button>
      </div>
    </div>
  )
}
