"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, MoreVertical, Pencil, Trash2, FileBarChart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";
import { fetchProducts, deleteProduct } from "@/lib/products";
import { createDraftLca } from "@/lib/lca";
import type { Product } from "@/lib/types/products";

export default function ProductsPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingLca, setIsCreatingLca] = useState(false);

  useEffect(() => {
    if (organizationId) {
      loadProducts();
    }
  }, [organizationId]);

  const loadProducts = async () => {
    if (!organizationId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchProducts(organizationId);
      setProducts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load products";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
      setIsDeleting(true);
      await deleteProduct(productToDelete.id);
      toast.success(`Product "${productToDelete.name}" deleted successfully`);
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete product";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateLca = async (product: Product) => {
    if (!organizationId) return;

    try {
      setIsCreatingLca(true);
      const result = await createDraftLca(product.id, organizationId);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(`LCA created for "${product.name}"`);
      router.push(`/dashboard/lcas/${result.lcaId}/create/sourcing`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create LCA";
      toast.error(errorMessage);
    } finally {
      setIsCreatingLca(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Please select an organisation to view products.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-2">
            Manage your product catalogue
          </p>
        </div>
        <Link href="/dashboard/products/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add New Product
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>
            {products.length} product{products.length !== 1 ? "s" : ""} in your catalogue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No products found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add New Product" to create your first product.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Unit Size</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku || "-"}</TableCell>
                    <TableCell>
                      {product.unit_size_value && product.unit_size_unit
                        ? `${product.unit_size_value} ${product.unit_size_unit}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleCreateLca(product)}
                            disabled={isCreatingLca}
                          >
                            <FileBarChart className="mr-2 h-4 w-4" />
                            Create New LCA
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/products/${product.id}/edit`)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(product)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the product "{productToDelete?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
