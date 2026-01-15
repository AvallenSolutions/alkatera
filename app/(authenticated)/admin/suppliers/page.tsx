'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Building2, Globe, Mail, MapPin, MoveVertical as MoreVertical, CreditCard as Edit, Trash2, CircleCheck as CheckCircle, Circle as XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { COUNTRIES } from '@/lib/countries';
import { toast } from 'sonner';

interface PlatformSupplier {
  id: string;
  name: string;
  website: string | null;
  contact_email: string | null;
  contact_name: string | null;
  industry_sector: string | null;
  country: string | null;
  description: string | null;
  logo_url: string | null;
  is_verified: boolean;
  verification_date: string | null;
  created_at: string;
  updated_at: string;
}

interface SupplierFormData {
  name: string;
  website: string;
  contact_email: string;
  contact_name: string;
  industry_sector: string;
  country: string;
  description: string;
}

const INDUSTRY_SECTORS = [
  'Food & Beverage',
  'Packaging & Materials',
  'Logistics & Transportation',
  'Manufacturing',
  'Agriculture',
  'Energy & Utilities',
  'Chemicals',
  'Textiles',
  'Construction',
  'Technology',
  'Services',
  'Other',
];

const emptyForm: SupplierFormData = {
  name: '',
  website: '',
  contact_email: '',
  contact_name: '',
  industry_sector: '',
  country: '',
  description: '',
};

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<PlatformSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<PlatformSupplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<PlatformSupplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('platform_suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (supplier?: PlatformSupplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        website: supplier.website || '',
        contact_email: supplier.contact_email || '',
        contact_name: supplier.contact_name || '',
        industry_sector: supplier.industry_sector || '',
        country: supplier.country || '',
        description: supplier.description || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSupplier(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    try {
      setSaving(true);

      if (editingSupplier) {
        const { error } = await supabase
          .from('platform_suppliers')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSupplier.id);

        if (error) throw error;
        toast.success('Supplier updated successfully');
      } else {
        const { error } = await supabase
          .from('platform_suppliers')
          .insert([formData]);

        if (error) throw error;
        toast.success('Supplier created successfully');
      }

      await fetchSuppliers();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      if (error.code === '23505') {
        toast.error('A supplier with this name already exists');
      } else {
        toast.error('Failed to save supplier');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('platform_suppliers')
        .delete()
        .eq('id', supplierToDelete.id);

      if (error) throw error;

      toast.success('Supplier deleted successfully');
      await fetchSuppliers();
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      if (error.code === '23503') {
        toast.error('Cannot delete supplier that is used by organizations');
      } else {
        toast.error('Failed to delete supplier');
      }
    } finally {
      setDeleting(false);
    }
  };

  const toggleVerification = async (supplier: PlatformSupplier) => {
    try {
      const { error } = await supabase
        .from('platform_suppliers')
        .update({
          is_verified: !supplier.is_verified,
          verification_date: !supplier.is_verified ? new Date().toISOString() : null,
        })
        .eq('id', supplier.id);

      if (error) throw error;

      toast.success(
        supplier.is_verified ? 'Supplier unverified' : 'Supplier verified'
      );
      await fetchSuppliers();
    } catch (error) {
      console.error('Error toggling verification:', error);
      toast.error('Failed to update verification status');
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.industry_sector?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-600" />
            Platform Suppliers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage the global supplier directory visible to all organizations
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers by name, industry, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {suppliers.filter((s) => s.is_verified).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {suppliers.filter((s) => !s.is_verified).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No suppliers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{supplier.name}</CardTitle>
                      {supplier.is_verified && (
                        <Badge variant="default" className="bg-emerald-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {supplier.industry_sector && (
                        <span className="inline-flex items-center mr-3">
                          {supplier.industry_sector}
                        </span>
                      )}
                      {supplier.country && (
                        <span className="inline-flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {supplier.country}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(supplier)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleVerification(supplier)}>
                        {supplier.is_verified ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Unverify
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Verify
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSupplierToDelete(supplier);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              {(supplier.description || supplier.website || supplier.contact_name) && (
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm">
                    {supplier.description && (
                      <p className="text-muted-foreground">{supplier.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-muted-foreground">
                      {supplier.website && (
                        <a
                          href={supplier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center hover:text-foreground"
                        >
                          <Globe className="h-3 w-3 mr-1" />
                          Website
                        </a>
                      )}
                      {supplier.contact_name && (
                        <span className="inline-flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {supplier.contact_name}
                          {supplier.contact_email && ` (${supplier.contact_email})`}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? 'Update supplier information in the platform directory'
                : 'Add a new supplier to the platform directory visible to all organizations'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Supplier Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Acme Corp"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry_sector">Industry Sector</Label>
                <Select
                  value={formData.industry_sector}
                  onValueChange={(value) =>
                    setFormData({ ...formData, industry_sector: value })
                  }
                >
                  <SelectTrigger id="industry_sector">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_SECTORS.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.value} value={country.label}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_email: e.target.value })
                  }
                  placeholder="contact@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the supplier and their services..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Supplier'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{supplierToDelete?.name}</strong> from the platform
              directory. Organizations using this supplier will lose the connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Supplier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
