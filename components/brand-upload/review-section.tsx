'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  AlertCircle,
  Plus,
  Lock,
  Leaf,
  Droplets,
  Package,
  Sprout,
  ShieldCheck,
  Building2,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FIELD_LABELS,
  PILLAR_LABELS,
  PILLAR_ORDER,
  getFieldLabel,
  type FieldLabel,
  type PillarMeta,
} from '@/lib/distributor/scraping/field-labels';
import type { FieldKey, Pillar } from '@/lib/distributor/scraping/field-definitions';
import { describeSource, isBrandVerified } from '@/lib/distributor/scraping/source-display';

const PILLAR_ICONS: Record<PillarMeta['icon'], LucideIcon> = {
  Leaf,
  Droplets,
  Package,
  Sprout,
  ShieldCheck,
  Building2,
};

/**
 * Tailwind class permutations per pillar accent. Stored as a static map
 * because Tailwind's JIT can't pick up runtime-built class names like
 * `bg-${accent}-500/10`. Each pillar gets a chip class set + a left-bar
 * gradient for the accordion header.
 */
const ACCENT_CLASSES: Record<PillarMeta['accent'], {
  chipBg: string;
  chipText: string;
  chipBorder: string;
  bar: string;
}> = {
  emerald: {
    chipBg: 'bg-emerald-500/10',
    chipText: 'text-emerald-300',
    chipBorder: 'border-emerald-400/30',
    bar: 'bg-gradient-to-b from-emerald-400 to-emerald-500/40',
  },
  cyan: {
    chipBg: 'bg-cyan-500/10',
    chipText: 'text-cyan-300',
    chipBorder: 'border-cyan-400/30',
    bar: 'bg-gradient-to-b from-cyan-400 to-cyan-500/40',
  },
  amber: {
    chipBg: 'bg-amber-500/10',
    chipText: 'text-amber-300',
    chipBorder: 'border-amber-400/30',
    bar: 'bg-gradient-to-b from-amber-400 to-amber-500/40',
  },
  teal: {
    chipBg: 'bg-teal-500/10',
    chipText: 'text-teal-300',
    chipBorder: 'border-teal-400/30',
    bar: 'bg-gradient-to-b from-teal-400 to-teal-500/40',
  },
  indigo: {
    chipBg: 'bg-indigo-500/10',
    chipText: 'text-indigo-300',
    chipBorder: 'border-indigo-400/30',
    bar: 'bg-gradient-to-b from-indigo-400 to-indigo-500/40',
  },
  slate: {
    chipBg: 'bg-slate-500/15',
    chipText: 'text-slate-200',
    chipBorder: 'border-slate-400/30',
    bar: 'bg-gradient-to-b from-slate-300 to-slate-500/40',
  },
};
import {
  ReviewerIdentityCard,
  useStoredReviewer,
  type ReviewerIdentity,
} from './reviewer-identity';
import { EditFieldModal } from './edit-field-modal';
import type { BrandUploadFieldState } from '@/app/api/brand-upload/[token]/route';

interface SkuRow {
  id: string;
  product_name: string;
  sku_code: string | null;
}

interface Props {
  token: string;
  distributorName: string;
  brandName: string;
  skus: SkuRow[];
  initialFieldStates: BrandUploadFieldState[];
}

type ScopeKey = string; // `${brand_sku_id ?? 'brand'}::${field_key}`

interface PendingFlight {
  field_key: FieldKey;
  brand_sku_id: string | null;
}

function scopeKey(fieldKey: FieldKey, brandSkuId: string | null): ScopeKey {
  return `${brandSkuId ?? 'brand'}::${fieldKey}`;
}

/**
 * The review portal — every field we hold for the brand, with the
 * brand's own confirm/edit actions plus a per-product expander where
 * the field genuinely differs by SKU.
 */
