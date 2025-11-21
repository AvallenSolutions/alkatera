"use client";

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

interface MaterialUpdatePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MaterialUpdatePrompt({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: MaterialUpdatePromptProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Master Product Profile?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              You've changed the materials for this LCA calculation. Would you also like to
              update the master product profile to use these materials for future LCAs?
            </p>
            <p className="text-sm font-medium">
              This will replace the current master materials template with the materials
              from this calculation.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            No, only this calculation
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Yes, update master template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
