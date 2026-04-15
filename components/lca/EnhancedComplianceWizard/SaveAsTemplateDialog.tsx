'use client';

/**
 * Save the current wizard configuration as a new org-scoped LCA report
 * template. Opened from the "Save as template" button on GoalStep.
 *
 * The wizard context's `saveAsTemplate` action POSTs pickLcaSettings(formData)
 * to /api/lca-templates and re-throws on failure so we can keep the dialog
 * open and surface the error inline — most importantly, a 409 from the
 * unique_lca_template_name_per_org constraint.
 *
 * functionalUnit is intentionally excluded from the settings blob via
 * pickLcaSettings (see types/lca-templates.ts) because it's product-specific.
 */

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useWizardContext } from './WizardContext';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
}: SaveAsTemplateDialogProps) {
  const { saveAsTemplate } = useWizardContext();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the dialog opens so stale state from a previous
  // failed attempt doesn't linger.
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setSetAsDefault(false);
      setSaving(false);
      setError(null);
    }
  }, [open]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await saveAsTemplate(
        trimmedName,
        description.trim() || null,
        setAsDefault,
      );
      onOpenChange(false);
    } catch (err: any) {
      // saveAsTemplate already fired an error toast; surface the message
      // inline too so the user doesn't have to chase the toast to fix it.
      setError(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    trimmedName,
    description,
    setAsDefault,
    saveAsTemplate,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save as LCA report template</DialogTitle>
          <DialogDescription>
            Save the current Goal &amp; Scope configuration so your team can
            reuse it on other products. The functional unit is not saved
            because it&apos;s product-specific.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="lca-template-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lca-template-name"
              placeholder="e.g. Corporate ISO 14067 - 2026"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              autoFocus
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Must be unique within your organisation.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lca-template-description">
              Description (optional)
            </Label>
            <Textarea
              id="lca-template-description"
              placeholder="e.g. Standard goal &amp; scope for 2026 corporate reports — cradle-to-grave, DEFRA v2026 factors."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={saving}
            />
          </div>

          <div className="flex items-start space-x-2 rounded-md border p-3">
            <Checkbox
              id="lca-template-default"
              checked={setAsDefault}
              onCheckedChange={(checked) => setSetAsDefault(checked === true)}
              disabled={saving}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="lca-template-default"
                className="font-medium cursor-pointer"
              >
                Set as organisation default
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                New products with no prior LCA settings will prefill from
                this template. There can only be one default per organisation,
                so this will replace any existing default.
              </p>
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
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