export function ReviewSection({
  token,
  distributorName,
  brandName,
  skus,
  initialFieldStates,
}: Props) {
  const [fieldStates, setFieldStates] = useState<BrandUploadFieldState[]>(initialFieldStates);
  const [identity, setIdentity] = useStoredReviewer();
  const [pending, setPending] = useState<Set<ScopeKey>>(new Set());
  const [editing, setEditing] = useState<{
    field: FieldLabel;
    brandSkuId: string | null;
  } | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const stateMap = useMemo(() => {
    const m = new Map<ScopeKey, BrandUploadFieldState>();
    for (const s of fieldStates) m.set(scopeKey(s.field_key, s.brand_sku_id), s);
    return m;
  }, [fieldStates]);

  const summary = useMemo(() => computeSummary(stateMap), [stateMap]);

  function setFlight(key: ScopeKey, flying: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (flying) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function refetch() {
    try {
      const res = await fetch(`/api/brand-upload/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { field_states: BrandUploadFieldState[] };
      if (Array.isArray(data.field_states)) setFieldStates(data.field_states);
    } catch {
      // Refetch is best-effort; the optimistic state is already what the brand expects.
    }
  }

  async function postVerification(
    payload: PendingFlight & {
      value: unknown;
      verification_method: 'confirmed' | 'corrected';
      evidence?: File | null;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!identity) return { ok: false, error: 'no_identity' };

    const verification = {
      field_key: payload.field_key,
      brand_sku_id: payload.brand_sku_id,
      value: payload.value,
      verification_method: payload.verification_method,
    };

    let res: Response;
    if (payload.evidence) {
      const fd = new FormData();
      fd.append('verified_by_name', identity.name);
      fd.append('verified_by_email', identity.email);
      fd.append('verification', JSON.stringify(verification));
      fd.append('file', payload.evidence, payload.evidence.name);
      res = await fetch(`/api/brand-upload/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        body: fd,
      });
    } else {
      res = await fetch(`/api/brand-upload/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          verified_by_name: identity.name,
          verified_by_email: identity.email,
          verifications: [verification],
        }),
      });
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    const body = (await res.json()) as {
      results?: Array<{ ok: boolean; error?: string }>;
      evidence?: { ok: boolean; error?: string };
    };
    const result = body.results?.[0];
    if (result && !result.ok) return { ok: false, error: result.error };
    if (body.evidence && !body.evidence.ok) {
      // Verification landed but the file didn't. Surface as a soft error
      // so the brand knows the answer was saved but the evidence wasn't.
      return { ok: true, error: `evidence_${body.evidence.error ?? 'failed'}` };
    }
    return { ok: true };
  }

  async function handleConfirm(fieldKey: FieldKey, brandSkuId: string | null) {
    if (!identity) {
      setTopError('Please add your name and email above before confirming values.');
      return;
    }
    const key = scopeKey(fieldKey, brandSkuId);
    const state = stateMap.get(key);
    if (!state || state.field_value === null) return;
    setTopError(null);
    setFlight(key, true);
    const rawValue =
      state.field_value_numeric !== null && !isBoolLikeText(state.field_value)
        ? state.field_value_numeric
        : state.field_value;
    const result = await postVerification({
      field_key: fieldKey,
      brand_sku_id: brandSkuId,
      value: rawValue,
      verification_method: 'confirmed',
    });
    setFlight(key, false);
    if (!result.ok) {
      setTopError(`We could not save that confirmation (${result.error ?? 'unknown error'}).`);
      return;
    }
    await refetch();
  }

  function handleStartEdit(fieldKey: FieldKey, brandSkuId: string | null) {
    if (!identity) {
      setTopError('Please add your name and email above before editing values.');
      return;
    }
    const field = getFieldLabel(fieldKey);
    if (!field) return;
    setEditError(null);
    setEditing({ field, brandSkuId });
  }

  async function handleSaveEdit(rawValue: unknown, evidence: File | null) {
    if (!editing || !identity) return;
    const key = scopeKey(editing.field.key, editing.brandSkuId);
    setSavingEdit(true);
    setEditError(null);
    setFlight(key, true);
    const result = await postVerification({
      field_key: editing.field.key,
      brand_sku_id: editing.brandSkuId,
      value: rawValue,
      verification_method: 'corrected',
      evidence,
    });
    setFlight(key, false);
    setSavingEdit(false);
    if (!result.ok) {
      setEditError(`We could not save that change (${result.error ?? 'unknown error'}).`);
      return;
    }
    // A soft error means the verification saved but the evidence didn't.
    // Keep the modal open and tell the user, so they can retry the file
    // without re-doing the value.
    if (result.error) {
      setEditError(
        `Your answer was saved, but the file upload failed (${result.error}). Try again or remove the file.`,
      );
      await refetch();
      return;
    }
    setEditing(null);
    await refetch();
  }

  const noIdentity = !identity;

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
          <ClipboardCheck className="h-3 w-3" />
          The data we hold on {brandName}
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Tell us what's right, what's wrong, and what's missing.
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          We've gathered the information below from your website and public registers. Tick
          anything that's right, correct anything that isn't, and fill any gaps you can.
          Everything you change goes straight to {distributorName}.
        </p>
      </div>

      <ReviewerIdentityCard identity={identity} onChange={setIdentity} />

      <ProgressCard summary={summary} />

      {topError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{topError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {PILLAR_ORDER.map((pillar) => (
          <PillarGroup
            key={pillar}
            pillar={pillar}
            fields={FIELD_LABELS.filter((f) => f.pillar === pillar)}
            stateMap={stateMap}
            skus={skus}
            pending={pending}
            disabled={noIdentity}
            onConfirm={handleConfirm}
            onEdit={handleStartEdit}
          />
        ))}
      </div>

      {editing && (
        <EditFieldModal
          field={editing.field}
          scopeLabel={
            editing.brandSkuId
              ? `For ${skus.find((s) => s.id === editing.brandSkuId)?.product_name ?? 'this product'}`
              : `Applies to the whole ${brandName} brand`
          }
          currentValue={
            stateMap.get(scopeKey(editing.field.key, editing.brandSkuId))?.field_value ?? null
          }
          saving={savingEdit}
          error={editError}
          onSave={handleSaveEdit}
          onClose={() => {
            setEditing(null);
            setEditError(null);
          }}
        />
      )}
    </section>
  );
}

function PillarGroup({
  pillar,
  fields,
  stateMap,
  skus,
  pending,
  disabled,
  onConfirm,
  onEdit,
}: {
  pillar: Pillar;
  fields: FieldLabel[];
  stateMap: Map<ScopeKey, BrandUploadFieldState>;
  skus: SkuRow[];
  pending: Set<ScopeKey>;
  disabled: boolean;
  onConfirm: (fieldKey: FieldKey, brandSkuId: string | null) => void;
  onEdit: (fieldKey: FieldKey, brandSkuId: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = PILLAR_LABELS[pillar];
  const Icon = PILLAR_ICONS[meta.icon];
  const accent = ACCENT_CLASSES[meta.accent];
  const populated = fields.filter((f) => stateMap.get(scopeKey(f.key, null))?.field_value).length;
  const populatedPct = Math.round((populated / Math.max(fields.length, 1)) * 100);

  return (
    <div className="relative rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-[3px] ${accent.bar}`} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 pl-6 pr-5 py-4 text-left hover:bg-background/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`rounded-lg ${accent.chipBg} ${accent.chipBorder} border p-2 shrink-0`}>
            <Icon className={`h-4 w-4 ${accent.chipText}`} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{meta.label}</div>
            <div className="text-xs text-muted-foreground truncate">{meta.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {populated}
              <span className="text-muted-foreground font-normal"> / {fields.length}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {populatedPct}% populated
            </div>
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              brandState={stateMap.get(scopeKey(field.key, null)) ?? null}
              skuStates={
                field.scope === 'brand'
                  ? []
                  : skus.map((sku) => ({
                      sku,
                      state: stateMap.get(scopeKey(field.key, sku.id)) ?? null,
                    }))
              }
              pending={pending}
              disabled={disabled}
              onConfirm={onConfirm}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  brandState,
  skuStates,
  pending,
  disabled,
  onConfirm,
  onEdit,
}: {
  field: FieldLabel;
  brandState: BrandUploadFieldState | null;
  skuStates: Array<{ sku: SkuRow; state: BrandUploadFieldState | null }>;
  pending: Set<ScopeKey>;
  disabled: boolean;
  onConfirm: (fieldKey: FieldKey, brandSkuId: string | null) => void;
  onEdit: (fieldKey: FieldKey, brandSkuId: string | null) => void;
}) {
  const [skuOpen, setSkuOpen] = useState(false);
  const hasSkuValues = skuStates.some((row) => row.state?.field_value);
  const showSkuToggle = field.scope !== 'brand' && skuStates.length > 0;
  const isLongtext = field.inputType === 'longtext';

  return (
    <div className="px-5 py-4 hover:bg-background/30 transition-colors space-y-3">
      {isLongtext ? (
        <LongtextFieldBody
          field={field}
          state={brandState}
          pending={pending.has(scopeKey(field.key, null))}
          disabled={disabled}
          onConfirm={() => onConfirm(field.key, null)}
          onEdit={() => onEdit(field.key, null)}
        />
      ) : (
        <div className="flex items-start justify-between gap-4 flex-col sm:flex-row sm:items-center">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <StatusDot state={brandState} />
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{field.label}</span>
                {field.scope === 'sku' && (
                  <span className="text-[10px] uppercase tracking-wider bg-muted/70 text-muted-foreground rounded-full px-2 py-0.5 font-semibold">
                    Per product
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">{field.helpText}</div>
            </div>
          </div>

          <FieldValueDisplay
            field={field}
            state={brandState}
            pending={pending.has(scopeKey(field.key, null))}
            disabled={disabled}
            onConfirm={() => onConfirm(field.key, null)}
            onEdit={() => onEdit(field.key, null)}
          />
        </div>
      )}

      {showSkuToggle && (
        <div className="pt-1 pl-5">
          <button
            type="button"
            onClick={() => setSkuOpen((v) => !v)}
            className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1 font-medium"
          >
            {skuOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {skuOpen
              ? 'Hide per-product values'
              : hasSkuValues
              ? 'Show per-product values'
              : 'Set a different value for specific products'}
          </button>
          {skuOpen && (
            <div className="mt-2 rounded-lg border border-border/40 bg-background/40 divide-y divide-border/40">
              {skuStates.map(({ sku, state }) => (
                <div
                  key={sku.id}
                  className="px-3 py-2.5 flex items-center justify-between gap-3 flex-col sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                    <StatusDot state={state} dim />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{sku.product_name}</div>
                      {sku.sku_code && (
                        <div className="text-[11px] text-muted-foreground">{sku.sku_code}</div>
                      )}
                    </div>
                  </div>
                  <FieldValueDisplay
                    field={field}
                    state={state}
                    pending={pending.has(scopeKey(field.key, sku.id))}
                    disabled={disabled}
                    inheritedFromBrand={state === null && !!brandState?.field_value}
                    inheritedValue={state === null ? brandState : null}
                    onConfirm={() => onConfirm(field.key, sku.id)}
                    onEdit={() => onEdit(field.key, sku.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LongtextFieldBody({
  field,
  state,
  pending,
  disabled,
  onConfirm,
  onEdit,
}: {
  field: FieldLabel;
  state: BrandUploadFieldState | null;
  pending: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const hasValue = !!state?.field_value;
  const verified = state ? isBrandVerified(state.source_name) : false;
  const preview = state?.field_value ? truncate(state.field_value, 320) : null;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <StatusDot state={state} />
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{field.label}</span>
            {field.scope === 'sku' && (
              <span className="text-[10px] uppercase tracking-wider bg-muted/70 text-muted-foreground rounded-full px-2 py-0.5 font-semibold">
                Per product
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">{field.helpText}</div>
        </div>
      </div>

      {hasValue ? (
        <div className="ml-5 rounded-lg border border-border/60 bg-background/40 p-3.5 space-y-2">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{preview}</p>
          <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] text-muted-foreground">
            <span>{state ? describeSource(state.source_name) : null}</span>
            <div className="flex items-center gap-1.5">
              {!verified && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onConfirm}
                  disabled={pending || disabled}
                  className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100 hover:border-sky-400"
                  title={disabled ? 'Add your name above first' : 'Confirm this value is correct'}
                >
                  {pending ? '…' : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" /> Looks right
                    </>
                  )}
                </Button>
              )}
              {verified && (
                <span className="inline-flex items-center gap-1 text-xs text-sky-200 bg-sky-500/15 border border-sky-400/40 rounded-full px-2 py-0.5 font-medium">
                  <Check className="h-3 w-3" /> Verified by you
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                disabled={pending || disabled}
                className="text-muted-foreground hover:text-sky-200 hover:bg-sky-500/10"
                title={disabled ? 'Add your name above first' : 'Edit value'}
              >
                {disabled ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="ml-5 flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-background/20 px-3.5 py-3 text-sm text-muted-foreground italic">
          <span>Not yet collected</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            disabled={pending || disabled}
            className="text-muted-foreground hover:text-sky-200 hover:bg-sky-500/10"
            title={disabled ? 'Add your name above first' : 'Add value'}
          >
            {disabled ? <Lock className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

function StatusDot({ state, dim }: { state: BrandUploadFieldState | null; dim?: boolean }) {
  const hasValue = !!state?.field_value;
  const verified = state ? isBrandVerified(state.source_name) : false;
  const size = dim ? 'h-1.5 w-1.5' : 'h-2 w-2';
  if (verified) {
    return (
      <span
        className={`${size} mt-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)] shrink-0`}
        aria-label="Verified by you"
      />
    );
  }
  if (hasValue) {
    return (
      <span
        className={`${size} mt-1.5 rounded-full bg-foreground/50 shrink-0`}
        aria-label="Collected, not yet verified"
      />
    );
  }
  return (
    <span
      className={`${size} mt-1.5 rounded-full border border-border bg-transparent shrink-0`}
      aria-label="Not yet collected"
    />
  );
}

function FieldValueDisplay({
  field,
  state,
  pending,
  disabled,
  inheritedFromBrand = false,
  inheritedValue = null,
  onConfirm,
  onEdit,
}: {
  field: FieldLabel;
  state: BrandUploadFieldState | null;
  pending: boolean;
  disabled: boolean;
  inheritedFromBrand?: boolean;
  inheritedValue?: BrandUploadFieldState | null;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const hasOwnValue = !!state?.field_value;
  const displayState = state ?? inheritedValue;
  const isVerified = state ? isBrandVerified(state.source_name) : false;

  return (
    <div className="flex items-center gap-3 sm:flex-shrink-0">
      <div className="text-right space-y-1 min-w-[10rem]">
        <div className="text-sm font-medium tabular-nums">
          {displayState?.field_value ? (
            formatValue(field, displayState.field_value, displayState.field_value_numeric)
          ) : (
            <span className="text-muted-foreground italic font-normal">Not yet collected</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {inheritedFromBrand && inheritedValue
            ? `Uses brand value · ${describeSource(inheritedValue.source_name)}`
            : displayState
              ? describeSource(displayState.source_name)
              : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {hasOwnValue && !isVerified && (
          <Button
            size="sm"
            variant="outline"
            onClick={onConfirm}
            disabled={pending || disabled}
            className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100 hover:border-sky-400"
            title={disabled ? 'Add your name above first' : 'Confirm this value is correct'}
          >
            {pending ? '…' : (
              <>
                <Check className="h-3.5 w-3.5 mr-1" /> Looks right
              </>
            )}
          </Button>
        )}
        {hasOwnValue && isVerified && (
          <span className="inline-flex items-center gap-1 text-xs text-sky-200 bg-sky-500/15 border border-sky-400/40 rounded-full px-2 py-0.5 font-medium">
            <Check className="h-3 w-3" /> Verified by you
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          disabled={pending || disabled}
          className="text-muted-foreground hover:text-sky-200 hover:bg-sky-500/10"
          title={disabled ? 'Add your name above first' : hasOwnValue ? 'Edit value' : 'Add value'}
        >
          {disabled ? (
            <Lock className="h-3.5 w-3.5" />
          ) : hasOwnValue ? (
            <Pencil className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function ProgressCard({
  summary,
}: {
  summary: { populated: number; verified: number; total: number };
}) {
  const populatedPct = Math.round((summary.populated / Math.max(summary.total, 1)) * 100);
  const verifiedPct = Math.round((summary.verified / Math.max(summary.total, 1)) * 100);
  const missing = Math.max(summary.total - summary.populated, 0);
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Populated" value={summary.populated} total={summary.total} tone="default" />
        <Stat label="Verified by you" value={summary.verified} total={summary.total} tone="blue" />
        <Stat label="Still empty" value={missing} total={summary.total} tone="muted" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          <span>Overall progress</span>
          <span>{populatedPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden relative">
          <div
            className="absolute inset-y-0 left-0 bg-foreground/25"
            style={{ width: `${populatedPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"
            style={{ width: `${verifiedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'default' | 'blue' | 'muted';
}) {
  const valueColor =
    tone === 'blue' ? 'text-sky-300' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground';
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold tabular-nums tracking-tight ${valueColor}`}>
          {value}
        </span>
        <span className="text-xs text-muted-foreground">of {total}</span>
      </div>
    </div>
  );
}

function computeSummary(stateMap: Map<ScopeKey, BrandUploadFieldState>) {
  let populated = 0;
  let verified = 0;
  const total = FIELD_LABELS.length;
  for (const field of FIELD_LABELS) {
    const state = stateMap.get(scopeKey(field.key, null));
    if (state?.field_value) populated += 1;
    if (state && isBrandVerified(state.source_name)) verified += 1;
  }
  return { populated, verified, total };
}

function formatValue(field: FieldLabel, text: string, numeric: number | null): string {
  if (field.inputType === 'boolean') {
    const s = text.trim().toLowerCase();
    if (['true', 'yes', '1'].includes(s)) return 'Yes';
    if (['false', 'no', '0'].includes(s)) return 'No';
    return text;
  }
  if (field.inputType === 'select' && field.selectOptions) {
    const match = field.selectOptions.find((opt) => opt.value === text.trim());
    if (match) return match.label;
  }
  if ((field.inputType === 'number' || field.inputType === 'percent') && numeric !== null) {
    const formatted = Number.isInteger(numeric)
      ? numeric.toString()
      : numeric.toFixed(numeric < 1 ? 3 : 2);
    return field.unit ? `${formatted} ${field.unit}` : formatted;
  }
  if (field.inputType === 'url') {
    try {
      const u = new URL(text);
      return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      return text;
    }
  }
  if (field.inputType === 'longtext' && text.length > 80) {
    return text.slice(0, 80) + '…';
  }
  return text;
}

function isBoolLikeText(text: string | null): boolean {
  if (!text) return false;
  const s = text.trim().toLowerCase();
  return ['true', 'false', 'yes', 'no'].includes(s);
}
