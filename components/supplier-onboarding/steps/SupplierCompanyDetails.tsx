'use client'

import { useState, useEffect, useRef } from 'react'
import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleAddressInput } from '@/components/ui/google-address-input'
import { ArrowLeft, ArrowRight, MapPin, SkipForward, Upload, FileText, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ACCEPTED_FILE_TYPES = '.pdf,.xlsx,.xls,.csv'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function SupplierCompanyDetails() {
  const { completeStep, previousStep, skipStep } = useSupplierOnboarding()

  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [countryCode, setCountryCode] = useState('')
  const [country, setCountry] = useState('')
  const [industrySector, setIndustrySector] = useState('')
  const [phone, setPhone] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [catalogueUrl, setCatalogueUrl] = useState<string | null>(null)
  const [catalogueFilename, setCatalogueFilename] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [manualAddress, setManualAddress] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing supplier data
  useEffect(() => {
    async function loadProfile() {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('suppliers')
        .select('id, address, city, lat, lng, country_code, country, industry_sector, phone, contact_name, contact_email, catalogue_url')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (data) {
        setSupplierId(data.id)
        setAddress(data.address || '')
        setCity(data.city || '')
        setLat(data.lat ?? null)
        setLng(data.lng ?? null)
        setCountryCode(data.country_code || '')
        setCountry(data.country || '')
        setIndustrySector(data.industry_sector || '')
        setPhone(data.phone || '')
        setContactName(data.contact_name || '')
        setContactEmail(data.contact_email || '')
        if (data.catalogue_url) {
          setCatalogueUrl(data.catalogue_url)
          // Extract filename from URL for display
          const parts = data.catalogue_url.split('/')
          setCatalogueFilename(parts[parts.length - 1] || 'catalogue')
        }
      }

      setIsLoading(false)
    }

    loadProfile()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File must be under 10MB')
      return
    }

    if (!supplierId) {
      toast.error('Supplier profile not found')
      return
    }

    setIsUploading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      const filePath = `${supplierId}/catalogue-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('supplier-catalogues')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('supplier-catalogues')
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl

      // Save catalogue_url to suppliers table immediately
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ catalogue_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', supplierId)

      if (updateError) throw updateError

      setCatalogueUrl(publicUrl)
      setCatalogueFilename(file.name)
      toast.success('Catalogue uploaded')
    } catch (err) {
      console.error('Error uploading catalogue:', err)
      toast.error('Failed to upload catalogue. Please try again.')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveCatalogue = async () => {
    if (!supplierId) return

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('suppliers')
        .update({ catalogue_url: null, updated_at: new Date().toISOString() })
        .eq('id', supplierId)

      if (error) throw error

      setCatalogueUrl(null)
      setCatalogueFilename(null)
      toast.success('Catalogue removed')
    } catch (err) {
      console.error('Error removing catalogue:', err)
      toast.error('Failed to remove catalogue')
    }
  }

  const handleSave = async () => {
    if (!supplierId) {
      completeStep()
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('suppliers')
        .update({
          address: address.trim() || null,
          city: city.trim() || null,
          lat,
          lng,
          country_code: countryCode.trim() || null,
          country: country.trim() || null,
          industry_sector: industrySector.trim() || null,
          phone: phone.trim() || null,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          catalogue_url: catalogueUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplierId)

      if (error) throw error

      toast.success('Company details saved')
      completeStep()
    } catch (err) {
      console.error('Error saving company details:', err)
      toast.error('Failed to save details. You can update these later from your profile page.')
      completeStep()
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-[#ccff00] animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl flex items-center justify-center">
            <MapPin className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">
            Company Details
          </h3>
          <p className="text-sm text-white/50">
            Add your address, contact details, and product catalogue.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
          {/* Address - full width */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sup-address" className="text-sm font-medium text-white/70">
                Address
              </Label>
              <button
                type="button"
                onClick={() => setManualAddress(v => !v)}
                className="text-xs text-white/30 hover:text-white/60 underline underline-offset-2"
              >
                {manualAddress ? 'Search by address' : "Can't find your address?"}
              </button>
            </div>
            {manualAddress ? (
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 37 Crane Boulevard, Ipswich, IP3 9SQ"
                disabled={isSaving}
                className="w-full rounded-md px-3 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#ccff00]/50"
              />
            ) : (
              <GoogleAddressInput
                value={address}
                onAddressSelect={(details) => {
                  setAddress(details.formatted_address)
                  setCity(details.city || '')
                  setLat(details.lat)
                  setLng(details.lng)
                  setCountryCode(details.country_code || '')
                  setCountry(details.country || '')
                }}
                placeholder="Start typing your address..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              />
            )}
          </div>

          {/* Industry Sector + Phone - half width */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-industry" className="text-sm font-medium text-white/70">
                Industry Sector
              </Label>
              <Input
                id="sup-industry"
                placeholder="e.g., Food & Beverage"
                value={industrySector}
                onChange={e => setIndustrySector(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-phone" className="text-sm font-medium text-white/70">
                Phone
              </Label>
              <Input
                id="sup-phone"
                type="tel"
                placeholder="+44 1234 567890"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
          </div>

          {/* Contact Name + Contact Email - half width */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-contact-name" className="text-sm font-medium text-white/70">
                Contact Name
              </Label>
              <Input
                id="sup-contact-name"
                placeholder="Your name"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-contact-email" className="text-sm font-medium text-white/70">
                Contact Email
              </Label>
              <Input
                id="sup-contact-email"
                type="email"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
          </div>

          {/* Catalogue Upload - full width */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/70">
              Product Catalogue
            </Label>
            {catalogueUrl && catalogueFilename ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                <FileText className="w-4 h-4 text-[#ccff00] shrink-0" />
                <span className="text-sm text-white/70 truncate flex-1">
                  {catalogueFilename}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveCatalogue}
                  className="text-white/40 hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileUpload}
                  className="hidden"
                  id="catalogue-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 border border-dashed border-white/20 rounded-xl px-4 py-3 text-sm text-white/50 hover:text-white/70 hover:border-white/30 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload catalogue (PDF, XLSX, XLS, CSV - max 10MB)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-white/30 text-center">
          You can update these details anytime from your profile page.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isUploading}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save & Continue
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
