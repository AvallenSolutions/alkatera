'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Clock, Lock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { SECTION_LABELS } from '@/types/report-builder';
import type { ReportConfig } from '@/types/report-builder';

type AvailabilityStatus = 'available' | 'partial' | 'unavailable';

interface DataAvailability {
  availability: Record<string, AvailabilityStatus>;
  summary: Record<string, boolean>;
}

interface ExecPreview {
  preview: string;
  primaryMessage: string;
}

interface ReportPreviewPanelProps {
  config: ReportConfig;
  organizationId: string | null;
}

export function ReportPreviewPanel({ config, organizationId }: ReportPreviewPanelProps) {
  const [dataAvailability, setDataAvailability] = useState<DataAvailability | null>(null);
  const [execPreview, setExecPreview] = useState<ExecPreview | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live HTML preview state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingHtmlPreview, setLoadingHtmlPreview] = useState(false);
  const htmlPreviewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Debounce HTML preview when config changes
  const fetchHtmlPreview = useCallback(async () => {
    if (!organizationId || config.sections.length === 0) return;
    setLoadingHtmlPreview(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const response = await fetch('/api/reports/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ config, organizationId }),
      });

      if (response.ok) {
        const html = await response.text();
        setPreviewHtml(html);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingHtmlPreview(false);
    }
  }, [organizationId, config]);

  // Re-render preview when key config values change
  useEffect(() => {
    if (!organizationId) return;
    if (htmlPreviewDebounceRef.current) clearTimeout(htmlPreviewDebounceRef.current);
    htmlPreviewDebounceRef.current = setTimeout(fetchHtmlPreview, 800);
    return () => {
      if (htmlPreviewDebounceRef.current) clearTimeout(htmlPreviewDebounceRef.current);
    };
  }, [
    organizationId,
    config.template,
    config.orientation,
    config.audience,
    config.branding?.primaryColor,
    config.branding?.secondaryColor,
    config.branding?.logo,
    config.sections.join(','),
    config.reportYear,
  ]);

  // Write HTML into iframe whenever it changes
  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  // Compute scale factor to fit the iframe into its container
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        const iframeWidth = config.orientation === 'landscape' ? 1123 : 794;
        const scale = containerWidth / iframeWidth;
        container.style.setProperty('--preview-scale', String(Math.min(scale, 1)));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [config.orientation]);

  // Fetch data availability whenever config changes
  useEffect(() => {
    if (!organizationId || config.sections.length === 0) return;
    fetchAvailability();
  }, [organizationId, config.reportYear, config.sections.join(',')]);

  // Debounce exec preview generation (waits for audience/framing to settle)
  useEffect(() => {
    if (!organizationId) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      fetchExecPreview();
    }, 800);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [organizationId, config.reportYear, config.audience, config.reportFramingStatement]);

  async function fetchAvailability() {
    if (!organizationId) return;
    setLoadingAvailability(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const response = await fetch('/api/reports/preview-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationId,
          reportYear: config.reportYear,
          sections: config.sections,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDataAvailability(data);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingAvailability(false);
    }
  }

  async function fetchExecPreview() {
    if (!organizationId) return;
    setLoadingPreview(true);
    setExecPreview(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const response = await fetch('/api/reports/exec-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationId,
          reportYear: config.reportYear,
          audience: config.audience,
          reportFramingStatement: config.reportFramingStatement,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setExecPreview(data);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingPreview(false);
    }
  }

  const availableCount = dataAvailability
    ? Object.values(dataAvailability.availability).filter(s => s === 'available').length
    : 0;
  const partialCount = dataAvailability
    ? Object.values(dataAvailability.availability).filter(s => s === 'partial').length
    : 0;
  const totalSections = config.sections.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-stone-400">Live Preview</p>
        <p className="text-xs text-stone-500 mt-0.5">Updates as you configure</p>
      </div>

      {/* Live HTML preview iframe */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden relative">
        <div
          ref={previewContainerRef}
          className="relative"
          style={{
            width: '100%',
            paddingBottom: config.orientation === 'landscape' ? '70.7%' : '141.4%', // A4 ratio
          }}
        >
          {loadingHtmlPreview && !previewHtml && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-50">
              <div className="text-center space-y-2">
                <Loader2 className="h-5 w-5 animate-spin text-stone-400 mx-auto" />
                <p className="text-xs text-stone-400">Generating preview...</p>
              </div>
            </div>
          )}
          {!previewHtml && !loadingHtmlPreview && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-50">
              <div className="text-center space-y-2">
                <Eye className="h-5 w-5 text-stone-300 mx-auto" />
                <p className="text-xs text-stone-400">Select sections to see a preview</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="Report preview"
            className={cn(
              'absolute top-0 left-0 border-0 origin-top-left',
              !previewHtml && 'hidden'
            )}
            style={{
              width: config.orientation === 'landscape' ? '1123px' : '794px',
              height: config.orientation === 'landscape' ? '794px' : '1123px',
              transform: 'scale(var(--preview-scale, 0.3))',
              transformOrigin: 'top left',
            }}
            sandbox="allow-same-origin"
          />
          {loadingHtmlPreview && previewHtml && (
            <div className="absolute top-2 right-2 z-10">
              <div className="flex items-center gap-1 bg-white/80 backdrop-blur rounded-full px-2 py-1">
                <Loader2 className="h-3 w-3 animate-spin text-stone-400" />
                <span className="text-[10px] text-stone-400">Updating</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data coverage summary */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-700">Data Coverage</p>
          {loadingAvailability && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
        </div>

        {totalSections > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <div className="h-1.5 flex-1 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${totalSections > 0 ? (availableCount / totalSections) * 100 : 0}%` }}
                />
              </div>
              <span className="shrink-0 font-mono">{availableCount}/{totalSections}</span>
            </div>
            <p className="text-xs text-stone-400">
              {availableCount} full &bull; {partialCount} partial &bull; {totalSections - availableCount - partialCount} no data
            </p>
          </div>
        )}

        {/* Section dots */}
        <div className="space-y-1">
          {config.sections.map(sectionId => {
            const status = dataAvailability?.availability[sectionId];
            const label = SECTION_LABELS[sectionId] || sectionId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={sectionId} className="flex items-center gap-2">
                <StatusDot status={loadingAvailability ? undefined : status} />
                <span className="text-xs text-stone-600 truncate">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exec summary preview */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-700">Executive Summary Preview</p>
          {loadingPreview && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
        </div>

        {execPreview ? (
          <div className="space-y-2">
            {execPreview.primaryMessage && (
              <p className="text-xs font-semibold text-stone-800 leading-relaxed">
                {execPreview.primaryMessage}
              </p>
            )}
            {execPreview.preview && (
              <p className="text-xs text-stone-500 leading-relaxed">
                {execPreview.preview}
              </p>
            )}
            <div className="flex items-center gap-1 pt-1">
              <Sparkles className="w-2.5 h-2.5 text-stone-400" />
              <span className="text-[10px] text-stone-400">AI preview based on live data</span>
            </div>
          </div>
        ) : loadingPreview ? (
          <div className="space-y-2">
            <div className="h-3 bg-stone-100 rounded animate-pulse w-full" />
            <div className="h-3 bg-stone-100 rounded animate-pulse w-4/5" />
            <div className="h-3 bg-stone-100 rounded animate-pulse w-3/5" />
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic">
            {organizationId ? 'Select an audience to generate a preview.' : 'Waiting for data...'}
          </p>
        )}
      </div>

      {/* Format badge */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-stone-500">Output format</span>
        <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
          {config.outputFormat}
        </span>
      </div>

      {/* Standards */}
      {config.standards.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-stone-400">Standards</p>
          <div className="flex flex-wrap gap-1">
            {config.standards.map(s => (
              <span
                key={s}
                className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: AvailabilityStatus | undefined }) {
  if (status === undefined) {
    return <div className="w-2 h-2 rounded-full bg-stone-200 shrink-0 animate-pulse" />;
  }
  return (
    <div
      className={cn(
        'w-2 h-2 rounded-full shrink-0',
        status === 'available' && 'bg-emerald-500',
        status === 'partial' && 'bg-amber-400',
        status === 'unavailable' && 'bg-stone-200',
      )}
    />
  );
}
