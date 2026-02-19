'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Package,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Globe,
  Tag,
  Cloud,
  Droplets,
  Recycle,
  Leaf,
  FileText,
  ImageIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SupplierProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  carbon_intensity: number | null;
  impact_climate: number | null;
  impact_water: number | null;
  impact_waste: number | null;
  impact_land: number | null;
  recycled_content_pct: number | null;
  product_code: string | null;
  product_image_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  origin_country_code: string | null;
  certifications: string[] | null;
  created_at: string;
}

interface SupplierInfo {
  id: string;
  organization_id: string;
}

export default function SupplierProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple "Add Product" form state
  const [productName, setProductName] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (supplierData) {
      setSupplier(supplierData);

      const { data: productsData, error: productsError } = await supabase
        .from('supplier_products')
        .select('id, name, description, category, unit, carbon_intensity, impact_climate, impact_water, impact_waste, impact_land, recycled_content_pct, product_code, product_image_url, is_active, is_verified, origin_country_code, certifications, created_at')
        .eq('supplier_id', supplierData.id)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Error loading products:', productsError);
        setError('Failed to load products');
      } else {
        setProducts(productsData || []);
      }
    }

    setLoading(false);
  }

  const resetForm = () => {
    setProductName('');
    setUnit('');
    setCategory('');
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;

    if (!productName.trim() || !unit.trim()) {
      setError('Product name and unit are required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data: newProduct, error: insertError } = await supabase
        .from('supplier_products')
        .insert({
          supplier_id: supplier.id,
          organization_id: supplier.organization_id,
          name: productName.trim(),
          unit: unit.trim(),
          category: category.trim() || null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Redirect to detail page to complete data entry
      router.push(`/supplier-portal/products/${newProduct.id}`);
    } catch (err: any) {
      console.error('Error creating product:', err);
      setError(err.message || 'Failed to create product');
      setSaving(false);
    }
  };

  const getPillarBadges = (product: SupplierProduct) => {
    const climate = product.impact_climate ?? product.carbon_intensity;
    const badges = [];
    if (climate !== null) badges.push({ icon: Cloud, color: 'text-blue-400 bg-blue-500/10', label: 'Climate' });
    if (product.impact_water !== null) badges.push({ icon: Droplets, color: 'text-cyan-400 bg-cyan-500/10', label: 'Water' });
    if (product.impact_waste !== null || product.recycled_content_pct !== null) badges.push({ icon: Recycle, color: 'text-amber-400 bg-amber-500/10', label: 'Circularity' });
    if (product.impact_land !== null) badges.push({ icon: Leaf, color: 'text-green-400 bg-green-500/10', label: 'Nature' });
    return badges;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="h-4 w-72 bg-muted rounded" />
          </div>
          <div className="h-10 w-32 bg-muted rounded" />
        </div>
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card">
              <div className="w-12 h-12 bg-muted rounded-lg" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-40 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog with environmental data, evidence, and certifications.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} disabled={!supplier}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {!supplier ? (
        <div className="py-16 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Profile Required</h2>
          <p className="text-muted-foreground">
            Please complete your company profile before adding products.
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No Products Yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Add your products with environmental data so your customers can use verified data in their sustainability assessments.
          </p>
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Product
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {products.map((product) => {
            const pillarBadges = getPillarBadges(product);
            return (
              <button
                key={product.id}
                onClick={() => router.push(`/supplier-portal/products/${product.id}`)}
                className="flex items-center justify-between p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-card/80 transition-colors text-left w-full group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {product.product_image_url ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                      <img src={product.product_image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-purple-500/10 flex-shrink-0">
                      <Package className="h-5 w-5 text-purple-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{product.name}</p>
                      {product.is_verified && (
                        <Badge variant="default" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {!product.is_active && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {product.category && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Tag className="h-3 w-3" />
                          {product.category}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">Unit: {product.unit}</span>
                      {product.origin_country_code && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          {product.origin_country_code}
                        </span>
                      )}
                      {/* Pillar coverage indicators */}
                      {pillarBadges.length > 0 && (
                        <div className="flex items-center gap-1">
                          {pillarBadges.map((badge) => (
                            <div key={badge.label} className={`p-1 rounded ${badge.color}`} title={badge.label}>
                              <badge.icon className="h-3 w-3" />
                            </div>
                          ))}
                        </div>
                      )}
                      {product.certifications && product.certifications.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {product.certifications.length} cert{product.certifications.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[#ccff00] transition-colors flex-shrink-0 ml-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* Add Product Dialog — basic fields only, then redirect to detail page */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Add Product
            </DialogTitle>
            <DialogDescription>
              Create a product, then add environmental data, evidence, and certifications on the detail page.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-2">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="product-name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Organic Barley Malt"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-unit">
                  Unit <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="product-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g., kg"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <Input
                  id="product-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Grain"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setModalOpen(false); resetForm(); }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Continue'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
