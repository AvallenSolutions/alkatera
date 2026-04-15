'use client';

/**
 * Apply an org-scoped LCA report template to the current wizard session.
 *
 * Mounted once in the wizard shell (`WizardLayout`) and auto-opened on
 * wizard load when the product has no prior `last_wizard_settings`, so the
 * user is explicitly prompted to pick a template or skip to a blank wizard.
 * Lists every `lca_report_templates` row the user can see (RLS filters to
 * their org), with the org default pinned at the top and shown with a star
 * badge.
 *
 * Auto-dismiss on zero templates: if the org has no templates yet, there's
 * nothing to pick, so the dialog closes itself immediately rather than
 * showing an empty "No templates yet" prompt. This keeps brand-new orgs
 * friction-free on their very first LCA run.
 *
 * On apply, we call `applyTemplate(id)` from the wizard context, which
 * overlays the template's settings onto the current formData. The user is
 * then expected to review and either save manually or edit a field (which
 * trips the existing 2s debounced auto-save).
 *
 * functionalUnit is product-specific and intentionally not part of a
 * template — the overlay leaves it untouched.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Star } from 'lucide-react';
import { useWizardContext } from './WizardContext';
import type { LcaReportTemplate } from '@/types/lca-templates';

interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Organisation to list templates for. Resolved from the wizard's
   * preCalcState.product.organization_id by the caller so the dialog
   * itself stays ignorant of product-load order.
   */
  organizationId: string | null;
}

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  organizationId,
}: ApplyTemplateDialogProps) {
  const { applyTemplate } = useWizardContext();

  const [templates, setTemplates] = useState<LcaReportTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch every time the dialog opens so a freshly-created template
  // on a parallel tab shows up without a page refresh.
  useEffect(() => {
    if (!open || !organizationId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/lca-templates?organizationId=${encodeURIComponent(organizationId!)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || 'Failed to load templates');
        }
        if (cancelled) return;
        const list = (json?.templates ?? []) as LcaReportTemplate[];
        setTemplates(list);
        // Default the selection to the org default (first row by API order)
        // so a single Enter/Apply applies the obvious choice.
        setSelectedId(list[0]?.id ?? null);
        // Auto-dismiss when there's nothing to pick. Avoids showing an
        // empty prompt to brand-new orgs who've never saved a template.
        if (list.length === 0) {
          onOpenChange(false);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load templates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  const handleApply = useCallback(async () => {
    if (!selectedId) return;
    setApplying(true);
    try {
      await applyTemplate(selectedId);
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  }, [applyTemplate, selectedId, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply LCA report template</DialogTitle>
          <DialogDescription>
            Overlay an org-wide template onto this wizard. The functional
            unit stays as you&apos;ve set it for this product.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading templates...
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && templates.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No templates yet. Use &ldquo;Save as template&rdquo; on a finished
            wizard to create one your whole organisation can reuse.
          </div>
        )}

        {!loading && !error && templates.length > 0 && (
          <div
            role="radiogroup"
            aria-label="LCA report templates"
            className="space-y-2"
          >
            {templates.map((tpl) => {
              const isSelected = tpl.id === selectedId;
              return (
                <label
                  key={tpl.id}
                  htmlFor={`tpl-${tpl.id}`}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent/40'
                  }`}
                >
                  <input
                    id={`tpl-${tpl.id}`}
                    type="radio"
                    name="lca-template"
                    value={tpl.id}
                    checked={isSelected}
                    onChange={() => setSelectedId(tpl.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{tpl.name}</span>
                      {tpl.is_org_default && (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                          title="Organisation default"
                        >
                          <Star className="h-3 w-3 fill-current" />
                          default
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!selectedId || applying || loading}
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              'Apply template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
