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
import { PillButton } from '@/components/studio/pill-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Star } from 'lucide-react';
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
  /**
   * When true and the org has zero templates, the dialog silently closes
   * itself instead of showing the "No templates yet" empty state. Used by
   * the auto-open path (new product, no prior settings) so brand-new orgs
   * aren't pestered. Manual opens from the GoalStep "Apply template" button
   * pass `false` so the user sees the empty state and understands why
   * nothing happened.
   */
  autoDismissOnEmpty?: boolean;
}

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  organizationId,
  autoDismissOnEmpty = false,
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
        // Auto-dismiss when there's nothing to pick and this was an auto-
        // opened prompt. Avoids showing an empty prompt to brand-new orgs
        // who've never saved a template. Manual opens (GoalStep button)
        // pass autoDismissOnEmpty=false so the "No templates yet" empty
        // state shows and the user understands why clicking did nothing.
        if (list.length === 0 && autoDismissOnEmpty) {
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
  }, [open, organizationId, autoDismissOnEmpty, onOpenChange]);

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
          <p className="py-8 text-center text-sm text-studio-dim">
            Loading templates
          </p>
        )}

        {!loading && error && (
          <p className="text-sm text-foreground">
            <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-stale">
              Error
            </span>
            {error}
          </p>
        )}

        {!loading && !error && templates.length === 0 && (
          <p className="border-y border-studio-hairline py-6 text-center text-sm text-studio-dim">
            No templates yet. Use &ldquo;Save as template&rdquo; on a finished
            wizard to create one your whole organisation can reuse.
          </p>
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
                  className={`flex cursor-pointer items-start gap-3 rounded-[6px] border p-3 transition-colors duration-150 ease-studio ${
                    isSelected
                      ? 'border-room-accent bg-studio-cream'
                      : 'border-studio-hairline hover:border-studio-ink/40'
                  }`}
                >
                  <input
                    id={`tpl-${tpl.id}`}
                    type="radio"
                    name="lca-template"
                    value={tpl.id}
                    checked={isSelected}
                    onChange={() => setSelectedId(tpl.id)}
                    className="mt-1 accent-room-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display font-semibold text-foreground">{tpl.name}</span>
                      {tpl.is_org_default && (
                        <span
                          className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention"
                          title="Organisation default"
                        >
                          <Star className="h-3 w-3 fill-current" />
                          Default
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-studio-dim">
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
          <PillButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            Cancel
          </PillButton>
          <PillButton
            type="button"
            variant="room"
            onClick={handleApply}
            disabled={!selectedId || applying || loading}
          >
            {applying ? 'Applying' : 'Apply template'}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
