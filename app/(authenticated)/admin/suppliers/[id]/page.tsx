'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  MapPin,
  Package,
  Shield,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  Wheat,
  Box,
  Cloud,
  Droplets,
  Leaf,
  Recycle,
  ExternalLink,
  User,
  Calendar,
  ChevronRight,
} from 'lucide-react';
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
}

interface LinkedSupplier {
  id: string;
  name: string;
  contact_email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  country_code: string | null;
  website: string | null;
  created_at: string;
}

interface SupplierProduct {
  id: string;
  name: string;
  description: string | null;
  product_type: string;
  packaging_category: string | null;
  unit: string;
  product_code: string | null;
  product_image_url: string | null;
  impact_climate: number | null;
  impact_water: number | null;
  impact_land: number | null;
  impact_waste: number | null;
  carbon_intensity: number | null;
  recycled_content_pct: number | null;
  weight_g: number | null;
  is_active: boolean;
  is_verified: boolean;
  verified_at: string | null;
  certifications: string[] | null;
  created_at: string;
}

export default function AdminSupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params?.id as string;

  const [platformSupplier, setPlatformSupplier] = useState<PlatformSupplier | null>(null);
  const [linkedSupplier, setLinkedSupplier] = useState<LinkedSupplier | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (supplierId) loadData();
  }, [supplierId]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch the platform supplier record directly
      const { data: ps, error: psError } = await supabase
        .from('platform_suppliers')
        .select('*')
        .eq('id', supplierId)
        .maybeSingle();

      if (psError) throw psError;
      if (!ps) {
        toast.error('Supplier not found');
        router.push('/admin/suppliers');
        return;
      }
      setPlatformSupplier(ps);

      // Fetch linked supplier data and products via service-role API
      const authClient = getSupabaseBrowserClient();
      const { data: sessionData } = await authClient.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (token) {
        const res = await fetch('/api/admin/suppliers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ platform_supplier_id: supplierId }),
        });

        if (res.ok) {
          const data = await res.json();
          setLinkedSupplier(data.supplier || null);
          setProducts(data.products || []);
        }
      }
    } catch (err) {
      console.error('Error loading supplier detail:', err);
      toast.error('Failed to load supplier details');
    } finally {
      setLoading(false);
    }
  }

  const toggleVerification = async () => {
    if (!platformSupplier) return;
    try {
      const { error } = await (supabase.from('platform_suppliers') as any)
        .update({
          is_verified: !platformSupplier.is_verified,
          verification_date: !platformSupplier.is_verified ? new Date().toISOString() : null,
        })
        .eq('id', platformSupplier.id);

      if (error) throw error;
      toast.success(platformSupplier.is_verified ? 'Supplier unverified' : 'Supplier verified');
      setPlatformSupplier(prev => prev ? { ...prev, is_verified: !prev.is_verified } : prev);
    } catch (error) {
      console.error('Error toggling verification:', error);
      toast.error('Failed to update verification status');
    }
  };

  const handleDelete = async () => {
    if (!platformSupplier) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('platform_suppliers')
        .delete()
        .eq('id', platformSupplier.id);

      if (error) throw error;
      toast.success('Supplier deleted successfully');
      router.push('/admin/suppliers');
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      if (error.code === '23503') {
        toast.error('Cannot delete supplier that is used by organisations');
      } else {
        toast.error('Failed to delete supplier');
      }
      setDeleting(false);
    }
  };

  const formatImpact = (val: number | null, unit: string) => {
    if (val == null) return null;
    return `${val < 0.01 ? val.toExponential(2) : val.toFixed(4)} ${unit}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!platformSupplier) return null;

  const activeProducts = products.filter(p => p.is_active);
  const inactiveProducts = products.filter(p => !p.is_active);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/suppliers')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Suppliers
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-2xl font-bold tracking-tight">{platformSupplier.name}</h1>
          {platformSupplier.is_verified && (
            <Badge variant="default" className="bg-emerald-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleVerification}>
            <Shield className="h-4 w-4 mr-2" />
            {platformSupplier.is_verified ? 'Unverify' : 'Verify'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Supplier Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Platform Supplier Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Platform Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {platformSupplier.industry_sector && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>{platformSupplier.industry_sector}</span>
              </div>
            )}
            {platformSupplier.country && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{platformSupplier.country}</span>
              </div>
            )}
            {platformSupplier.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a href={platformSupplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  {platformSupplier.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {platformSupplier.contact_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{platformSupplier.contact_name}</span>
              </div>
            )}
            {platformSupplier.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${platformSupplier.contact_email}`} className="text-primary hover:underline">
                  {platformSupplier.contact_email}
                </a>
              </div>
            )}
            {platformSupplier.description && (
              <p className="text-muted-foreground mt-2 pt-2 border-t">{platformSupplier.description}</p>
            )}
            <div className="flex items-center gap-2 text-muted-foreground pt-2 border-t">
              <Calendar className="h-4 w-4" />
              <span>Added {new Date(platformSupplier.created_at).toLocaleDateString('en-GB')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Linked Supplier Account */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Supplier Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkedSupplier ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{linkedSupplier.name}</span>
                  <Badge variant="default" className="bg-emerald-600 text-xs">Active</Badge>
                </div>
                {linkedSupplier.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{linkedSupplier.contact_email}</span>
                  </div>
                )}
                {(linkedSupplier.address || linkedSupplier.city || linkedSupplier.country) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[linkedSupplier.address, linkedSupplier.city, linkedSupplier.country]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground pt-2 border-t">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {new Date(linkedSupplier.created_at).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Supplier has not yet created an account</p>
                <p className="text-xs mt-1">They will appear here once they sign up and link via email</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Supplier Products ({products.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!linkedSupplier ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No products available</p>
              <p className="text-sm mt-1">Products will appear here once the supplier creates an account and adds them</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No products added yet</p>
              <p className="text-sm mt-1">The supplier has not added any products to their catalogue</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeProducts.map(product => (
                <ProductRow key={product.id} product={product} supplierId={supplierId} formatImpact={formatImpact} />
              ))}
              {inactiveProducts.length > 0 && (
                <>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-muted-foreground mb-2">Inactive ({inactiveProducts.length})</p>
                  </div>
                  {inactiveProducts.map(product => (
                    <ProductRow key={product.id} product={product} supplierId={supplierId} formatImpact={formatImpact} inactive />
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{platformSupplier.name}</strong> from the platform directory.
              Organisations using this supplier will lose the connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Supplier'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductRow({
  product,
  supplierId,
  formatImpact,
  inactive,
}: {
  product: SupplierProduct;
  supplierId: string;
  formatImpact: (val: number | null, unit: string) => string | null;
  inactive?: boolean;
}) {
  const climate = formatImpact(product.impact_climate ?? product.carbon_intensity, `kg CO₂e/${product.unit}`);
  const water = formatImpact(product.impact_water, `L/${product.unit}`);
  const land = formatImpact(product.impact_land, `m²/${product.unit}`);
  const waste = formatImpact(product.impact_waste, `kg/${product.unit}`);

  return (
    <Link href={`/admin/suppliers/${supplierId}/products/${product.id}`}>
    <div className={`flex items-center gap-4 p-3 rounded-lg border hover:border-primary/40 transition-colors cursor-pointer ${inactive ? 'opacity-50' : 'bg-card'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {product.product_type === 'packaging' ? (
            <Box className="h-4 w-4 text-purple-400 shrink-0" />
          ) : (
            <Wheat className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <span className="font-medium truncate">{product.name}</span>
          {product.product_code && (
            <Badge variant="outline" className="text-xs shrink-0">{product.product_code}</Badge>
          )}
          {product.is_verified && (
            <Badge variant="default" className="bg-emerald-600 text-xs shrink-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
          {!product.is_active && (
            <Badge variant="secondary" className="text-xs shrink-0">Inactive</Badge>
          )}
          {product.packaging_category && (
            <Badge variant="outline" className="text-xs shrink-0 capitalize">{product.packaging_category}</Badge>
          )}
        </div>
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{product.description}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs">
          {climate && (
            <span className="inline-flex items-center gap-1 text-blue-400">
              <Cloud className="h-3 w-3" /> {climate}
            </span>
          )}
          {water && (
            <span className="inline-flex items-center gap-1 text-cyan-400">
              <Droplets className="h-3 w-3" /> {water}
            </span>
          )}
          {land && (
            <span className="inline-flex items-center gap-1 text-green-400">
              <Leaf className="h-3 w-3" /> {land}
            </span>
          )}
          {waste && (
            <span className="inline-flex items-center gap-1 text-orange-400">
              <Recycle className="h-3 w-3" /> {waste}
            </span>
          )}
          {product.weight_g != null && (
            <span className="text-muted-foreground">{product.weight_g}g</span>
          )}
          {product.certifications && product.certifications.length > 0 && (
            <span className="text-muted-foreground">
              {product.certifications.length} cert{product.certifications.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
    </Link>
  );
}
