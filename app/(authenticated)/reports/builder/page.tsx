'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Statement, Panel, FieldLabel, PillButton, StateChip } from '@/components/studio';
import { StylePicker } from '@/components/report-builder/StylePicker';
import { FunnelSections } from '@/components/report-builder/FunnelSections';
import { FunnelBranding } from '@/components/report-builder/FunnelBranding';
import { GenerationProgress } from '@/components/report-builder/GenerationProgress';
import { FunnelPreview } from '@/components/report-builder/FunnelPreview';
import { NarrativeReview } from '@/components/report-builder/NarrativeReview';
import { useReportBuilder } from '@/hooks/useReportBuilder';
import { useReportProgress } from '@/hooks/useReportProgress';
import {
  useReportDataAvailability,
  sectionHasData,
} from '@/hooks/useReportDataAvailability';
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import { PageLoader } from '@/components/ui/page-loader';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { cn } from '@/lib/utils';
import type { BrandImage, ReportConfig } from '@/types/report-builder';
import { REPORTING_STANDARDS, STANDARDS_LABELS } from '@/types/report-builder';
import {
  REPORT_STYLES,
  resolveReportStyle,
  type ReportStyleId,
} from '@/lib/pdf/templates/report-styles';
import type { ReportDataSnapshot } from '@/lib/reports/narrative-store';

const quietInputClass =
  'h-9 w-full rounded-none border-0 border-b-2 border-studio-hairline bg-transparent px-0 font-display text-sm font-semibold shadow-none outline-none focus-visible:border-studio-forest focus-visible:ring-0';

/** A fact the funnel already answered: bold value with a quiet Edit
 * tap-target that swaps in the live control, one way (the arrival idiom). */
function ConfirmedValue({ value, onEdit }: { value: ReactNode; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group flex w-full items-baseline justify-between gap-3 text-left"
    >
      <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground">
        {value}
      </span>
      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-150 ease-studio group-hover:text-foreground">
        Edit
      </span>
    </button>
  );
}

function FactRow({
  label,
  editing,
  confirmed,
  onEdit,
  children,
}: {
  label: string;
  editing: boolean;
  confirmed: ReactNode;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <FieldLabel className="mb-1.5">{label}</FieldLabel>
      {editing ? children : <ConfirmedValue value={confirmed} onEdit={onEdit} />}
    </div>
  );
}

/** Small toggle pill for inline choices (years, standards, format). */
function ChoicePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-studio',
        active
          ? 'bg-studio-ink text-studio-cream'
          : 'border border-studio-ink/25 text-foreground hover:border-studio-ink/60'
      )}
    >
      {children}
    </button>
  );
}

function ReportFunnelInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { currentOrganization } = useOrganization();
  const {
    createDraftReport,
    draftNarratives,
    patchNarratives,
    regenerateBlock,
    shipReport,
    loadDefaults,
    loadImageLibrary,
    addToImageLibrary,
    loading: creating,
  } = useReportBuilder();
  const currentYear = new Date().getFullYear();

  const [config, setConfig] = useState<ReportConfig>({
    reportName: `Sustainability Report ${currentYear}`,
    reportYear: currentYear,
    reportingPeriodStart: `${currentYear}-01-01`,
    reportingPeriodEnd: `${currentYear}-12-31`,
    audience: 'investors',
    style: 'investors',
    outputFormat: 'pdf',
    template: 'executive',
    standards: ['csrd', 'tcfd'],
    sections: ['executive-summary'],
    branding: { logo: null, primaryColor: '#2563eb', secondaryColor: '#10b981' },
    isMultiYear: false,
    reportYears: [currentYear],
  });
  const [initialised, setInitialised] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  // Phase C draft-then-edit state
  const [draftReportId, setDraftReportId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ReportDataSnapshot | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  // Phase D: the org's reusable image library (brand kit)
  const [imageLibrary, setImageLibrary] = useState<BrandImage[]>([]);

  const availability = useReportDataAvailability(currentOrganization?.id, config.reportYear);
  const progress = useReportProgress(generatingReportId);

  const style = REPORT_STYLES[(config.style as ReportStyleId) ?? 'investors'];

  /** The selected style's default sections, kept honest against the data. */
  const styleDefaults = useMemo(() => {
    const sections = style.defaultSections.filter(id => sectionHasData(id, availability));
    return sections.includes('executive-summary')
      ? sections
      : ['executive-summary', ...sections];
  }, [style, availability]);

  // One-time initialisation: saved org defaults pick the style, the style
  // picks everything else, the data trims the section list.
  useEffect(() => {
    if (initialised || !currentOrganization || availability.loading) return;
    setImageLibrary(loadImageLibrary(currentOrganization));
    const saved = loadDefaults(currentOrganization);
    const styleId: ReportStyleId =
      saved?.style && saved.style in REPORT_STYLES
        ? (saved.style as ReportStyleId)
        : (resolveReportStyle(null, saved?.audience ?? 'investors').id);
    const initialStyle = REPORT_STYLES[styleId];
    const sections = initialStyle.defaultSections.filter(id => sectionHasData(id, availability));
    setConfig(prev => ({
      ...prev,
      ...saved,
      style: styleId,
      audience: initialStyle.audience as ReportConfig['audience'],
      template: initialStyle.themeId as ReportConfig['template'],
      sections: sections.includes('executive-summary') ? sections : ['executive-summary', ...sections],
      standards: saved?.standards?.length ? saved.standards : initialStyle.defaultStandards,
    }));
    setInitialised(true);
  }, [initialised, currentOrganization, availability, loadDefaults]);

  const update = (updates: Partial<ReportConfig>) => setConfig(prev => ({ ...prev, ...updates }));

  const pickStyle = (styleId: ReportStyleId) => {
    const next = REPORT_STYLES[styleId];
    const sections = next.defaultSections.filter(id => sectionHasData(id, availability));
    update({
      style: styleId,
      audience: next.audience as ReportConfig['audience'],
      template: next.themeId as ReportConfig['template'],
      orientation: undefined,
      sections: sections.includes('executive-summary') ? sections : ['executive-summary', ...sections],
      standards: next.defaultStandards,
      // Styles own the default arc and scope; a new style resets both.
      sectionOrder: undefined,
      sectionScopes: undefined,
    });
  };

  const handleAddToLibrary = (image: BrandImage) => {
    setImageLibrary(prev => (prev.some(i => i.url === image.url) ? prev : [...prev, image]));
    if (currentOrganization?.id) {
      addToImageLibrary(currentOrganization.id, image).catch(() => {});
    }
  };

  const openRow = (row: string) => setOpenRows(prev => new Set(prev).add(row));
  const isOpen = (row: string) => openRows.has(row);

  // ── Resume a parked draft via /reports/builder?draft={id} ───────────────────
  const resumeDraftId = searchParams.get('draft');
  useEffect(() => {
    if (!resumeDraftId || !currentOrganization?.id || draftReportId) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: row } = await supabase
        .from('generated_reports')
        .select('*')
        .eq('id', resumeDraftId)
        .maybeSingle();
      if (cancelled || !row) return;
      if (row.status !== 'draft') {
        toast({ title: 'Already shipped', description: 'That report is no longer a draft.' });
        return;
      }
      if (row.config) setConfig(prev => ({ ...prev, ...(row.config as ReportConfig) }));
      setInitialised(true);
      setDraftReportId(row.id);
      const snap = row.data_snapshot as ReportDataSnapshot | null;
      if (snap?.narratives) {
        setSnapshot(snap);
      } else {
        // Draft row exists but the narratives never landed; draft them now.
        setDrafting(true);
        try {
          setSnapshot(await draftNarratives(row.id));
        } catch (err) {
          toast({ title: 'Drafting failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
        } finally {
          setDrafting(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDraftId, currentOrganization?.id]);

  const handleCreate = async () => {
    if (!config.reportName.trim()) {
      toast({ title: 'Name the report', description: 'Give the report a name before generating.', variant: 'destructive' });
      return;
    }
    if (config.sections.length === 0) {
      toast({ title: 'Pick a section', description: 'Choose at least one section to include.', variant: 'destructive' });
      return;
    }
    const result = await createDraftReport(config);
    if (!result.success || !result.report_id) {
      toast({ title: 'Could not create the draft', description: result.error || 'An error occurred.', variant: 'destructive' });
      return;
    }
    setDraftReportId(result.report_id);
    setDrafting(true);
    try {
      setSnapshot(await draftNarratives(result.report_id));
    } catch (err) {
      toast({ title: 'Drafting failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    } finally {
      setDrafting(false);
    }
  };

  const handlePatch = async (patch: Record<string, any>) => {
    if (!draftReportId) return;
    setReviewBusy(true);
    try {
      setSnapshot(await patchNarratives(draftReportId, patch));
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    } finally {
      setReviewBusy(false);
    }
  };

  const handleRegenerateBlock = async (blockId: string, toneHint?: string) => {
    if (!draftReportId) return;
    setReviewBusy(true);
    try {
      setSnapshot(await regenerateBlock(draftReportId, blockId, toneHint));
    } catch (err) {
      toast({ title: 'Regeneration failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    } finally {
      setReviewBusy(false);
    }
  };

  const handleToneChange = async (toneOverride: 'confident' | 'measured' | 'technical' | null) => {
    if (!draftReportId) return;
    setReviewBusy(true);
    try {
      setSnapshot(await draftNarratives(draftReportId, { toneOverride, force: true }));
      update({ toneOverride: toneOverride ?? undefined });
    } catch (err) {
      toast({ title: 'Regeneration failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    } finally {
      setReviewBusy(false);
    }
  };

  const handleShip = async () => {
    if (!draftReportId) return;
    try {
      await shipReport(draftReportId, config);
      setGeneratingReportId(draftReportId);
    } catch (err) {
      toast({ title: 'Shipping failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    }
  };

  if (!initialised) return <PageLoader message="Reading your data..." />;

  // ── Generation view (post-ship) ─────────────────────────────────────────────
  if (generatingReportId) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 py-2">
        <Statement eyebrow="THE EVIDENCE · NEW REPORT" headline="On its way." />
        <GenerationProgress
          status={progress.status}
          documentUrl={progress.documentUrl}
          error={progress.error}
          reportName={config.reportName}
          onDownload={() => progress.documentUrl && window.open(progress.documentUrl, '_blank')}
          onReset={() => {
            setGeneratingReportId(null);
            setDraftReportId(null);
            setSnapshot(null);
          }}
        />
      </div>
    );
  }

  // ── Drafting interstitial ───────────────────────────────────────────────────
  if (draftReportId && drafting) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 py-2">
        <Statement eyebrow="THE EVIDENCE · NEW REPORT" headline="Drafting the narratives." />
        <Panel className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Reading your data and writing a first draft of every section. You review and edit
            everything before it ships.
          </p>
          <StateChip tone="attention" className="shrink-0">Working</StateChip>
        </Panel>
      </div>
    );
  }

  // ── Review view (Phase C) ───────────────────────────────────────────────────
  if (draftReportId && snapshot) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 py-2">
        <div className="space-y-3">
          <Statement eyebrow="THE EVIDENCE · NEW REPORT" headline="Read it before it ships." />
          <p className="text-sm text-muted-foreground">
            Every narrative below is a draft written from your data. Edit anything, regenerate a
            block, or change the voice. Nothing ships until you say so.
          </p>
        </div>
        <NarrativeReview
          organizationId={currentOrganization?.id || null}
          config={config}
          snapshot={snapshot}
          busy={reviewBusy}
          onPatch={handlePatch}
          onRegenerateBlock={handleRegenerateBlock}
          onToneChange={handleToneChange}
          onShip={handleShip}
        />
      </div>
    );
  }

  const periodLabel = `${format(new Date(config.reportingPeriodStart), 'd MMM yyyy')} to ${format(new Date(config.reportingPeriodEnd), 'd MMM yyyy')}`;
  const dataReadyCount = config.sections.filter(id => sectionHasData(id, availability)).length;

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Statement eyebrow="THE EVIDENCE · NEW REPORT" headline="Tell the year's story." />
        <p className="text-sm text-muted-foreground">
          Pick the reader, confirm the details, generate. Everything is prefilled from your data.
        </p>
      </div>

      {/* ── The reader ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <FieldLabel>Who is this report for</FieldLabel>
        <StylePicker value={style.id} onSelect={pickStyle} />
      </div>

      {/* ── The one open question ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <FieldLabel>The one thing this reader should take away</FieldLabel>
        <textarea
          value={config.reportFramingStatement ?? ''}
          onChange={e => update({ reportFramingStatement: e.target.value || undefined })}
          placeholder="One or two sentences. This becomes the editorial lens for every narrative in the report. Leave blank to let the data speak."
          className="h-24 w-full resize-none rounded-[6px] border border-studio-hairline bg-studio-cream p-3 text-sm outline-none transition-colors focus-visible:border-studio-forest"
        />
      </div>

      {/* ── Confirmed details ───────────────────────────────────────────────── */}
      <Panel>
        <div className="mb-2">
          <FieldLabel>Confirmed from your data</FieldLabel>
        </div>
        <div className="divide-y divide-studio-hairline">
          <FactRow
            label="Report name"
            editing={isOpen('name')}
            confirmed={config.reportName}
            onEdit={() => openRow('name')}
          >
            <input
              type="text"
              value={config.reportName}
              onChange={e => update({ reportName: e.target.value })}
              className={quietInputClass}
              autoFocus
            />
          </FactRow>

          <FactRow
            label="Reporting period"
            editing={isOpen('period')}
            confirmed={`${config.reportYear} · ${periodLabel}${config.isMultiYear ? ` · compared with ${(config.reportYears || []).filter(y => y !== config.reportYear).join(', ')}` : ''}`}
            onEdit={() => openRow('period')}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => (
                  <ChoicePill
                    key={year}
                    active={config.reportYear === year}
                    onClick={() =>
                      update({
                        reportYear: year,
                        reportingPeriodStart: `${year}-01-01`,
                        reportingPeriodEnd: `${year}-12-31`,
                        reportYears: config.isMultiYear ? config.reportYears : [year],
                      })
                    }
                  >
                    {year}
                  </ChoicePill>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel className="mb-1">Period start</FieldLabel>
                  <input
                    type="date"
                    value={config.reportingPeriodStart}
                    onChange={e => e.target.value && update({ reportingPeriodStart: e.target.value })}
                    className={quietInputClass}
                  />
                </div>
                <div>
                  <FieldLabel className="mb-1">Period end</FieldLabel>
                  <input
                    type="date"
                    value={config.reportingPeriodEnd}
                    onChange={e => e.target.value && update({ reportingPeriodEnd: e.target.value })}
                    className={quietInputClass}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ChoicePill
                  active={!config.isMultiYear}
                  onClick={() => update({ isMultiYear: false, reportYears: [config.reportYear] })}
                >
                  This year only
                </ChoicePill>
                <ChoicePill
                  active={!!config.isMultiYear}
                  onClick={() =>
                    update({
                      isMultiYear: true,
                      reportYears: [config.reportYear, config.reportYear - 1],
                    })
                  }
                >
                  Compare years
                </ChoicePill>
                {config.isMultiYear && (
                  <span className="ml-1 flex flex-wrap gap-2">
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => {
                      const selected = (config.reportYears || []).includes(year);
                      return (
                        <ChoicePill
                          key={year}
                          active={selected}
                          onClick={() => {
                            const years = config.reportYears || [];
                            const next = selected
                              ? years.filter(y => y !== year)
                              : [...years, year].sort((a, b) => b - a);
                            if (next.length > 0) update({ reportYears: next });
                          }}
                        >
                          {year}
                        </ChoicePill>
                      );
                    })}
                  </span>
                )}
              </div>
            </div>
          </FactRow>

          <FactRow
            label="Sections"
            editing={isOpen('sections')}
            confirmed={[
              `${config.sections.length} sections · picked for ${style.name} readers, ${dataReadyCount} backed by your data`,
              config.sectionOrder?.length ? 'custom order' : null,
              config.sectionScopes?.products ? `${config.sectionScopes.products.pcfIds.length} picked products` : null,
              config.sectionScopes?.trends ? `trends ${config.sectionScopes.trends.fromYear} to ${config.sectionScopes.trends.toYear}` : null,
            ].filter(Boolean).join(' · ')}
            onEdit={() => openRow('sections')}
          >
            <FunnelSections
              config={config}
              availability={availability}
              styleDefaults={styleDefaults}
              styleOrder={style.sectionOrder}
              organizationId={currentOrganization?.id || null}
              onChange={update}
            />
          </FactRow>

          <FactRow
            label="Standards"
            editing={isOpen('standards')}
            confirmed={
              config.standards.length > 0
                ? config.standards.map(s => STANDARDS_LABELS[s] || s).join(' · ')
                : 'None selected'
            }
            onEdit={() => openRow('standards')}
          >
            <div className="flex flex-wrap gap-2">
              {REPORTING_STANDARDS.map(standard => {
                const selected = config.standards.includes(standard.id);
                return (
                  <ChoicePill
                    key={standard.id}
                    active={selected}
                    onClick={() =>
                      update({
                        standards: selected
                          ? config.standards.filter(id => id !== standard.id)
                          : [...config.standards, standard.id],
                      })
                    }
                  >
                    {standard.label}
                  </ChoicePill>
                );
              })}
            </div>
          </FactRow>

          <FactRow
            label="Format"
            editing={isOpen('format')}
            confirmed={config.outputFormat === 'pdf' ? 'PDF document' : 'Interactive HTML'}
            onEdit={() => openRow('format')}
          >
            <div className="space-y-2">
              <div className="flex gap-2">
                <ChoicePill active={config.outputFormat === 'pdf'} onClick={() => update({ outputFormat: 'pdf' })}>
                  PDF document
                </ChoicePill>
                <ChoicePill active={config.outputFormat === 'html'} onClick={() => update({ outputFormat: 'html' })}>
                  Interactive HTML
                </ChoicePill>
              </div>
              <p className="text-xs text-muted-foreground">
                {config.outputFormat === 'pdf'
                  ? 'A branded document with charts and tables, ready to share and publish.'
                  : 'A web document that opens in your browser and can be shared as a link.'}
              </p>
            </div>
          </FactRow>

          <FactRow
            label="Brand"
            editing={isOpen('brand')}
            confirmed={
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-studio-hairline"
                  style={{ backgroundColor: config.branding.primaryColor }}
                />
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-studio-hairline"
                  style={{ backgroundColor: config.branding.secondaryColor }}
                />
                <span>{config.branding.logo ? 'Logo and colours set' : 'Colours set, no logo yet'}</span>
              </span>
            }
            onEdit={() => openRow('brand')}
          >
            <FunnelBranding
              config={config}
              style={style}
              imageLibrary={imageLibrary}
              onAddToLibrary={handleAddToLibrary}
              onChange={update}
            />
          </FactRow>
        </div>
      </Panel>

      {/* ── Truthful preview ────────────────────────────────────────────────── */}
      <FunnelPreview config={config} organizationId={currentOrganization?.id || null} />

      {/* ── Create the draft ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-studio-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Next: a first draft of every narrative, written for {style.name} readers in this
          style&apos;s voice. You read and edit it all before anything ships.
        </p>
        <PillButton variant="room" onClick={handleCreate} disabled={creating} className="shrink-0">
          {creating ? 'Starting.' : 'Draft the report'}
        </PillButton>
      </div>
    </div>
  );
}

export default function ReportFunnelPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading..." />}>
      <ReportFunnelInner />
    </Suspense>
  );
}
