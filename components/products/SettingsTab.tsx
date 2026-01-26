"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Archive, Trash2, AlertTriangle } from "lucide-react";

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
    <div className="space-y-6 max-w-3xl">
      <Alert className="backdrop-blur-xl bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-sm text-amber-200">
          <strong>Danger Zone:</strong> These actions cannot be easily undone. Please proceed with caution.
        </AlertDescription>
      </Alert>

      {/* Archive Product */}
      <Card className="backdrop-blur-xl bg-white/5 border border-amber-500/30 shadow-xl hover:bg-white/10 transition-all">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
              <Archive className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-amber-100">Archive Product</CardTitle>
              <CardDescription className="text-slate-400">
                Remove this product from active listings whilst preserving all data
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Archived products are hidden from lists and reports but can be restored at any time.
              All calculation history and material data will be preserved.
            </p>
            <Button
              variant="outline"
              className="backdrop-blur-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              onClick={() => setShowArchiveDialog(true)}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive Product
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Product */}
      <Card className="backdrop-blur-xl bg-white/5 border border-red-500/30 shadow-xl hover:bg-white/10 transition-all">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/20">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-red-100">Delete Product</CardTitle>
              <CardDescription className="text-slate-400">
                Permanently delete this product and all associated data
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              This action permanently removes the product, all ingredients, packaging, and calculation history.
              <strong className="text-red-400"> This cannot be undone.</strong>
            </p>
            <Button
              variant="destructive"
              className="bg-red-500/80 hover:bg-red-500 text-white"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Product
            </Button>
          </div>
        </CardContent>
      </Card>

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
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isArchiving ? 'Archiving...' : 'Archive Product'}
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
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Product'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
