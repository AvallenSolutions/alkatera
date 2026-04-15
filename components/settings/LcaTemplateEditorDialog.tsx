'use client';

/**
 * Edit an existing LCA report template's name and description from the
 * settings page. The `settings` JSONB blob is shown read-only because
 * editing it here would bypass the wizard's conditional-step validation
 * (e.g. setting systemBoundary to "cradle-to-grave" without the required
 * use-phase config). To change settings, the user edits a template in
 * the wizard on any product, then saves over it via "Save as template".
 *
 * Errors from PATCH /api/lca-templates/[id] (including the 409 duplicate-
 * name from unique_lca_template_name_per_org) are surfaced inline so the
 * dialog can stay open and let the user fix the name.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { LcaReportTemplate } from '@/types/lca-templates';

interface LcaTemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: LcaReportTemplate | null;
  /** Whether the current user can edit (owner/admin). Read-only if false. */
  canEdit: boolean;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved: () => void;
}

/**
 * Human-readable label for each key in the LcaWizardSettings blob.
 * Keeps the read-only settings view scannable without needing to know
 * which camelCase key maps to which ISO-14044 concept.
 */
const SETTING_LABELS: Record<string, string> = {
  intendedApplication: 'Intended application',
  reasonsForStudy: 'Reasons for study',
  intendedAudience: 'Intended audience',
  isComparativeAssertion: 'Comparative assertion',
  systemBoundary: 'System boundary',
  cutoffCriteria: 'Cut-off criteria',
  assumptions: 'Assumptions',
  dataQuality: 'Data quality requirements',
  referenceYear: 'Reference year',
  criticalReviewType: 'Critical review type',
  criticalReviewJustification: 'Critical review justification',
  distributionConfig: 'Distribution configuration',
  usePhaseConfig: 'Use-phase configuration',
  eolConfig: 'End-of-life configuration',
  productLossConfig: 'Product loss configuration',
};

function formatSettingValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value) || '—';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
  }
  // Object — pretty JSON for dataQuality, lifecycle configs etc.
  return JSON.stringify(value, null, 2);
}

export function LcaTemplateEditorDialog({
  open,
  onOpenChange,
  template,
  canEdit,
  onSaved,
}: LcaTemplateEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever a different template is passed in (or the dialog reopens)
  useEffect(() => {
    if (open && template) {
      setName(template.name);
      setDescription(template.description ?? '');
      setSaving(false);
      setError(null);
    }
  }, [open, template]);

  const settingEntries = useMemo(() => {
    if (!template?.settings) return [];
    const entries = Object.entries(template.settings as Record<string, unknown>);
    // Stable order: use SETTING_LABELS order, then anything unknown last
    const known = Object.keys(SETTING_LABELS);
    entries.sort((a, b) => {
      const ai = known.indexOf(a[0]);
      const bi = known.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return entries;
  }, [template]);

  const trimmedName = name.trim();
  const dirty =
    template !== null &&
    (trimmedName !== template.name ||
      (description.trim() || null) !== (template.description ?? null));
  const canSave = canEdit && dirty && trimmedName.length > 0 && !saving;

  async function handleSave() {
    if (!template || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/lca-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to update template');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {canEdit ? 'Edit template' : 'View template'}
          </DialogTitle>
          <DialogDescription>
            {canEdit
              ? 'Rename or update the description. To change wizard settings, apply this template in the LCA wizard, edit, and save over it.'
              : 'Read-only view. Only organisation admins and owners can edit templates.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="editor-template-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="editor-template-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editor-template-description">
              Description
            </Label>
            <Textarea
              id="editor-template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={!canEdit || saving}
              placeholder="Optional description"
            />
          </div>

          {/* Read-only settings summary. Intentionally not editable here — see
              the file-level comment for rationale. */}
          <div className="space-y-2">
            <Label>Wizard settings (read-only)</Label>
            <div className="rounded-md border bg-muted/30 p-3 max-h-80 overflow-y-auto">
              {settingEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No settings stored.
                </p>
              ) : (
                <dl className="space-y-2 text-sm">
                  {settingEntries.map(([key, value]) => {
                    const formatted = formatSettingValue(value);
                    const isMultiline = formatted.includes('\n');
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-[minmax(9rem,max-content)_1fr] gap-x-3 gap-y-0.5"
                      >
                        <dt className="text-xs text-muted-foreground pt-0.5">
                          {SETTING_LABELS[key] ?? key}
                        </dt>
                        <dd
                          className={
                            isMultiline
                              ? 'font-mono text-xs whitespace-pre-wrap break-all'
                              : 'text-sm break-words'
                          }
                        >
                          {formatted}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {canEdit ? 'Cancel' : 'Close'}
          </Button>
          {canEdit && (
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
