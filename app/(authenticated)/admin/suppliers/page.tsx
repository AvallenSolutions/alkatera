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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Building2, Mail, MapPin, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { COUNTRIES } from '@/lib/countries';
import { toast } from 'sonner';
import Link from 'next/link';

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
  const [editingSupplier, setEditingSupplier] = useState<PlatformSupplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

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
        const { error } = await (supabase
          .from('platform_suppliers') as any)
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSupplier.id);

        if (error) throw error;
        toast.success('Supplier updated successfully');
      } else {
        const { error } = await (supabase
          .from('platform_suppliers') as any)
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
            <Link key={supplier.id} href={`/admin/suppliers/${supplier.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{supplier.name}</CardTitle>
                        {supplier.is_verified && (
                          <Badge variant="default" className="bg-emerald-600">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {supplier.contact_email && (
                          <span className="inline-flex items-center mr-3">
                            <Mail className="h-3 w-3 mr-1" />
                            {supplier.contact_email}
                          </span>
                        )}
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
                    <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
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

    </div>
  );
}
