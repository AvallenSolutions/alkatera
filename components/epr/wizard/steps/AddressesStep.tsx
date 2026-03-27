'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRHMRCDetails } from '@/hooks/data/useEPRHMRCDetails'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, SkipForward, Loader2, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { HMRC_ADDRESS_TYPE_NAMES } from '@/lib/epr/constants'
import type { HMRCAddressType, HMRCAddress } from '@/lib/epr/types'

interface AddressesStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

interface AddressFormData {
  line_1: string
  line_2: string
  city: string
  county: string
  postcode: string
  country: string
  phone: string
}

const EMPTY_ADDRESS: AddressFormData = {
  line_1: '',
  line_2: '',
  city: '',
  county: '',
  postcode: '',
  country: 'United Kingdom',
  phone: '',
}

const ADDRESS_TYPES: HMRCAddressType[] = ['registered', 'audit', 'service_of_notice', 'principal']

const ADDRESS_HAS_PHONE: Record<HMRCAddressType, boolean> = {
  registered: false,
  audit: false,
  service_of_notice: true,
  principal: true,
}

export function AddressesStep({ onComplete, onBack, onSkip }: AddressesStepProps) {
  const { currentOrganization } = useOrganization()
  const { data, loading, saveAddresses } = useEPRHMRCDetails()

  const [addresses, setAddresses] = useState<Record<HMRCAddressType, AddressFormData>>({
    registered: { ...EMPTY_ADDRESS },
    audit: { ...EMPTY_ADDRESS },
    service_of_notice: { ...EMPTY_ADDRESS },
    principal: { ...EMPTY_ADDRESS },
  })

  const [sameAsRegistered, setSameAsRegistered] = useState<Record<Exclude<HMRCAddressType, 'registered'>, boolean>>({
    audit: true,
    service_of_notice: true,
    principal: true,
  })

  const [expandedSections, setExpandedSections] = useState<Record<HMRCAddressType, boolean>>({
    registered: true,
    audit: false,
    service_of_notice: false,
    principal: false,
  })

  const [isSaving, setIsSaving] = useState(false)

  // Pre-populate registered address from org data
  useEffect(() => {
    if (currentOrganization && !data.orgDetails) {
      const orgAddress = currentOrganization.address || ''
      const orgCity = currentOrganization.city || ''
      if (orgAddress || orgCity) {
        setAddresses((prev) => ({
          ...prev,
          registered: {
            ...prev.registered,
            line_1: orgAddress,
            city: orgCity,
          },
        }))
      }
    }
  }, [currentOrganization, data.orgDetails])

  // Pre-populate from saved addresses
  useEffect(() => {
    if (data.addresses && data.addresses.length > 0) {
      const savedMap: Partial<Record<HMRCAddressType, HMRCAddress>> = {}
      for (const addr of data.addresses) {
        savedMap[addr.address_type] = addr
      }

      const newAddresses = { ...addresses }
      const newSameAs = { ...sameAsRegistered }

      for (const type of ADDRESS_TYPES) {
        const saved = savedMap[type]
        if (saved) {
          newAddresses[type] = {
            line_1: saved.line_1 || '',
            line_2: saved.line_2 || '',
            city: saved.city || '',
            county: saved.county || '',
            postcode: saved.postcode || '',
            country: saved.country || 'United Kingdom',
            phone: saved.phone || '',
          }
          if (type !== 'registered') {
            newSameAs[type as Exclude<HMRCAddressType, 'registered'>] = false
          }
        }
      }

      setAddresses(newAddresses)
      setSameAsRegistered(newSameAs)
    }
    // Only run when data.addresses changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.addresses])

  const toggleSection = (type: HMRCAddressType) => {
    if (type === 'registered') return // Always expanded
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const handleSameAsRegisteredChange = (type: Exclude<HMRCAddressType, 'registered'>, checked: boolean) => {
    setSameAsRegistered((prev) => ({ ...prev, [type]: checked }))
    if (checked) {
      setAddresses((prev) => ({
        ...prev,
        [type]: {
          ...prev.registered,
          phone: prev[type].phone, // Preserve phone if the address type has one
        },
      }))
    }
  }

  const updateAddress = useCallback(
    (type: HMRCAddressType, field: keyof AddressFormData, value: string) => {
      setAddresses((prev) => ({
        ...prev,
        [type]: { ...prev[type], [field]: value },
      }))
    },
    []
  )

  const getEffectiveAddress = (type: HMRCAddressType): AddressFormData => {
    if (type !== 'registered' && sameAsRegistered[type as Exclude<HMRCAddressType, 'registered'>]) {
      return {
        ...addresses.registered,
        phone: addresses[type].phone, // Keep type-specific phone
      }
    }
    return addresses[type]
  }

  const handleContinue = async () => {
    if (!currentOrganization) return

    // Validate registered address (minimum required fields)
    const reg = addresses.registered
    if (!reg.line_1.trim()) {
      toast.error('Please enter at least the first line of your registered address.')
      return
    }
    if (!reg.city.trim()) {
      toast.error('Please enter the city for your registered address.')
      return
    }
    if (!reg.postcode.trim()) {
      toast.error('Please enter the postcode for your registered address.')
      return
    }

    setIsSaving(true)
    try {
      const addressPayload = ADDRESS_TYPES.map((type) => {
        const effective = getEffectiveAddress(type)
        return {
          address_type: type,
          line_1: effective.line_1.trim(),
          line_2: effective.line_2.trim() || null,
          city: effective.city.trim(),
          county: effective.county.trim() || null,
          postcode: effective.postcode.trim(),
          country: effective.country.trim() || 'United Kingdom',
          phone: ADDRESS_HAS_PHONE[type] ? effective.phone.trim() || null : null,
        }
      })

      await saveAddresses(addressPayload)
      onComplete()
    } catch (err) {
      console.error('Error saving addresses:', err)
      toast.error('Failed to save addresses. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-neon-lime animate-spin" />
      </div>
    )
  }

  const renderAddressFields = (type: HMRCAddressType, disabled: boolean) => {
    const addr = type !== 'registered' && sameAsRegistered[type as Exclude<HMRCAddressType, 'registered'>]
      ? addresses.registered
      : addresses[type]
    const isReadOnly = type !== 'registered' && sameAsRegistered[type as Exclude<HMRCAddressType, 'registered'>]

    return (
      <div className="space-y-3">
        {/* Line 1 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Address Line 1</Label>
          <Input
            placeholder="e.g. 10 Downing Street"
            value={addr.line_1}
            onChange={(e) => updateAddress(type, 'line_1', e.target.value)}
            disabled={disabled || isReadOnly}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-sm"
          />
        </div>

        {/* Line 2 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Address Line 2
            <span className="ml-1 text-muted-foreground/50 font-normal">(optional)</span>
          </Label>
          <Input
            placeholder=""
            value={addr.line_2}
            onChange={(e) => updateAddress(type, 'line_2', e.target.value)}
            disabled={disabled || isReadOnly}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-sm"
          />
        </div>

        {/* City + County row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">City</Label>
            <Input
              placeholder="e.g. London"
              value={addr.city}
              onChange={(e) => updateAddress(type, 'city', e.target.value)}
              disabled={disabled || isReadOnly}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              County
              <span className="ml-1 text-muted-foreground/50 font-normal">(optional)</span>
            </Label>
            <Input
              placeholder="e.g. Greater London"
              value={addr.county}
              onChange={(e) => updateAddress(type, 'county', e.target.value)}
              disabled={disabled || isReadOnly}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-sm"
            />
          </div>
        </div>

        {/* Postcode + Country row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Postcode</Label>
            <Input
              placeholder="e.g. SW1A 2AA"
              value={addr.postcode}
              onChange={(e) => updateAddress(type, 'postcode', e.target.value)}
              disabled={disabled || isReadOnly}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Country</Label>
            <Input
              value={addr.country}
              onChange={(e) => updateAddress(type, 'country', e.target.value)}
              disabled={disabled || isReadOnly}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-sm"
            />
          </div>
        </div>

        {/* Phone (only for service_of_notice and principal) */}
        {ADDRESS_HAS_PHONE[type] && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Phone Number
              <span className="ml-1 text-muted-foreground/50 font-normal">(optional)</span>
            </Label>
            <Input
              placeholder="e.g. +44 20 7946 0958"
              value={addresses[type].phone}
              onChange={(e) => updateAddress(type, 'phone', e.target.value)}
              disabled={disabled}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-sm"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-neon-lime/20 backdrop-blur-md border border-neon-lime/30 rounded-2xl flex items-center justify-center">
            <MapPin className="w-8 h-8 text-neon-lime" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            Organisation Addresses
          </h3>
          <p className="text-sm text-muted-foreground">
            HMRC requires four address types. If they are the same as your registered address,
            simply tick the checkbox.
          </p>
        </div>

        {/* Address sections */}
        <div className="space-y-4">
          {ADDRESS_TYPES.map((type) => {
            const isRegistered = type === 'registered'
            const isExpanded = isRegistered || expandedSections[type]
            const isSameAs = !isRegistered && sameAsRegistered[type as Exclude<HMRCAddressType, 'registered'>]

            return (
              <div
                key={type}
                className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl overflow-hidden"
              >
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggleSection(type)}
                  disabled={isRegistered}
                  className={`
                    w-full flex items-center justify-between p-4 text-left transition-colors
                    ${isRegistered ? 'cursor-default' : 'hover:bg-muted/30 cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                      ${isRegistered ? 'bg-neon-lime/20 text-neon-lime' : 'bg-muted/50 text-muted-foreground'}
                    `}>
                      {type === 'registered' ? 'R' : type === 'audit' ? 'A' : type === 'service_of_notice' ? 'S' : 'P'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {HMRC_ADDRESS_TYPE_NAMES[type]}
                      </p>
                      {isSameAs && !isExpanded && (
                        <p className="text-xs text-muted-foreground/60">Same as registered address</p>
                      )}
                    </div>
                  </div>
                  {!isRegistered && (
                    isExpanded
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {/* Section content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Same as registered checkbox (not shown for registered) */}
                    {!isRegistered && (
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={sameAsRegistered[type as Exclude<HMRCAddressType, 'registered'>]}
                          onChange={(e) =>
                            handleSameAsRegisteredChange(
                              type as Exclude<HMRCAddressType, 'registered'>,
                              e.target.checked
                            )
                          }
                          disabled={isSaving}
                          className="w-4 h-4 rounded border-border text-neon-lime focus:ring-neon-lime/50 bg-muted/50"
                        />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          Same as registered address
                        </span>
                      </label>
                    )}

                    {/* Address fields */}
                    {renderAddressFields(type, isSaving)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                disabled={isSaving}
                className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={handleContinue}
              disabled={isSaving}
              className="bg-neon-lime text-black hover:bg-neon-lime/80 font-medium rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
