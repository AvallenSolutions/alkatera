'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export interface SkuRow {
  id: string;
  product_name: string;
  sku_code: string | null;
  gtin: string | null;
  category: string | null;
  country_of_origin: string | null;
  listing_status: 'active' | 'delisted';
}

export function SkuRowActions({ brandId, sku }: { brandId: string; sku: SkuRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [productName, setProductName] = useState(sku.product_name);
  const [skuCode, setSkuCode] = useState(sku.sku_code ?? '');
  const [gtin, setGtin] = useState(sku.gtin ?? '');
  const [category, setCategory] = useState(sku.category ?? '');
  const [country, setCountry] = useState(sku.country_of_origin ?? '');
  const [status, setStatus] = useState<'active' | 'delisted'>(sku.listing_status);

  const base = `/api/distributor/brands/${brandId}/products/${sku.id}`;

  async function saveEdit() {
    if (!productName.trim()) {
      toast.error('Product name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName.trim(),
          sku_code: skuCode.trim() || null,
          gtin: gtin.trim() || null,
          category: category.trim() || null,
          country_of_origin: country.trim() || null,
          listing_status: status,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Could not save: ${j.error ?? res.status}`);
        return;
      }
      toast.success('Product updated');
      setEditOpen(false);
      router.refresh();
    } catch {
      toast.error('Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(base, { method: 'DELETE' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Could not delete: ${j.error ?? res.status}`);
        setDeleting(false);
        return;
      }
      toast.success('Product deleted');
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error('Could not delete product');
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Product actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit product
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete product
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="sku-name">Product name</Label>
              <Input id="sku-name" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sku-code">SKU code</Label>
                <Input id="sku-code" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku-gtin">GTIN / barcode</Label>
                <Input id="sku-gtin" value={gtin} onChange={(e) => setGtin(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku-category">Category</Label>
                <Input id="sku-category" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku-country">Country of origin</Label>
                <Input id="sku-country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Listing status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'delisted')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="delisted">Delisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-sky-400 hover:bg-sky-300 text-black">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{sku.product_name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product from your portfolio. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
