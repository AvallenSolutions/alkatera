'use client';

import { useState } from 'react';
import { FieldLabel } from '@/components/studio';
import { ImagePicker } from '@/components/report-builder/ImagePicker';
import { uploadReportAsset } from '@/lib/reports/upload-report-asset';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { cn } from '@/lib/utils';
import type { BrandImage, ReportConfig, ReportImageSlots } from '@/types/report-builder';
import type { ReportStyle } from '@/lib/pdf/templates/report-styles';
import { resolveTheme } from '@/lib/pdf/templates/themes';

interface FunnelBrandingProps {
  config: ReportConfig;
  style: ReportStyle;
  /** The org's reusable image library (brand kit). */
  imageLibrary: BrandImage[];
  /** Funnel uploads also join the org library. */
  onAddToLibrary: (image: BrandImage) => void;
  onChange: (updates: Partial<ReportConfig>) => void;
}

const quietInputClass =
  'h-9 w-full rounded-none border-0 border-b-2 border-studio-hairline bg-transparent px-0 font-display text-sm font-semibold shadow-none outline-none focus-visible:border-studio-forest focus-visible:ring-0';

/**
 * Brand and storytelling for THIS report, seeded from the org brand kit.
 * Imagery and the leadership author are available to every style; the
 * resolved theme decides where each photo can actually print, and slots the
 * look cannot use are simply not offered. Everything is saved back as org
 * defaults when the report drafts.
 */
export function FunnelBranding({ config, style, imageLibrary, onAddToLibrary, onChange }: FunnelBrandingProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  const theme = resolveTheme(config.template || style.themeId, config.orientation);
  const themeShowsImagery = theme.showHeroImages !== false;
  const themeShowsDividers = theme.showSectionDividers !== false;
  const themeShowsLeadership = theme.showLeadershipPage !== false;

  const leadership = config.branding.leadership;
  const images = config.branding.images ?? {};

  const upload = async (file: File, kind: string): Promise<string | null> => {
    setUploading(kind);
    setUploadError(null);
    try {
      const url = await uploadReportAsset(supabase, file, kind === 'logo' ? 'logos' : kind === 'portrait' ? 'leadership' : 'hero');
      onAddToLibrary({ url });
      return url;
    } catch {
      setUploadError('Upload failed. Please try again.');
      return null;
    } finally {
      setUploading(null);
    }
  };

  const setImageSlot = (slot: keyof ReportImageSlots, url: string | undefined) => {
    const next = { ...images, [slot]: url };
    if (!url) delete next[slot];
    onChange({
      branding: { ...config.branding, images: Object.keys(next).length > 0 ? next : undefined },
    });
  };

  const setLeadership = (field: 'name' | 'title' | 'message' | 'photo', value: string) => {
    onChange({
      branding: { ...config.branding, leadership: { ...leadership, [field]: value } },
    });
  };

  const setColour = (field: 'primaryColor' | 'secondaryColor', value: string) => {
    onChange({ branding: { ...config.branding, [field]: value } });
  };

  const slotPicker = (
    slot: keyof ReportImageSlots,
    label: string,
    note?: string
  ) => (
    <ImagePicker
      slotLabel={label}
      note={note}
      library={imageLibrary}
      value={images[slot] ?? null}
      onPick={url => setImageSlot(slot, url)}
      onClear={() => setImageSlot(slot, undefined)}
      onUploadNew={async file => {
        const url = await upload(file, slot);
        if (url) setImageSlot(slot, url);
      }}
      uploading={uploading === slot}
    />
  );

  return (
    <div className="space-y-6">
      {/* Logo */}
      <ImagePicker
        slotLabel="Logo"
        library={imageLibrary}
        value={config.branding.logo}
        onPick={url => onChange({ branding: { ...config.branding, logo: url } })}
        onClear={() => onChange({ branding: { ...config.branding, logo: null } })}
        onUploadNew={async file => {
          const url = await upload(file, 'logo');
          if (url) onChange({ branding: { ...config.branding, logo: url } });
        }}
        uploading={uploading === 'logo'}
      />

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

      {/* Leadership message: every style; the theme decides whether it prints */}
      <div className="border-t border-studio-hairline pt-5">
        <FieldLabel className="mb-2">Leadership message</FieldLabel>
        {!themeShowsLeadership && (
          <p className="mb-3 text-xs text-muted-foreground">
            This style keeps the document metrics-led, so no leadership page prints. Anything you
            save here stays in your brand kit for styles that carry one.
          </p>
        )}
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
        {themeShowsLeadership && (
          <p className="mt-2 text-xs text-muted-foreground">
            The message itself is drafted for you and approved in the review step; only what you
            accept there prints.
          </p>
        )}
        <div className="mt-3">
          <ImagePicker
            slotLabel="Portrait"
            library={imageLibrary}
            value={leadership?.photo ?? null}
            onPick={url => setLeadership('photo', url)}
            onClear={() => setLeadership('photo', '')}
            onUploadNew={async file => {
              const url = await upload(file, 'portrait');
              if (url) setLeadership('photo', url);
            }}
            uploading={uploading === 'portrait'}
          />
        </div>
      </div>

      {/* Report photography: named slots the current look can actually print */}
      <div className="border-t border-studio-hairline pt-5">
        <FieldLabel className="mb-2">Report photography</FieldLabel>
        {!themeShowsImagery ? (
          <p className="text-xs text-muted-foreground">
            This style keeps imagery minimal by design. Your photos stay in the brand kit and
            appear the moment you pick a style whose look carries them.
          </p>
        ) : (
          <div className="space-y-4">
            {slotPicker('cover', 'Cover photo', 'Behind the brand colour on the cover.')}
            {themeShowsDividers && (
              <>
                {slotPicker('divider1', 'Chapter divider · carbon', 'Behind the carbon chapter opener.')}
                {slotPicker('divider2', 'Chapter divider · commitments', 'Behind the commitments chapter opener.')}
              </>
            )}
            {config.sections.includes('people-culture') &&
              slotPicker('people', 'People page photo', 'A photo band on the People & Culture page.')}
          </div>
        )}
      </div>

      {uploadError && <p className="text-xs text-studio-stale">{uploadError}</p>}
      <p className="text-xs text-muted-foreground">
        Saved as your defaults when the report drafts, so next time starts here.
      </p>
    </div>
  );
}
