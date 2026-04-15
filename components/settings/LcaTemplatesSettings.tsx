'use client';

/**
 * LCA report templates settings panel.
 *
 * Org-scoped list of reusable wizard configurations. The org default (if
 * any) is pinned at the top with a star badge and auto-applies when the
 * wizard opens on a product with no prior last_wizard_settings.
 *
 * Editing the settings blob itself is intentionally NOT available here:
 * that would bypass the wizard's conditional-step validation (e.g. picking
 * cradle-to-grave without a use-phase config). To change settings, apply
 * the template in the wizard, edit, and save over it with the same name.
 *
 * All writes go through the /api/lca-templates routes which enforce
 * admin/owner on writes and return 409 on duplicate names.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast as sonnerToast } from 'sonner';
import { Loader2, Star, Pencil, Trash2, StarOff } from 'lucide-react';
import { format } from 'date-fns';
import { useOrganization } from '@/lib/organizationContext';
import { LcaTemplateEditorDialog } from './LcaTemplateEditorDialog';
import type { LcaReportTemplate } from '@/types/lca-templates';

interface LcaTemplatesSettingsProps {
  showHeader?: boolean;
}

export function LcaTemplatesSettings({
  showHeader = true,
}: LcaTemplatesSettingsProps) {
  const { currentOrganization, userRole } = useOrganization();

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const [templates, setTemplates] = useState<LcaReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dialog / destructive-confirm state
  const [editingTemplate, setEditingTemplate] =
    useState<LcaReportTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] =
    useState<LcaReportTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/lca-templates?organizationId=${encodeURIComponent(currentOrganization.id)}`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load templates');
      }
      setTemplates((json?.templates ?? []) as LcaReportTemplate[]);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load templates';
      setLoadError(msg);
      sonnerToast.error('Failed to load LCA templates', { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  async function handleSetDefault(template: LcaReportTemplate) {
    if (!isAdmin || template.is_org_default) return;
    setSettingDefaultId(template.id);
    try {
      const res = await fetch(
        `/api/lca-templates/${template.id}/set-default`,
        { method: 'POST' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to set default');
      }
      sonnerToast.success(`"${template.name}" is now the organisation default`, {
        description:
          'New products with no prior LCA settings will prefill from this template.',
      });
      fetchTemplates();
    } catch (err: any) {
      sonnerToast.error('Failed to set default', {
        description: err?.message || 'Please try again.',
      });
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete() {
    if (!templateToDelete || !isAdmin) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/lca-templates/${templateToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to delete template');
      }
      sonnerToast.success(`Template "${templateToDelete.name}" deleted`);
      setTemplateToDelete(null);
      fetchTemplates();
    } catch (err: any) {
      sonnerToast.error('Failed to delete template', {
        description: err?.message || 'Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            LCA report templates
          </CardTitle>
          <CardDescription>
            Reusable Goal &amp; Scope configurations for the LCA wizard. The
            organisation default auto-applies when a product has no prior LCA
            settings, eliminating drift between runs. Functional unit is
            product-specific and is never part of a template.
          </CardDescription>
        </CardHeader>
      )}

      <CardContent className={showHeader ? '' : 'pt-6'}>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="text-center py-10">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchTemplates}
            >
              Retry
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm font-medium">No LCA templates yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Open the LCA wizard on any product, configure the Goal &amp;
              Scope step, and click &ldquo;Save as template&rdquo; to create
              one your whole organisation can reuse.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="w-[120px]">Default</TableHead>
                  <TableHead className="hidden lg:table-cell w-[140px]">
                    Last updated
                  </TableHead>
                  <TableHead className="text-right w-[200px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const isCurrentDefault = template.is_org_default;
                  const settingDefaultBusy =
                    settingDefaultId === template.id;
                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isCurrentDefault && (
                            <Star
                              className="h-4 w-4 fill-amber-500 text-amber-500 shrink-0"
                              aria-label="Organisation default"
                            />
                          )}
                          <span className="truncate">{template.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {template.description || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isCurrentDefault ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <Star className="h-3 w-3 fill-current" />
                            Org default
                          </span>
                        ) : isAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(template)}
                            disabled={settingDefaultBusy}
                          >
                            {settingDefaultBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <StarOff className="h-3 w-3 mr-1" />
                                Set default
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {format(new Date(template.updated_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTemplate(template)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            {isAdmin ? 'Edit' : 'View'}
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTemplateToDelete(template)}
                              title="Delete template"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit / view dialog */}
      <LcaTemplateEditorDialog
        open={editingTemplate !== null}
        onOpenChange={(next) => {
          if (!next) setEditingTemplate(null);
        }}
        template={editingTemplate}
        canEdit={isAdmin}
        onSaved={fetchTemplates}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={templateToDelete !== null}
        onOpenChange={(next) => {
          if (!next) setTemplateToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete LCA template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{templateToDelete?.name}</strong>? Products that
              previously had this template applied keep their own
              per-product settings, so past LCA reports are unaffected.
              {templateToDelete?.is_org_default ? (
                <>
                  {' '}
                  <strong>This is the current organisation default</strong>
                  , so after deletion new products with no prior LCA
                  settings will open the wizard with blank defaults until
                  another template is marked as default.
                </>
              ) : (
                ' New products will continue to fall back to the organisation default (if any) or blank defaults.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete template'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
