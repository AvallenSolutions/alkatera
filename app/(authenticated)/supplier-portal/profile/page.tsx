'use client';

import { useEffect, useState, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Save,
  CheckCircle2,
  Building2,
  Upload,
  X,
  ImageIcon,
} from 'lucide-react';

interface SupplierProfile {
  id: string;
  name: string;
  contact_email: string;
  contact_name: string | null;
  industry_sector: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  description: string | null;
  logo_url: string | null;
}

export default function SupplierProfilePage() {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [industrySector, setIndustrySector] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('suppliers')
        .select('id, name, contact_email, contact_name, industry_sector, country, website, notes, description, logo_url')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading supplier profile:', fetchError);
        setError('Failed to load profile');
      } else if (data) {
        setProfile(data);
        setName(data.name || '');
        setContactName(data.contact_name || '');
        setContactEmail(data.contact_email || '');
        setIndustrySector(data.industry_sector || '');
        setCountry(data.country || '');
        setWebsite(data.website || '');
        setNotes(data.notes || '');
        setDescription(data.description || '');
        setLogoUrl(data.logo_url || null);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() || 'png';
      const path = `${profile.id}/logo-${Date.now()}.${ext}`;

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split('/supplier-product-images/')[1];
        if (oldPath) {
          await supabase.storage.from('supplier-product-images').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('supplier-product-images')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('supplier-product-images')
        .getPublicUrl(path);

      setLogoUrl(publicUrl);

      // Save logo URL to the database immediately
      await supabase
        .from('suppliers')
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!profile || !logoUrl) return;

    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();

      // Delete from storage
      const oldPath = logoUrl.split('/supplier-product-images/')[1];
      if (oldPath) {
        await supabase.storage.from('supplier-product-images').remove([oldPath]);
      }

      // Clear from database
      await supabase
        .from('suppliers')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      setLogoUrl(null);
    } catch (err: any) {
      console.error('Error removing logo:', err);
      setError(err.message || 'Failed to remove logo');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error: updateError } = await supabase
        .from('suppliers')
        .update({
          name: name.trim(),
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim(),
          industry_sector: industrySector.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          notes: notes.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">No Profile Found</h2>
        <p className="text-muted-foreground">
          Your supplier profile hasn&apos;t been created yet. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Company Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your company information. This will be visible to your customers on alkatera.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-400">
              Profile updated successfully
            </AlertDescription>
          </Alert>
        )}

        {/* Logo Upload */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Company Logo
          </h2>

          <div className="flex items-start gap-6">
            {/* Logo preview */}
            <div className="flex-shrink-0">
              {logoUrl ? (
                <div className="relative group">
                  <img
                    src={logoUrl}
                    alt="Company logo"
                    className="h-24 w-24 rounded-xl object-contain border border-border bg-background p-1"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove logo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="h-24 w-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                </div>
              )}
            </div>

            {/* Upload controls */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload your company logo. JPG, PNG, or WebP, max 2MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Company Details */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Company Details
          </h2>

          <div className="space-y-2">
            <Label htmlFor="company-name">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your company name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell your customers about your company — what you do, your sustainability commitments, key products..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This description will be visible to organisations you supply on alkatera.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry-sector">Industry Sector</Label>
              <Input
                id="industry-sector"
                value={industrySector}
                onChange={(e) => setIndustrySector(e.target.value)}
                placeholder="e.g., Food & Beverage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g., United Kingdom"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contact Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Contact Name</Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Primary contact person"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">
                Contact Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@example.com"
                required
              />
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Additional Notes
          </h2>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes (not visible to customers)..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
