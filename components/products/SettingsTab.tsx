"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eyebrow } from "@/components/studio/eyebrow";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";

interface SettingsTabProps {
  productName: string;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function SettingsTab({ productName, onArchive, onDelete }: SettingsTabProps) {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await onArchive();
      setShowArchiveDialog(false);
    } catch (error) {
      console.error("Archive error:", error);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-10">
      <div className="flex items-center gap-3">
        <Eyebrow>Settings</Eyebrow>
        <StateChip tone="attention">Careful</StateChip>
      </div>

      {/* Archive Product */}
      <section className="border-t border-border pt-5">
        <Eyebrow className="mb-1">Archive product</Eyebrow>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Archived products are hidden from lists and reports but can be restored at any time.
          All calculation history and material data is preserved.
        </p>
        <PillButton variant="outline" onClick={() => setShowArchiveDialog(true)}>
          Archive product
        </PillButton>
      </section>

      {/* Delete Product */}
      <section className="border-t border-border pt-5">
        <div className="mb-1 flex items-center gap-3">
          <Eyebrow tone="dim">Delete product</Eyebrow>
          <StateChip tone="stale">Permanent</StateChip>
        </div>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          This permanently removes the product, all ingredients, packaging, and calculation history.
          This cannot be undone.
        </p>
        <PillButton
          variant="ghost"
          className="text-studio-stale hover:text-studio-stale"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete product
        </PillButton>
      </section>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &quot;{productName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This product will be hidden from active listings but can be restored at any time.
              All data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive product'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{productName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product and all associated
              ingredients, packaging, and calculation history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-studio-stale text-studio-cream hover:bg-studio-stale/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete product'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
