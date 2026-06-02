'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GoogleAddressInput } from '@/components/ui/google-address-input';
import { INDUSTRY_SECTORS } from '@/lib/suppliers/industry-sectors';
import {
  Building2,
  CheckCircle2,
  Loader2,
  Pencil,
  ArrowRight,
  AlertCircle,
  MapPin,
  Upload,
} from 'lucide-react';

interface Props {
  /** The supplier's record id, used as the storage path prefix for the logo. */
  supplierId?: string;
  /** Called whenever the required basics are satisfied (or not), to gate the survey. */
  onCompleteChange: (complete: boolean) => void;
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function SupplierProfileStep({ supplierId, onCompleteChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [description, setDescription] = useState('');
  const [industrySector, setIndustrySector] = useState('');
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [website, setWebsite] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch('/api/supplier-profile/prefill');
        if (!res.ok) throw new Error('Failed to load your details');
        const d = await res.json();
        if (!active) return;
        setName(d.name || '');
        setContactName(d.contact_name || '');
        setDescription(d.description || '');
        setIndustrySector(d.industry_sector || '');
        setCountry(d.country || '');
        setCountryCode(d.country_code || '');
        setCity(d.city || '');
        setAddress(d.address || '');
        setLat(typeof d.lat === 'number' ? d.lat : null);
        setLng(typeof d.lng === 'number' ? d.lng : null);
        setWebsite(d.website || '');
        setLogoUrl(d.logo_url || '');
        const isComplete = !!d.complete;
        setComplete(isComplete);
        setEditing(!isComplete);
        onCompleteChange(isComplete);
      } catch {
        if (active) setEditing(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [onCompleteChange]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for your logo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5MB.');
      return;
    }
    setUploadingLogo(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() || 'png';
      const prefix = supplierId || 'pending';
      const path = `${prefix}/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('supplier-logos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('supplier-logos').getPublicUrl(path);
      setLogoUrl(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName || looksLikeEmail(trimmedName)) {
      setError('Please enter your business name.');
      return;
    }
    if (!description.trim()) {
      setError('Please add a one-line description of what you supply.');
      return;
    }
    if (!industrySector) {
      setError('Please choose the sector that best describes you.');
      return;
    }
    if (!country.trim()) {
      setError('Please add your location so buyers know where you are based.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/supplier-profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          contact_name: contactName,
          description,
          industry_sector: industrySector,
          country,
          country_code: countryCode,
          city,
          address,
          lat,
          lng,
          website,
          logo_url: logoUrl,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Could not save your details');
      }
      setComplete(true);
      setEditing(false);
      onCompleteChange(true);
    } catch (e: any) {
      setError(e.message || 'Could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading your details…</span>
        </CardContent>
      </Card>
    );
  }

  // Collapsed confirmation once the basics are present and we're not editing.
  if (complete && !editing) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[industrySector, city || country].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-500" />
          {complete ? 'About your business' : 'Step 1 of 2: About your business'}
        </CardTitle>
        <CardDescription>
          This is the profile buyers see. We&apos;ve filled in what we already know, so just confirm
          it and add anything missing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sp-name">
              Business name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Botanicals Ltd"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-contact">Your name</Label>
            <Input
              id="sp-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Who should buyers contact?"
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sp-description">
            What do you supply? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="sp-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="In a line or two, what does your business supply? e.g. Organic botanicals for spirits."
            rows={2}
            disabled={saving}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sp-sector">
              Sector <span className="text-destructive">*</span>
            </Label>
            <Select value={industrySector} onValueChange={setIndustrySector} disabled={saving}>
              <SelectTrigger id="sp-sector">
                <SelectValue placeholder="Choose your sector" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-website">Website</Label>
            <Input
              id="sp-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="www.example.com"
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            Where are you based? <span className="text-destructive">*</span>
          </Label>
          <GoogleAddressInput
            value={address || (city && country ? `${city}, ${country}` : country)}
            onAddressSelect={(a) => {
              setAddress(a.formatted_address);
              setCity(a.city || '');
              setCountry(a.country || '');
              setCountryCode(a.country_code || '');
              setLat(a.lat);
              setLng(a.lng);
            }}
            placeholder="Search for your town, city or address"
            disabled={saving}
          />
          {country && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {[city, country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Logo (optional)</Label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Your logo"
                className="h-12 w-12 rounded-md border border-border object-contain bg-white"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={saving || uploadingLogo}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={saving || uploadingLogo}
            >
              {uploadingLogo ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {logoUrl ? 'Replace logo' : 'Upload logo'}
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Helps buyers recognise you in their supplier list.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {complete && (
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : complete ? (
              'Save changes'
            ) : (
              <>
                Continue to the survey
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
