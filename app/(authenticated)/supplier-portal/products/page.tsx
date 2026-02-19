'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Pencil,
  Globe,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SupplierProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  unit_measurement: number | null;
  unit_measurement_type: string | null;
  carbon_intensity: number | null;
  product_code: string | null;
  is_active: boolean;
  is_verified: boolean;
  origin_country_code: string | null;
  created_at: string;
}

interface SupplierInfo {
  id: string;
  organization_id: string;
}

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [unitMeasurement, setUnitMeasurement] = useState('');
  const [unitMeasurementType, setUnitMeasurementType] = useState('');
  const [carbonIntensity, setCarbonIntensity] = useState('');
  const [productCode, setProductCode] = useState('');
  const [originCountryCode, setOriginCountryCode] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get supplier record
    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (supplierData) {
      setSupplier(supplierData);

      // Get supplier products
      const { data: productsData, error: productsError } = await supabase
        .from('supplier_products')
        .select('id, name, description, category, unit, unit_measurement, unit_measurement_type, carbon_intensity, product_code, is_active, is_verified, origin_country_code, created_at')
        .eq('supplier_id', supplierData.id)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Error loading products:', productsError);
      } else {
        setProducts(productsData || []);
      }
    }

    setLoading(false);
  }

  const resetForm = () => {
    setProductName('');
    setDescription('');
    setCategory('');
    setUnit('');
    setUnitMeasurement('');
    setUnitMeasurementType('');
    setCarbonIntensity('');
    setProductCode('');
    setOriginCountryCode('');
    setEditingProduct(null);
    setError(null);
    setSuccess(false);
  };

  const openNewProduct = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditProduct = (product: SupplierProduct) => {
    setEditingProduct(product);
    setProductName(product.name);
    setDescription(product.description || '');
    setCategory(product.category || '');
    setUnit(product.unit);
    setUnitMeasurement(product.unit_measurement?.toString() || '');
    setUnitMeasurementType(product.unit_measurement_type || '');
    setCarbonIntensity(product.carbon_intensity?.toString() || '');
    setProductCode(product.product_code || '');
    setOriginCountryCode(product.origin_country_code || '');
    setError(null);
    setSuccess(false);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
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

      const productData: any = {
        supplier_id: supplier.id,
        organization_id: supplier.organization_id,
        name: productName.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        unit: unit.trim(),
        unit_measurement: unitMeasurement ? parseFloat(unitMeasurement) : null,
        unit_measurement_type: unitMeasurementType || null,
        carbon_intensity: carbonIntensity ? parseFloat(carbonIntensity) : null,
        product_code: productCode.trim() || null,
        origin_country_code: originCountryCode.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('supplier_products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('supplier_products')
          .insert(productData);

        if (insertError) throw insertError;
      }

      setSuccess(true);
      await loadData();
      setTimeout(() => {
        setModalOpen(false);
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog with verified environmental data.
          </p>
        </div>
        <Button onClick={openNewProduct} disabled={!supplier}>
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
          <Button onClick={openNewProduct}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Product
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-5 rounded-xl border border-border bg-card hover:border-border/80 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-purple-500/10">
                  <Package className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{product.name}</p>
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
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {product.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {product.category}
                      </span>
                    )}
                    <span>Unit: {product.unit}</span>
                    {product.carbon_intensity !== null && (
                      <span>{product.carbon_intensity} kg CO2e/{product.unit}</span>
                    )}
                    {product.origin_country_code && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {product.origin_country_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditProduct(product)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Product Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update your product information and environmental data.'
                : 'Add a new product to your catalog with environmental data.'}
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-8 flex flex-col items-center justify-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">
                  Product {editingProduct ? 'Updated' : 'Added'}!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your product has been {editingProduct ? 'updated' : 'added'} successfully.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 py-2">
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">Description</Label>
                <Textarea
                  id="product-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this product..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-category">Category</Label>
                  <Input
                    id="product-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Grain"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-code">Product Code / SKU</Label>
                  <Input
                    id="product-code"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="e.g., BM-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                  <Label htmlFor="unit-measurement">Measurement</Label>
                  <Input
                    id="unit-measurement"
                    type="number"
                    step="any"
                    value={unitMeasurement}
                    onChange={(e) => setUnitMeasurement(e.target.value)}
                    placeholder="e.g., 25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurement-type">Type</Label>
                  <select
                    id="measurement-type"
                    value={unitMeasurementType}
                    onChange={(e) => setUnitMeasurementType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select...</option>
                    <option value="weight">Weight</option>
                    <option value="volume">Volume</option>
                    <option value="length">Length</option>
                    <option value="area">Area</option>
                    <option value="count">Count</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="carbon-intensity">
                    Carbon Intensity (kg CO2e/unit)
                  </Label>
                  <Input
                    id="carbon-intensity"
                    type="number"
                    step="any"
                    min="0"
                    value={carbonIntensity}
                    onChange={(e) => setCarbonIntensity(e.target.value)}
                    placeholder="e.g., 0.35"
                  />
                  <p className="text-xs text-muted-foreground">
                    Carbon footprint per unit of product
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="origin-country">Origin Country Code</Label>
                  <Input
                    id="origin-country"
                    value={originCountryCode}
                    onChange={(e) => setOriginCountryCode(e.target.value)}
                    placeholder="e.g., GB"
                    maxLength={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    ISO country code (e.g., GB, US, DE)
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
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
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
