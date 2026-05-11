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
import { AlertCircle, CheckCircle2, FileText, Loader2, Zap } from 'lucide-react';

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
  { value: 'natural_gas', label: 'Natural gas' },
  { value: 'lpg', label: 'LPG' },
  { value: 'heat_steam_purchased', label: 'Purchased heat / steam' },
  { value: 'diesel_stationary', label: 'Diesel (generator/stationary)' },
  { value: 'diesel_mobile', label: 'Diesel (fleet)' },
  { value: 'petrol_mobile', label: 'Petrol (fleet)' },
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
      setImportError('Network error — please try again.');
    } finally {
      setImporting(false);
    }
  }

  const isUtilityBill = extractResult?.ok && IMPORTABLE_TYPES.includes(extractResult.document_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-700 text-white">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-xs text-zinc-400 truncate">{filename}</span>
          </div>
          <DialogTitle className="text-base text-white">
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
            <Loader2 className="w-8 h-8 animate-spin text-[#ccff00]" />
            <p className="text-sm text-zinc-400">Extracting data from your document...</p>
          </div>
        )}

        {/* Extraction failed or unsupported type */}
        {!extracting && (extractError || (extractResult && !extractResult.ok)) && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
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
            <div className="flex items-start gap-3 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
              <Zap className="w-4 h-4 mt-0.5 shrink-0 text-[#ccff00]" />
              <p>
                This looks like a <strong className="text-white">{documentTypeLabel(extractResult.document_type)}</strong>.
                {' '}Rosa can read and discuss it in the chat — send it across and ask her anything about it.
              </p>
            </div>
          </div>
        )}

        {/* Import success */}
        {importSuccess && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#ccff00]" />
            <p className="text-sm text-white font-medium">Imported successfully</p>
          </div>
        )}

        {/* Utility bill review form */}
        {!extracting && extractResult?.ok && isUtilityBill && !importSuccess && (
          <div className="space-y-4">
            {extractResult.supplier_name && (
              <div className="rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400">
                {extractResult.supplier_name}
                {extractResult.account_number ? ` · Account ${extractResult.account_number}` : ''}
                {extractResult.total_cost != null
                  ? ` · ${extractResult.currency ?? ''}${extractResult.total_cost}`
                  : ''}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Facility *</Label>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-sm">
                  <SelectValue placeholder="Select a facility..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {extractResult.facilities.map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-white focus:bg-zinc-700">
                      {f.name}
                      {f.address_country ? ` (${f.address_country})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Utility type *</Label>
              <Select value={utilityType} onValueChange={setUtilityType}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-sm">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {UTILITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-white focus:bg-zinc-700">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Period start *</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white text-sm [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Period end *</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Quantity *</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0"
                  className="bg-zinc-800 border-zinc-700 text-white text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Unit *</Label>
                <Input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="kWh, m³, litres..."
                  className="bg-zinc-800 border-zinc-700 text-white text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="bg-zinc-800 border-zinc-700 text-white text-sm resize-none"
              />
            </div>

            {importError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300">
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
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline-offset-2 hover:underline"
                  >
                    Send to Rosa instead
                  </button>
                  <Button
                    onClick={handleImport}
                    disabled={!canImport || importing}
                    className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium text-sm disabled:opacity-40"
                  >
                    {importing ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Importing...</>
                    ) : (
                      'Import to system'
                    )}
                  </Button>
                </>
              ) : (
                !extracting && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      className="text-zinc-400 hover:text-white text-sm"
                    >
                      Dismiss
                    </Button>
                    <Button
                      onClick={onSendToRosa}
                      className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium text-sm"
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
