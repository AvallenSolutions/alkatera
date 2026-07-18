'use client';

import { useEffect, useState } from 'react';
import { Panel, FieldLabel, StateChip, PillButton } from '@/components/studio';
import { ImagePicker } from '@/components/report-builder/ImagePicker';
import { useReportBuilder } from '@/hooks/useReportBuilder';
import { uploadReportAsset } from '@/lib/reports/upload-report-asset';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';
import type { BrandImage, ReportDefaults } from '@/types/report-builder';

const quietInputClass =
  'h-9 w-full rounded-none border-0 border-b-2 border-studio-hairline bg-transparent px-0 font-display text-sm font-semibold shadow-none outline-none focus-visible:border-studio-forest focus-visible:ring-0';

/**
 * The org's brand kit, edited once from the report hub: logo, the two brand
 * colours, the foreword author, and the reusable image library. Everything
 * here seeds every new report. Writes only the branding and imageLibrary
 * keys of the shared report_defaults column (merge-write), and mirrors the
 * logo into organizations.logo_url so Settings stays one truth.
 */
export function BrandKitEditor() {
  const { currentOrganization } = useOrganization();
  const { saveBrandKit } = useReportBuilder();

  const [branding, setBranding] = useState<ReportDefaults['branding']>({
    logo: null,
    primaryColor: '#205E40',
    secondaryColor: '#047857',
  });
  const [library, setLibrary] = useState<BrandImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh read: the org context can be stale after another tab saved.
  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: org } = await supabase
        .from('organizations')
        .select('report_defaults, logo_url')
        .eq('id', currentOrganization.id)
        .maybeSingle();
      if (cancelled || !org) return;
      const defaults = (org.report_defaults as Record<string, any>) || {};
      setBranding({
        logo: defaults.branding?.logo ?? org.logo_url ?? null,
        primaryColor: defaults.branding?.primaryColor ?? '#205E40',
        secondaryColor: defaults.branding?.secondaryColor ?? '#047857',
        leadership: defaults.branding?.leadership ?? undefined,
      });
      setLibrary(
        Array.isArray(defaults.imageLibrary)
          ? defaults.imageLibrary.filter((i: any): i is BrandImage => typeof i?.url === 'string' && i.url)
          : []
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentOrganization?.id]);

  const markDirty = () => {
    setSaved(false);
    setError(null);
  };

  const upload = async (file: File, kind: string): Promise<string | null> => {
    if (!currentOrganization?.id) return null;
    setUploading(kind);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      return await uploadReportAsset(supabase, file, `brand/${currentOrganization.id}`);
    } catch {
      setError('Upload failed. Please try again.');
      return null;
    } finally {
      setUploading(null);
    }
  };

  const addLibraryImages = async (files: File[]) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const url = await upload(file, 'library');
      if (url) {
        setLibrary(prev => [...prev, { url }]);
        markDirty();
      }
    }
  };

  const setLeadership = (field: 'name' | 'title' | 'photo', value: string) => {
    setBranding(prev => ({
      ...prev,
      leadership: { ...prev.leadership, [field]: value || undefined },
    }));
    markDirty();
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      const ok = await saveBrandKit(currentOrganization.id, { branding, imageLibrary: library });
      if (!ok) throw new Error('save failed');
      // Mirror the logo into organizations.logo_url (Settings reads it).
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from('organizations')
        .update({ logo_url: branding.logo })
        .eq('id', currentOrganization.id);
      setSaved(true);
    } catch {
      setError('Could not save the brand kit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">Loading your brand kit.</p>
      </Panel>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Brand kit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your brand once. Every new report starts from what you save here.
        </p>
      </div>

      <Panel>
        <div className="divide-y divide-studio-hairline">
          {/* Logo */}
          <div className="pb-5">
            <ImagePicker
              slotLabel="Logo"
              note="Used on the report cover and footer, and shown across alkatera."
              library={library}
              value={branding.logo}
              onPick={url => { setBranding(prev => ({ ...prev, logo: url })); markDirty(); }}
              onClear={() => { setBranding(prev => ({ ...prev, logo: null })); markDirty(); }}
              onUploadNew={async file => {
                const url = await upload(file, 'logo');
                if (url) {
                  setBranding(prev => ({ ...prev, logo: url }));
                  setLibrary(prev => (prev.some(i => i.url === url) ? prev : [...prev, { url, label: 'Logo' }]));
                  markDirty();
                }
              }}
              uploading={uploading === 'logo'}
            />
          </div>

          {/* Colours */}
          <div className="py-5">
            <div className="grid grid-cols-2 gap-4">
              {(['primaryColor', 'secondaryColor'] as const).map(field => (
                <div key={field}>
                  <FieldLabel className="mb-2">
                    {field === 'primaryColor' ? 'Primary colour' : 'Secondary colour'}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding[field]}
                      onChange={e => { setBranding(prev => ({ ...prev, [field]: e.target.value })); markDirty(); }}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-[6px] border border-studio-hairline bg-transparent p-0.5"
                    />
                    <input
                      type="text"
                      value={branding[field]}
                      onChange={e => { setBranding(prev => ({ ...prev, [field]: e.target.value })); markDirty(); }}
                      className={cn(quietInputClass, 'font-mono text-xs font-medium')}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Your primary colour carries report covers and section bands; text on it stays
              legible automatically. The secondary colour is a quiet accent.
            </p>
          </div>

          {/* Foreword author */}
          <div className="py-5">
            <FieldLabel className="mb-2">Foreword author</FieldLabel>
            <p className="mb-3 text-xs text-muted-foreground">
              Who signs the leadership message. The message itself is drafted and approved per
              report; the name, role and portrait live here.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={branding.leadership?.name ?? ''}
                onChange={e => setLeadership('name', e.target.value)}
                placeholder="Name"
                className={quietInputClass}
              />
              <input
                type="text"
                value={branding.leadership?.title ?? ''}
                onChange={e => setLeadership('title', e.target.value)}
                placeholder="Role, e.g. CEO"
                className={quietInputClass}
              />
            </div>
            <div className="mt-3">
              <ImagePicker
                slotLabel="Portrait"
                library={library}
                value={branding.leadership?.photo ?? null}
                onPick={url => setLeadership('photo', url)}
                onClear={() => setLeadership('photo', '')}
                onUploadNew={async file => {
                  const url = await upload(file, 'portrait');
                  if (url) {
                    setLeadership('photo', url);
                    setLibrary(prev => (prev.some(i => i.url === url) ? prev : [...prev, { url, label: 'Portrait' }]));
                  }
                }}
                uploading={uploading === 'portrait'}
              />
            </div>
          </div>

          {/* Image library */}
          <div className="pt-5">
            <FieldLabel className="mb-2">Image library</FieldLabel>
            <p className="mb-3 text-xs text-muted-foreground">
              Reusable photography for covers, chapter dividers and the people page. Removing an
              image from the library never affects reports already using it.
            </p>
            {library.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-3">
                {library.map((image, index) => (
                  <div key={image.url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.label || ''}
                      className="h-24 w-full rounded-[6px] border border-studio-hairline object-cover"
                    />
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={image.label ?? ''}
                        onChange={e => {
                          const label = e.target.value;
                          setLibrary(prev => prev.map((img, i) => (i === index ? { ...img, label: label || undefined } : img)));
                          markDirty();
                        }}
                        placeholder="Label"
                        className="h-6 w-full border-0 border-b border-studio-hairline bg-transparent px-0 font-mono text-[10px] uppercase tracking-[0.12em] outline-none focus-visible:border-studio-forest"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLibrary(prev => prev.filter((_, i) => i !== index));
                          markDirty();
                        }}
                      >
                        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
                          Remove
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className="block cursor-pointer rounded-[6px] border border-dashed border-studio-hairline p-4 text-center text-xs text-muted-foreground transition-colors hover:border-foreground/40">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={e => addLibraryImages(Array.from(e.target.files || []))}
                disabled={uploading === 'library'}
              />
              {uploading === 'library' ? 'Uploading.' : 'Upload photos. JPG or PNG, up to 25 MB each.'}
            </label>
          </div>
        </div>
      </Panel>

      <div className="flex items-center justify-between gap-3">
        <span>
          {error && <span className="text-xs text-studio-stale">{error}</span>}
          {saved && !error && <StateChip tone="good">Saved</StateChip>}
        </span>
        <PillButton onClick={handleSave} disabled={saving}>
          {saving ? 'Saving.' : 'Save brand kit'}
        </PillButton>
      </div>
    </div>
  );
}
