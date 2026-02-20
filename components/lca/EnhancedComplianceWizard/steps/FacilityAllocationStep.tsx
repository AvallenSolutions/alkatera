'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { PRODUCTION_UNITS } from '../types';
import { useWizardContext } from '../WizardContext';

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
        <h3 className="text-lg font-semibold">Facility Allocation</h3>
        <p className="text-sm text-muted-foreground">
          Enter the production volumes for each facility linked to this
          product. This determines how manufacturing emissions are attributed.
        </p>
      </div>

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
