'use client';

import { useState } from 'react';
import { FieldLabel } from '@/components/studio';
import { cn } from '@/lib/utils';
import type { BrandImage } from '@/types/report-builder';

interface ImagePickerProps {
  /** Mono label over the slot. */
  slotLabel: string;
  /** Quiet contextual note under the control. */
  note?: string;
  /** The org's reusable image library. */
  library: BrandImage[];
  /** Currently picked URL for this slot. */
  value: string | null | undefined;
  onPick: (url: string) => void;
  onClear: () => void;
  /** Upload a new file; the parent decides whether it joins the library. */
  onUploadNew: (file: File) => Promise<void>;
  uploading?: boolean;
  className?: string;
}

/**
 * One imagery slot: current thumbnail with a quiet Remove, a
 * choose-from-library grid, and an upload-new affordance. Hairlines and
 * radius 6 throughout; no pills, no boxes in boxes.
 */
export function ImagePicker({
  slotLabel,
  note,
  library,
  value,
  onPick,
  onClear,
  onUploadNew,
  uploading = false,
  className,
}: ImagePickerProps) {
  const [browsing, setBrowsing] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    await onUploadNew(file);
    setBrowsing(false);
  };

  return (
    <div className={className}>
      <FieldLabel className="mb-2">{slotLabel}</FieldLabel>

      {value ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={slotLabel}
            className="h-20 w-32 rounded-[6px] border border-studio-hairline object-cover"
          />
          <div className="flex flex-col gap-1.5 pt-1">
            <button type="button" onClick={onClear} className="text-left">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
                Remove
              </span>
            </button>
            {library.length > 0 && (
              <button type="button" onClick={() => setBrowsing(v => !v)} className="text-left">
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
                  Swap
                </span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {library.length > 0 && (
            <button
              type="button"
              onClick={() => setBrowsing(v => !v)}
              className="rounded-[6px] border border-studio-hairline px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40"
            >
              Choose from your library
            </button>
          )}
          <label className="cursor-pointer rounded-[6px] border border-dashed border-studio-hairline px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40">
            <input type="file" className="hidden" accept="image/*" onChange={handleFile} disabled={uploading} />
            {uploading ? 'Uploading.' : 'Upload new'}
          </label>
        </div>
      )}

      {browsing && library.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {library.map(image => (
            <button
              key={image.url}
              type="button"
              onClick={() => {
                onPick(image.url);
                setBrowsing(false);
              }}
              className={cn(
                'group overflow-hidden rounded-[6px] border text-left transition-colors',
                value === image.url ? 'border-studio-ink' : 'border-studio-hairline hover:border-foreground/40'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.label || ''} className="h-16 w-full object-cover" />
              {image.label && (
                <span className="block truncate px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-studio-dim">
                  {image.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
