'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Info,
  Factory,
  Building2,
  Users,
  Link2,
} from 'lucide-react';
import { PRODUCTION_UNITS, type DataCollectionMode, type HybridArchetypeOverrides } from '../types';
import { useWizardContext } from '../WizardContext';
import { FacilityArchetypeProxyForm } from '@/components/facilities/FacilityArchetypeProxyForm';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface BrewwSkuBreakdown {
  sku_external_id: string;
  sku_name: string;
  litres: number;
  fraction: number;
}

interface BrewwProductProduction {
  linked: boolean;
  drink_name?: string;
  sku_name?: string;
  sku_container?: string;
  totalHl?: number;
  skuPackagedLitres?: number;
  totalDrinkPackagedLitres?: number;
  allocationFraction?: number;
  skuBreakdown?: BrewwSkuBreakdown[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FacilityAllocationStep() {
  const { preCalcState, setPreCalcState } = useWizardContext();

  const {
    linkedFacilities,
    facilityAllocations,
    reportingSessions,
  } = preCalcState;

  const productId = preCalcState.product?.id;
  const organizationId = preCalcState.product?.organization_id;
  const [breww, setBreww] = useState<BrewwProductProduction | null>(null);
  const [brewwLoading, setBrewwLoading] = useState(false);

  useEffect(() => {
    if (!productId || !organizationId) return;
    let cancelled = false;
    setBrewwLoading(true);
    fetch(`/api/integrations/breww/product-production?organizationId=${organizationId}&productId=${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled && body) setBreww(body); })
      .catch(() => { /* silent, Breww is optional */ })
      .finally(() => { if (!cancelled) setBrewwLoading(false); });
    return () => { cancelled = true };
  }, [productId, organizationId]);

  const applyBrewwVolumes = () => {
    if (!breww?.linked || !breww.skuPackagedLitres || !breww.totalDrinkPackagedLitres) return;
    const sku = String(breww.skuPackagedLitres);
    const total = String(breww.totalDrinkPackagedLitres);
    setPreCalcState((prev) => ({
      ...prev,
      facilityAllocations: prev.facilityAllocations.map((a) => ({
        ...a,
        productionVolume: sku,
        facilityTotalProduction: total,
        productionVolumeUnit: 'litres',
      })),
    }));
  };

  const updateAllocation = (
    facilityId: string,
    field: string,
    value: string
  ) => {
    setPreCalcState((prev) => ({
      ...prev,
      facilityAllocations: prev.facilityAllocations.map((a) =>
        a.facilityId === facilityId ? { ...a, [field]: value } : a
      ),
    }));
  };

  const updateAllocationFields = (
    facilityId: string,
    patch: Record<string, unknown>
  ) => {
    setPreCalcState((prev) => ({
      ...prev,
      facilityAllocations: prev.facilityAllocations.map((a) =>
        a.facilityId === facilityId ? { ...a, ...patch } : a
      ),
    }));
  };

  const selectSession = (facilityId: string, sessionId: string) => {
    const sessions = reportingSessions[facilityId] || [];
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    setPreCalcState((prev) => ({
      ...prev,
      facilityAllocations: prev.facilityAllocations.map((a) =>
        a.facilityId === facilityId
          ? {
              ...a,
              reportingPeriodStart: session.reporting_period_start,
              reportingPeriodEnd: session.reporting_period_end,
              facilityTotalProduction: String(
                session.total_production_volume
              ),
              productionVolumeUnit: session.volume_unit || 'units',
              selectedSessionId: session.id,
            }
          : a
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Review Facility Allocation</h3>
        <p className="text-sm text-muted-foreground">
          Confirm the production volumes and reporting periods for your LCA calculation.
        </p>
      </div>

      {/* Breww allocation banner */}
      {breww?.linked && breww.skuBreakdown && breww.skuBreakdown.length > 0 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Link2 className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  Breww data: {breww.drink_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {breww.totalDrinkPackagedLitres?.toLocaleString()} L packaged across {breww.skuBreakdown.length} container format{breww.skuBreakdown.length === 1 ? '' : 's'} in the last 12 months. This container ({breww.sku_container}) = {((breww.allocationFraction ?? 0) * 100).toFixed(1)}%.
                </p>
              </div>
            </div>
            {breww.skuPackagedLitres ? (
              <Button size="sm" variant="outline" onClick={applyBrewwVolumes}>
                Use Breww volumes
              </Button>
            ) : null}
          </div>

          <div className="space-y-1">
            {breww.skuBreakdown.map((s) => {
              const isThis = breww.sku_container === s.sku_name;
              return (
                <div
                  key={s.sku_external_id}
                  className={`flex items-center justify-between text-xs rounded px-2 py-1.5 ${
                    isThis ? 'bg-blue-500/10 border border-blue-500/30' : ''
                  }`}
                >
                  <span className={isThis ? 'font-medium' : 'text-muted-foreground'}>
                    {isThis && <CheckCircle2 className="h-3 w-3 inline mr-1 text-blue-600" />}
                    {s.sku_name}
                  </span>
                  <span className="tabular-nums">
                    {s.litres.toLocaleString()} L · {(s.fraction * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {breww.skuPackagedLitres === 0 && (
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                This product is linked to a Breww SKU with no packaged volume recorded. Link it to a different SKU, or enter volumes manually below.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Pre-populated info */}
      {linkedFacilities.length > 0 &&
        facilityAllocations.some((a) => a.productionVolume) &&
        preCalcState.product?.annual_production_volume && (
          <Alert className="border-lime-500/30 bg-lime-500/10">
            <Info className="h-4 w-4 text-lime-600" />
            <AlertDescription className="text-sm">
              Production volumes are pre-filled from your product&apos;s annual production
              ({preCalcState.product.annual_production_volume.toLocaleString()}{' '}
              {preCalcState.product.annual_production_unit || 'units'}/year).
              You can adjust them below if needed.
            </AlertDescription>
          </Alert>
        )}

      {linkedFacilities.length > 0 ? (
        <div className="space-y-4">
          {facilityAllocations.map((allocation) => (
            <div
              key={allocation.facilityId}
              className="rounded-lg border p-4 space-y-3"
            >
              {/* Facility header */}
              <div className="flex items-center gap-2">
                {allocation.operationalControl === 'owned' ? (
                  <Building2 className="h-4 w-4 text-blue-600" />
                ) : (
                  <Users className="h-4 w-4 text-amber-600" />
                )}
                <p className="font-medium text-sm">
                  {allocation.facilityName}
                </p>
              </div>

              {/* Data collection mode selector */}
              {allocation.operationalControl === 'third_party' && (
                <div className="space-y-2">
                  <Label className="text-xs">Data collection mode</Label>
                  <RadioGroup
                    value={allocation.dataCollectionMode ?? 'primary'}
                    onValueChange={(value) =>
                      updateAllocationFields(allocation.facilityId, {
                        dataCollectionMode: value as DataCollectionMode,
                      })
                    }
                    className="grid grid-cols-1 md:grid-cols-3 gap-2"
                  >
                    <label className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="primary" className="mt-0.5" />
                      <div className="text-xs">
                        <div className="font-medium">Primary data</div>
                        <div className="text-muted-foreground">
                          Facility supplies energy/water figures for the period.
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="archetype_proxy" className="mt-0.5" />
                      <div className="text-xs">
                        <div className="font-medium">Archetype proxy</div>
                        <div className="text-muted-foreground">
                          Facility cannot supply data — use industry typical values.
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="hybrid" className="mt-0.5" />
                      <div className="text-xs">
                        <div className="font-medium">Hybrid</div>
                        <div className="text-muted-foreground">
                          Mix what you know with archetype defaults.
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {/* Proxy / hybrid configuration */}
              {allocation.operationalControl === 'third_party' &&
                (allocation.dataCollectionMode === 'archetype_proxy' ||
                  allocation.dataCollectionMode === 'hybrid') && (
                  <FacilityArchetypeProxyForm
                    mode={allocation.dataCollectionMode}
                    selectedArchetypeId={allocation.archetypeId ?? null}
                    onArchetypeChange={(id) =>
                      updateAllocationFields(allocation.facilityId, {
                        archetypeId: id,
                      })
                    }
                    justification={allocation.proxyJustification ?? ''}
                    onJustificationChange={(v) =>
                      updateAllocationFields(allocation.facilityId, {
                        proxyJustification: v,
                      })
                    }
                    hybridOverrides={allocation.hybridOverrides as HybridArchetypeOverrides | undefined}
                    onHybridOverridesChange={(o) =>
                      updateAllocationFields(allocation.facilityId, {
                        hybridOverrides: o,
                      })
                    }
                  />
                )}

              {/* Session selector */}
              {(reportingSessions[allocation.facilityId] || []).length >
                0 && (
                <div className="flex flex-wrap gap-2">
                  {(reportingSessions[allocation.facilityId] || []).map(
                    (session) => {
                      const isSelected =
                        allocation.selectedSessionId === session.id;
                      return (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() =>
                            selectSession(
                              allocation.facilityId,
                              session.id
                            )
                          }
                          className={`px-2 py-1 rounded border text-xs transition-all ${
                            isSelected
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {new Date(
                            session.reporting_period_start
                          ).toLocaleDateString('en-GB', {
                            month: 'short',
                            year: 'numeric',
                          })}
                          {isSelected && (
                            <CheckCircle2 className="h-3 w-3 inline ml-1 text-green-600" />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              )}

              {/* Volume inputs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Product Volume</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 10000"
                    value={allocation.productionVolume}
                    onChange={(e) =>
                      updateAllocation(
                        allocation.facilityId,
                        'productionVolume',
                        e.target.value
                      )
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={allocation.productionVolumeUnit}
                    onValueChange={(value) =>
                      updateAllocation(
                        allocation.facilityId,
                        'productionVolumeUnit',
                        value
                      )
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTION_UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total Facility</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 100000"
                    value={allocation.facilityTotalProduction}
                    onChange={(e) =>
                      updateAllocation(
                        allocation.facilityId,
                        'facilityTotalProduction',
                        e.target.value
                      )
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Attribution ratio */}
              {allocation.productionVolume &&
                allocation.facilityTotalProduction && (
                  <div className="p-2 rounded bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                    <p className="text-xs text-lime-800 dark:text-lime-200">
                      <strong>Attribution:</strong>{' '}
                      {(
                        (parseFloat(allocation.productionVolume) /
                          parseFloat(allocation.facilityTotalProduction)) *
                        100
                      ).toFixed(2)}
                      %
                    </p>
                  </div>
                )}
            </div>
          ))}
        </div>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No facilities linked to this product. Manufacturing emissions
            won&apos;t be included in the assessment. You can link facilities
            from the product&apos;s Facilities tab.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
