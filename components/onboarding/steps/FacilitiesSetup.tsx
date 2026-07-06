'use client'

import { useState, useRef } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight, SkipForward, Factory } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { LocationPicker, type LocationData } from '@/components/shared/LocationPicker'

const FACILITY_TYPES = [
  { value: 'Distillery', label: 'Distillery' },
  { value: 'Brewery', label: 'Brewery' },
  { value: 'Winery', label: 'Winery' },
  { value: 'Bottling', label: 'Bottling facility' },
  { value: 'Packing', label: 'Packing facility' },
  { value: 'Office', label: 'Office' },
  { value: 'Retail', label: 'Retail location' },
  { value: 'Warehouse', label: 'Warehouse' },
]

export function FacilitiesSetup() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const { toast } = useToast()

  const [facilityName, setFacilityName] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [locationSearchValue, setLocationSearchValue] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressCountry, setAddressCountry] = useState('')
  const [addressCountryCode, setAddressCountryCode] = useState('')
  const [addressLat, setAddressLat] = useState<number | null>(null)
  const [addressLng, setAddressLng] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)

  const handleLocationSelect = (location: LocationData) => {
    setLocationSearchValue(location.address)
    setAddressLine1(location.address)
    setAddressCity(location.city || '')
    setAddressCountry(location.country || '')
    setAddressCountryCode(location.countryCode || '')
    setAddressLat(location.lat)
    setAddressLng(location.lng)
  }

  const handleSave = async () => {
    if (!currentOrganization || !facilityName.trim()) return
    if (savingRef.current) return
    savingRef.current = true

    setIsSaving(true)
    try {
      // Resolve or create facility_type_id
      const typeName = facilityType || 'Office'
      let facilityTypeId: string | null = null

      const { data: existingType } = await supabase
        .from('facility_types')
        .select('id')
        .eq('name', typeName)
        .maybeSingle()

      if (existingType) {
        facilityTypeId = existingType.id
      } else {
        const { data: newType, error: typeError } = await supabase
          .from('facility_types')
          .insert({ name: typeName })
          .select('id')
          .single()
        if (!typeError && newType) {
          facilityTypeId = newType.id
        }
      }

      const { error } = await supabase.from('facilities').insert({
        organization_id: currentOrganization.id,
        name: facilityName.trim(),
        facility_type_id: facilityTypeId,
        // Structured address fields for distance calculations
        address_line1: addressLine1 || null,
        address_city: addressCity || null,
        address_country: addressCountry || null,
        address_lat: addressLat,
        address_lng: addressLng,
        // Also populate location columns for AWARE water stress assessment
        location_address: addressLine1 || null,
        location_country_code: addressCountryCode || null,
        latitude: addressLat,
        longitude: addressLng,
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
          <div className="mx-auto w-16 h-16 rounded-[6px] border border-border bg-card flex items-center justify-center">
            <Factory className="w-8 h-8 text-studio-forest" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">
            Your facilities.
          </h3>
          <p className="text-sm text-muted-foreground">
            Let&apos;s map out where your operations happen.
          </p>
        </div>

        <div className="rounded-[6px] border border-border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onb-facility-name" className="text-sm font-medium text-foreground">Facility Name</Label>
            <Input
              id="onb-facility-name"
              placeholder="e.g., Main Distillery"
              value={facilityName}
              onChange={e => setFacilityName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Facility Type</Label>
            <Select value={facilityType} onValueChange={setFacilityType} disabled={isSaving}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {FACILITY_TYPES.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Location</Label>
            <p className="text-xs text-muted-foreground">
              Search for your facility&apos;s city or address
            </p>
            <LocationPicker
              value={locationSearchValue}
              onLocationSelect={handleLocationSelect}
              placeholder="Search for city or address..."
              disabled={isSaving}
            />
            {addressCity && (
              <p className="text-xs text-muted-foreground mt-1">
                {addressCity}{addressCountry ? `, ${addressCountry}` : ''}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can add contract partners and co-packers too, they count toward your Scope 3 emissions. You can add more facilities later.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={!facilityName.trim() || isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-[6px]"
            >
              {isSaving ? 'Saving…' : 'Continue'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
