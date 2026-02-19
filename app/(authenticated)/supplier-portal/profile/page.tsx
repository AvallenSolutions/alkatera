'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, CheckCircle2, Building2 } from 'lucide-react';

interface SupplierProfile {
  id: string;
  name: string;
  contact_email: string;
  contact_name: string | null;
  industry_sector: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
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

  useEffect(() => {
    async function loadProfile() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('suppliers')
        .select('id, name, contact_email, contact_name, industry_sector, country, website, notes')
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
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

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

        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Additional Notes
          </h2>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information about your company..."
              rows={4}
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
