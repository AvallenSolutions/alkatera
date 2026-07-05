'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2, FileText, Zap } from 'lucide-react';

export interface ExtractResult {
  ok: boolean;
  error?: string;
  document_type: string;
  utility_type: string;
  supplier_name: string | null;
  account_number: string | null;
  period_start: string | null;
  period_end: string | null;
  quantity_value: number | null;
  quantity_unit: string | null;
  total_cost: number | null;
  currency: string | null;
  notes: string | null;
  facilities: Array<{
    id: string;
    name: string;
    address_country: string | null;
  }>;
}

export interface ImportSummary {
  entryId: string;
  facilityName: string;
  utilityLabel: string;
  quantity: string;
  unit: string;
  periodStart: string;
  periodEnd: string;
}

interface DocumentReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  extracting: boolean;
  extractResult: ExtractResult | null;
  extractError: string | null;
  onImport: (summary: ImportSummary) => void;
  onSendToRosa: () => void;
  fileId: string;
}

const UTILITY_TYPES = [
  { value: 'electricity_grid', label: 'Electricity (grid)' },
  { value: 'natural_gas', label: 'Natural gas (kWh)' },
  { value: 'natural_gas_m3', label: 'Natural gas (m³)' },
  { value: 'lpg', label: 'LPG' },
  { value: 'heat_steam_purchased', label: 'Purchased heat / steam' },
  { value: 'diesel_stationary', label: 'Diesel (generator/stationary)' },
  { value: 'diesel_mobile', label: 'Diesel (fleet)' },
  { value: 'petrol_mobile', label: 'Petrol (fleet)' },
  { value: 'heavy_fuel_oil', label: 'Heavy fuel oil' },
  { value: 'biomass_solid', label: 'Biomass (solid)' },
  { value: 'refrigerant_leakage', label: 'Refrigerant leakage' },
  { value: 'water_intake', label: 'Water' },
];

const IMPORTABLE_TYPES = ['utility_bill', 'meter_reading'];

function documentTypeLabel(type: string): string {
  switch (type) {
    case 'utility_bill': return 'Utility bill';
    case 'meter_reading': return 'Meter reading';
    case 'invoice': return 'Invoice';
    case 'lca_report': return 'LCA report';
    case 'supplier_spec': return 'Supplier spec sheet';
    default: return 'Document';
  }
}

