"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Edit, Boxes, Trash2, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct } from "@/lib/products";

interface ProductActionsProps {
  productId: string;
  productName: string;
  organizationId: string;
}

export function ProductActions({
  productId,
  productName,
  organizationId,
}: ProductActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteProduct(productId);
      toast.success(`Product "${productName}" deleted successfully`);
      router.push("/products");
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error(error.message || "Failed to delete product");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage this product</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href={`/products/${productId}/hub`} className="block">
            <Button className="w-full">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Product Hub
            </Button>
          </Link>

          <Link href={`/dashboard/products/${productId}/edit`} className="block">
            <Button variant="outline" className="w-full">
              <Edit className="mr-2 h-4 w-4" />
              Edit Product
            </Button>
          </Link>

          <Link href={`/products/${productId}/materials`} className="block">
            <Button variant="outline" className="w-full">
              <Boxes className="mr-2 h-4 w-4" />
              Manage Materials
            </Button>
          </Link>

          <Button
            variant="outline"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Product
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productName}"? This action cannot be undone.
              All associated LCA calculations and materials will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
