'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRHMRCDetails } from '@/hooks/data/useEPRHMRCDetails'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, ArrowRight, SkipForward, Loader2, Building2 } from 'lucide-react'
import {
  HMRC_ORG_TYPE_NAMES,
  RPD_NATION_NAMES,
  DRINKS_INDUSTRY_SIC_CODES,
} from '@/lib/epr/constants'
import type { HMRCOrganisationType, RPDNation } from '@/lib/epr/types'

interface CompanyDetailsStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

export function CompanyDetailsStep({ onComplete, onBack, onSkip }: CompanyDetailsStepProps) {
  const { currentOrganization } = useOrganization()
  const { data, loading, saveOrgDetails } = useEPRHMRCDetails()

  const [companiesHouseNumber, setCompaniesHouseNumber] = useState('')
  const [organisationType, setOrganisationType] = useState<HMRCOrganisationType | ''>('')
  const [sicCode, setSicCode] = useState('')
  const [homeNation, setHomeNation] = useState<RPDNation | ''>('')
  const [isSaving, setIsSaving] = useState(false)

  // Pre-populate from existing data
  useEffect(() => {
    if (data.orgDetails) {
      setCompaniesHouseNumber(data.orgDetails.companies_house_number || '')
      setOrganisationType(data.orgDetails.organisation_type_code || '')
      setSicCode(data.orgDetails.main_activity_sic || '')
      setHomeNation(data.orgDetails.home_nation_code || '')
    }
  }, [data.orgDetails])

  const handleContinue = async () => {
    if (!currentOrganization) return

    if (!companiesHouseNumber.trim()) {
      toast.error('Please enter your Companies House number.')
      return
    }
    if (!organisationType) {
      toast.error('Please select an organisation type.')
      return
    }
    if (!homeNation) {
      toast.error('Please select a home nation.')
      return
    }

    setIsSaving(true)
    try {
      await saveOrgDetails({
        companies_house_number: companiesHouseNumber.trim(),
        organisation_type_code: organisationType as HMRCOrganisationType,
        main_activity_sic: sicCode.trim() || null,
        home_nation_code: homeNation as RPDNation,
      })
      onComplete()
    } catch (err) {
      console.error('Error saving company details:', err)
      toast.error('Failed to save company details. Please try again.')
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-neon-lime/20 backdrop-blur-md border border-neon-lime/30 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-neon-lime" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            Company Details
          </h3>
          <p className="text-sm text-muted-foreground">
            Basic company information required for HMRC EPR registration.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl p-6 space-y-5">
          {/* Companies House Number */}
          <div className="space-y-2">
            <Label htmlFor="epr-ch-number" className="text-sm font-medium text-muted-foreground">
              Companies House Number
            </Label>
            <Input
              id="epr-ch-number"
              placeholder="e.g. 12345678"
              value={companiesHouseNumber}
              onChange={(e) => setCompaniesHouseNumber(e.target.value)}
              maxLength={8}
              disabled={isSaving}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50"
            />
            <p className="text-xs text-muted-foreground/70">
              Your 8-character Companies House registration number.
            </p>
          </div>

          {/* Organisation Type */}
          <div className="space-y-2">
            <Label htmlFor="epr-org-type" className="text-sm font-medium text-muted-foreground">
              Organisation Type
            </Label>
            <Select
              value={organisationType}
              onValueChange={(val) => setOrganisationType(val as HMRCOrganisationType)}
              disabled={isSaving}
            >
              <SelectTrigger
                id="epr-org-type"
                className="bg-muted/50 border-border text-foreground focus:ring-neon-lime/50"
              >
                <SelectValue placeholder="Select organisation type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(HMRC_ORG_TYPE_NAMES) as [HMRCOrganisationType, string][]).map(
                  ([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* SIC Code */}
          <div className="space-y-2">
            <Label htmlFor="epr-sic-code" className="text-sm font-medium text-muted-foreground">
              SIC Code
              <span className="ml-2 text-xs text-muted-foreground/70 font-normal">(optional)</span>
            </Label>
            <Input
              id="epr-sic-code"
              placeholder="e.g. 11.05"
              value={sicCode}
              onChange={(e) => setSicCode(e.target.value)}
              disabled={isSaving}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50"
            />
            <div className="text-xs text-muted-foreground/70 space-y-1">
              <p>Common drinks industry SIC codes:</p>
              <ul className="list-none space-y-0.5 pl-0">
                {DRINKS_INDUSTRY_SIC_CODES.map((sic) => (
                  <li key={sic.code}>
                    <button
                      type="button"
                      onClick={() => setSicCode(sic.code)}
                      disabled={isSaving}
                      className="text-left text-xs text-neon-lime/80 hover:text-neon-lime hover:underline transition-colors"
                    >
                      {sic.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Home Nation */}
          <div className="space-y-2">
            <Label htmlFor="epr-home-nation" className="text-sm font-medium text-muted-foreground">
              Home Nation
            </Label>
            <Select
              value={homeNation}
              onValueChange={(val) => setHomeNation(val as RPDNation)}
              disabled={isSaving}
            >
              <SelectTrigger
                id="epr-home-nation"
                className="bg-muted/50 border-border text-foreground focus:ring-neon-lime/50"
              >
                <SelectValue placeholder="Select home nation" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(RPD_NATION_NAMES) as [RPDNation, string][]).map(
                  ([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground/70">
              The UK nation where your organisation is registered.
            </p>
          </div>
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