export function DocumentReviewModal({
  open,
  onOpenChange,
  filename,
  extracting,
  extractResult,
  extractError,
  onImport,
  onSendToRosa,
  fileId,
}: DocumentReviewModalProps) {
  const [facilityId, setFacilityId] = useState('');
  const [utilityType, setUtilityType] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    if (extractResult?.ok) {
      setUtilityType(extractResult.utility_type ?? '');
      setPeriodStart(extractResult.period_start ?? '');
      setPeriodEnd(extractResult.period_end ?? '');
      setQuantity(extractResult.quantity_value != null ? String(extractResult.quantity_value) : '');
      setUnit(extractResult.quantity_unit ?? '');
      setNotes(extractResult.notes ?? '');
      setFacilityId(extractResult.facilities.length === 1 ? extractResult.facilities[0].id : '');
    }
  }, [extractResult]);

  useEffect(() => {
    if (!open) {
      setImportError(null);
      setImportSuccess(false);
      setImporting(false);
    }
  }, [open]);

  const canImport =
    extractResult?.ok &&
    IMPORTABLE_TYPES.includes(extractResult.document_type) &&
    facilityId &&
    utilityType &&
    quantity &&
    unit &&
    periodStart &&
    periodEnd;

  async function handleImport() {
    if (!canImport) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch('/api/rosa/uploads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          utility_type: utilityType,
          quantity: Number(quantity),
          unit,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
          notes: notes || undefined,
          source_file_id: fileId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(json.error ?? `Import failed (${res.status})`);
        return;
      }
      setImportSuccess(true);
      const facility = extractResult?.facilities.find(f => f.id === facilityId);
      const utility = UTILITY_TYPES.find(t => t.value === utilityType);
      setTimeout(() => {
        onImport({
          entryId: json.entry_id,
          facilityName: facility?.name ?? 'the selected facility',
          utilityLabel: utility?.label ?? utilityType,
          quantity: quantity,
          unit: unit,
          periodStart: periodStart,
          periodEnd: periodEnd,
        });
        onOpenChange(false);
      }, 1200);
    } catch {
      setImportError('Network error, please try again.');
    } finally {
      setImporting(false);
    }
  }

  const isUtilityBill = extractResult?.ok && IMPORTABLE_TYPES.includes(extractResult.document_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-[6px] border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{filename}</span>
          </div>
          <DialogTitle className="text-base">
            {extracting
              ? 'Reading document...'
              : extractResult?.ok
              ? `${documentTypeLabel(extractResult.document_type)} detected`
              : 'Document upload'}
          </DialogTitle>
        </DialogHeader>

        {/* Extracting state */}
        {extracting && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileText className="w-8 h-8 text-studio-forest" />
            <p className="text-sm text-muted-foreground">Extracting data from your document...</p>
          </div>
        )}

        {/* Extraction failed or unsupported type */}
        {!extracting && (extractError || (extractResult && !extractResult.ok)) && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-studio-attention" />
              <p>
                {extractError ?? extractResult?.error ?? 'Could not extract data from this document.'}
                {' '}You can still send it to Rosa and ask her to read it.
              </p>
            </div>
          </div>
        )}

        {/* Non-utility document — offer to send to Rosa */}
        {!extracting && extractResult?.ok && !isUtilityBill && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 mt-0.5 shrink-0 text-studio-forest" />
              <p>
                This looks like a <strong className="text-foreground">{documentTypeLabel(extractResult.document_type)}</strong>.
                {' '}Rosa can read and discuss it in the chat. Send it across and ask her anything about it.
              </p>
            </div>
          </div>
        )}

        {/* Import success */}
        {importSuccess && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-studio-good" />
            <p className="text-sm font-medium">Imported successfully</p>
          </div>
        )}

        {/* Utility bill review form */}
        {!extracting && extractResult?.ok && isUtilityBill && !importSuccess && (
          <div className="space-y-4">
            {extractResult.supplier_name && (
              <div className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                {extractResult.supplier_name}
                {extractResult.account_number ? ` · Account ${extractResult.account_number}` : ''}
                {extractResult.total_cost != null
                  ? ` · ${extractResult.currency ?? ''}${extractResult.total_cost}`
                  : ''}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Facility *</Label>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select a facility..." />
                </SelectTrigger>
                <SelectContent>
                  {extractResult.facilities.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.address_country ? ` (${f.address_country})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Utility type *</Label>
              <Select value={utilityType} onValueChange={setUtilityType}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {UTILITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Period start *</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Period end *</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quantity *</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Unit *</Label>
                <Input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="kWh, m³, litres..."
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {importError && (
              <div className="flex items-center gap-2 rounded-lg border border-studio-stale/30 bg-card px-3 py-2 text-xs text-studio-stale">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {importError}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {!importSuccess && (
            <>
              {isUtilityBill && !extracting ? (
                <>
                  <button
                    type="button"
                    onClick={onSendToRosa}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  >
                    Send to Rosa instead
                  </button>
                  <Button
                    onClick={handleImport}
                    disabled={!canImport || importing}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm disabled:opacity-40"
                  >
                    {importing ? 'Importing...' : 'Import to system'}
                  </Button>
                </>
              ) : (
                !extracting && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      className="text-muted-foreground hover:text-foreground text-sm"
                    >
                      Dismiss
                    </Button>
                    <Button
                      onClick={onSendToRosa}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm"
                    >
                      Send to Rosa
                    </Button>
                  </>
                )
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
