'use client';

import { useState } from 'react';
import { FieldLabel } from '@/components/studio';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { cn } from '@/lib/utils';
import type { ReportConfig } from '@/types/report-builder';
import type { ReportStyle } from '@/lib/pdf/templates/report-styles';

interface FunnelBrandingProps {
  config: ReportConfig;
  style: ReportStyle;
  onChange: (updates: Partial<ReportConfig>) => void;
}

const quietInputClass =
  'h-9 w-full rounded-none border-0 border-b-2 border-studio-hairline bg-transparent px-0 font-display text-sm font-semibold shadow-none outline-none focus-visible:border-studio-forest focus-visible:ring-0';

/**
 * Brand and storytelling adjustments: logo, the two brand colours, and, for
 * styles that carry imagery, the leadership message and report photography.
 * Everything here is saved back as the organisation's defaults when the
 * report generates.
 */
export function FunnelBranding({ config, style, onChange }: FunnelBrandingProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  const showStorytelling = style.imagery !== 'none';
  const leadership = config.branding.leadership;
  const heroImages = config.branding.heroImages ?? [];

  async function uploadToStorage(file: File, folder: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('report-assets')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('report-assets').getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'logo' | 'leadership' | 'hero'
  ) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    setUploading(kind);
    setUploadError(null);
    try {
      if (kind === 'logo') {
        const url = await uploadToStorage(files[0], 'logos');
        onChange({ branding: { ...config.branding, logo: url } });
      } else if (kind === 'leadership') {
        const url = await uploadToStorage(files[0], 'leadership');
        onChange({
          branding: { ...config.branding, leadership: { ...leadership, photo: url } },
        });
      } else {
        const urls = await Promise.all(files.slice(0, 3).map(f => uploadToStorage(f, 'hero')));
        onChange({
          branding: { ...config.branding, heroImages: [...heroImages, ...urls].slice(0, 3) },
        });
      }
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const setLeadership = (field: 'name' | 'title' | 'message' | 'photo', value: string) => {
    onChange({
      branding: { ...config.branding, leadership: { ...leadership, [field]: value } },
    });
  };

  const setColour = (field: 'primaryColor' | 'secondaryColor', value: string) => {
    onChange({ branding: { ...config.branding, [field]: value } });
  };

  const removeTag = (
    <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
      Remove
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div>
        <FieldLabel className="mb-2">Logo</FieldLabel>
        {config.branding.logo ? (
          <div className="flex items-center gap-4">
            <div className="rounded-[6px] border border-studio-hairline bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.branding.logo} alt="Logo" className="max-h-12 object-contain" />
            </div>
            <button
              type="button"
              onClick={() => onChange({ branding: { ...config.branding, logo: null } })}
            >
              {removeTag}
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer rounded-[6px] border border-dashed border-studio-hairline p-4 text-center text-xs text-muted-foreground transition-colors hover:border-foreground/40">
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={e => handleUpload(e, 'logo')}
              disabled={uploading === 'logo'}
            />
            {uploading === 'logo' ? 'Uploading.' : 'Upload your logo.'}
          </label>
        )}
      </div>

      {/* Brand colours */}
      <div className="grid grid-cols-2 gap-4">
        {(['primaryColor', 'secondaryColor'] as const).map(field => (
          <div key={field}>
            <FieldLabel className="mb-2">
              {field === 'primaryColor' ? 'Primary colour' : 'Secondary colour'}
            </FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.branding[field]}
                onChange={e => setColour(field, e.target.value)}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-[6px] border border-studio-hairline bg-transparent p-0.5"
              />
              <input
                type="text"
                value={config.branding[field]}
                onChange={e => setColour(field, e.target.value)}
                className={cn(quietInputClass, 'font-mono text-xs font-medium')}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Your primary colour carries the report&apos;s cover and section bands; text on it stays legible
        automatically. The secondary colour is used sparingly as an accent.
      </p>

      {showStorytelling && (
        <>
          {/* Leadership message */}
          <div className="border-t border-studio-hairline pt-5">
            <FieldLabel className="mb-2">Leadership message</FieldLabel>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={leadership?.name ?? ''}
                onChange={e => setLeadership('name', e.target.value)}
                placeholder="Name"
                className={quietInputClass}
              />
              <input
                type="text"
                value={leadership?.title ?? ''}
                onChange={e => setLeadership('title', e.target.value)}
                placeholder="Role, e.g. CEO"
                className={quietInputClass}
              />
            </div>
            <textarea
              value={leadership?.message ?? ''}
              onChange={e => setLeadership('message', e.target.value)}
              placeholder="A personal message about the year: what mattered, what changed, what comes next."
              maxLength={500}
              className="mt-3 h-24 w-full resize-none rounded-[6px] border border-studio-hairline bg-transparent p-3 text-sm outline-none transition-colors focus-visible:border-studio-forest"
            />
            <div className="mt-2 flex items-center gap-4">
              {leadership?.photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={leadership.photo}
                    alt="Leadership portrait"
                    className="h-16 w-14 rounded-[6px] border border-studio-hairline object-cover"
                  />
                  <button type="button" onClick={() => setLeadership('photo', '')}>
                    {removeTag}
                  </button>
                </>
              ) : (
                <label className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => handleUpload(e, 'leadership')}
                    disabled={uploading === 'leadership'}
                  />
                  {uploading === 'leadership' ? 'Uploading.' : 'Add a portrait photo.'}
                </label>
              )}
            </div>
          </div>

          {/* Report photography */}
          <div className="border-t border-studio-hairline pt-5">
            <FieldLabel className="mb-2">Report photography</FieldLabel>
            <p className="mb-3 text-xs text-muted-foreground">
              Up to three photos. The first is the cover, the second a section divider.
            </p>
            {heroImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {heroImages.map((url, i) => (
                  <div key={url} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={i === 0 ? 'Cover photo' : `Photo ${i + 1}`}
                      className="h-20 w-32 rounded-[6px] border border-studio-hairline object-cover"
                    />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-studio-dim">
                        {i === 0 ? 'Cover' : i === 1 ? 'Divider' : `Photo ${i + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            branding: {
                              ...config.branding,
                              heroImages: heroImages.filter((_, idx) => idx !== i),
                            },
                          })
                        }
                      >
                        {removeTag}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {heroImages.length < 3 && (
              <label className="block cursor-pointer rounded-[6px] border border-dashed border-studio-hairline p-4 text-center text-xs text-muted-foreground transition-colors hover:border-foreground/40">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={e => handleUpload(e, 'hero')}
                  disabled={uploading === 'hero'}
                />
                {uploading === 'hero' ? 'Uploading.' : 'Upload photos. JPG or PNG, up to 10 MB each.'}
              </label>
            )}
          </div>
        </>
      )}

      {uploadError && <p className="text-xs text-studio-stale">{uploadError}</p>}
      <p className="text-xs text-muted-foreground">
        Saved as your defaults when the report generates, so next time starts here.
      </p>
    </div>
  );
}
