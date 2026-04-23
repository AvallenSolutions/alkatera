'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupplierProductEvidenceTab } from '@/components/suppliers/SupplierProductEvidenceTab';
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  Package,
  Cloud,
  Droplets,
  Recycle,
  Leaf,
  Upload,
  X,
  Plus,
  AlertCircle,
  ImageIcon,
  FileText,
  Shield,
  Trash2,
  Wheat,
  Box,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SupplierProductType, PackagingCategoryType, EPRMaterialCode, SupplierProductComponent } from '@/lib/types/supplier-product';
import {
  PACKAGING_CATEGORY_LABELS,
  EPR_MATERIAL_CODE_LABELS,
  PRIMARY_MATERIAL_OPTIONS,
  EPR_COMPONENT_MATERIAL_OPTIONS,
} from '@/lib/types/supplier-product';

const COMMON_CERTIFICATIONS = [
  'Organic',
  'Fairtrade',
  'Rainforest Alliance',
  'FSC',
  'MSC',
  'B Corp',
  'Carbon Trust',
  'ISO 14001',
  'ISO 14044',
  'ISO 14067',
  'UTZ',
  'RSPO',
  'PEFC',
  'Cradle to Cradle',
  'EU Ecolabel',
  'Soil Association',
];

const END_OF_LIFE_OPTIONS = [
  { value: 'recycling', label: 'Recycling' },
  { value: 'composting', label: 'Composting' },
  { value: 'reuse', label: 'Reuse' },
  { value: 'incineration_with_recovery', label: 'Incineration (Energy Recovery)' },
  { value: 'incineration', label: 'Incineration' },
  { value: 'anaerobic_digestion', label: 'Anaerobic Digestion' },
  { value: 'landfill', label: 'Landfill' },
  { value: 'other', label: 'Other' },
];

interface SupplierInfo {
  id: string;
  organization_id: string;
}

export default function SupplierProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [productCode, setProductCode] = useState('');
  const [unit, setUnit] = useState('');
  const [unitMeasurement, setUnitMeasurement] = useState('');
  const [unitMeasurementType, setUnitMeasurementType] = useState('');
  const [originCountryCode, setOriginCountryCode] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');

  // Product type & packaging-specific fields
  const [productType, setProductType] = useState<SupplierProductType>('ingredient');
  const [weightG, setWeightG] = useState('');
  const [packagingCategory, setPackagingCategory] = useState<PackagingCategoryType | ''>('');
  const [primaryMaterial, setPrimaryMaterial] = useState('');
  const [eprMaterialCode, setEprMaterialCode] = useState<EPRMaterialCode | ''>('');
  const [eprIsDrinksContainer, setEprIsDrinksContainer] = useState(false);

  // Material composition components (packaging only)
  const [components, setComponents] = useState<SupplierProductComponent[]>([]);
  const [savingComponents, setSavingComponents] = useState(false);

  // Climate
  const [impactClimate, setImpactClimate] = useState('');
  const [carbonIntensity, setCarbonIntensity] = useState('');

  // Water
  const [impactWater, setImpactWater] = useState('');
  const [waterBlue, setWaterBlue] = useState('');
  const [waterGreen, setWaterGreen] = useState('');
  const [waterGrey, setWaterGrey] = useState('');

  // Circularity
  const [impactWaste, setImpactWaste] = useState('');
  const [recycledContentPct, setRecycledContentPct] = useState('');
  const [recyclabilityPct, setRecyclabilityPct] = useState('');
  const [endOfLifePathway, setEndOfLifePathway] = useState('');

  // Nature
  const [impactLand, setImpactLand] = useState('');

  // Certifications
  const [certifications, setCertifications] = useState<string[]>([]);
  const [customCert, setCustomCert] = useState('');

  useEffect(() => {
    loadProduct();
  }, [productId]);

  async function loadProduct() {
    if (!productId) return;
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get supplier
    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!supplierData) {
      setLoading(false);
      return;
    }
    setSupplier(supplierData);

    // Get product
    const { data: product, error: fetchError } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('id', productId)
      .eq('supplier_id', supplierData.id)
      .single();

    if (fetchError || !product) {
      console.error('Error loading product:', fetchError);
      setError('Product not found');
      setLoading(false);
      return;
    }

    // Populate form
    setName(product.name || '');
    setDescription(product.description || '');
    setCategory(product.category || '');
    setProductCode(product.product_code || '');
    setUnit(product.unit || '');
    setUnitMeasurement(product.unit_measurement?.toString() || '');
    setUnitMeasurementType(product.unit_measurement_type || '');
    setOriginCountryCode(product.origin_country_code || '');
    setProductImageUrl(product.product_image_url || '');

    // Product type & packaging fields
    setProductType(product.product_type || 'ingredient');
    setWeightG(product.weight_g?.toString() || '');
    setPackagingCategory(product.packaging_category || '');
    setPrimaryMaterial(product.primary_material || '');
    setEprMaterialCode(product.epr_material_code || '');
    setEprIsDrinksContainer(product.epr_is_drinks_container || false);

    // Load material components for packaging products
    if (product.product_type === 'packaging') {
      const { data: componentsData } = await supabase
        .from('supplier_product_components')
        .select('*')
        .eq('supplier_product_id', productId)
        .order('created_at', { ascending: true });
      setComponents(componentsData || []);
    }

    // Climate
    setImpactClimate(product.impact_climate?.toString() || '');
    setCarbonIntensity(product.carbon_intensity?.toString() || '');

    // Water
    setImpactWater(product.impact_water?.toString() || '');
    setWaterBlue(product.water_blue?.toString() || '');
    setWaterGreen(product.water_green?.toString() || '');
    setWaterGrey(product.water_grey?.toString() || '');

    // Circularity
    setImpactWaste(product.impact_waste?.toString() || '');
    setRecycledContentPct(product.recycled_content_pct?.toString() || '');
    setRecyclabilityPct(product.recyclability_pct?.toString() || '');
    setEndOfLifePathway(product.end_of_life_pathway || '');

    // Nature
    setImpactLand(product.impact_land?.toString() || '');

    // Certifications
    setCertifications(product.certifications || []);

    setLoading(false);
  }

  const parseNum = (val: string): number | null => {
    if (!val.trim()) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const handleSave = async () => {
    if (!name.trim() || !unit.trim()) {
      setError('Product name and unit are required');
      return;
    }

    // Validate percentage fields are within 0-100
    const pctRecycled = parseNum(recycledContentPct);
    const pctRecyclability = parseNum(recyclabilityPct);
    if (pctRecycled !== null && (pctRecycled < 0 || pctRecycled > 100)) {
      setError('Recycled content must be between 0% and 100%');
      return;
    }
    if (pctRecyclability !== null && (pctRecyclability < 0 || pctRecyclability > 100)) {
      setError('Recyclability must be between 0% and 100%');
      return;
    }

    // Validate non-negative for impact fields
    const numericFields = [
      { val: parseNum(impactClimate), label: 'Carbon footprint' },
      { val: parseNum(impactWater), label: 'Water footprint' },
      { val: parseNum(impactWaste), label: 'Waste per unit' },
      { val: parseNum(impactLand), label: 'Land use' },
      { val: parseNum(waterBlue), label: 'Blue water' },
      { val: parseNum(waterGreen), label: 'Green water' },
      { val: parseNum(waterGrey), label: 'Grey water' },
    ];
    for (const { val, label } of numericFields) {
      if (val !== null && val < 0) {
        setError(`${label} cannot be negative`);
        return;
      }
    }

    setError(null);
    setSaving(true);
    setSaveSuccess(false);

    try {
      const supabase = getSupabaseBrowserClient();

      const updateData: any = {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        product_code: productCode.trim() || null,
        unit: unit.trim(),
        unit_measurement: parseNum(unitMeasurement),
        unit_measurement_type: unitMeasurementType || null,
        origin_country_code: originCountryCode.trim() || null,
        product_image_url: productImageUrl || null,
        // Product type & packaging
        product_type: productType,
        weight_g: parseNum(weightG),
        packaging_category: packagingCategory || null,
        primary_material: primaryMaterial || null,
        epr_material_code: eprMaterialCode || null,
        epr_is_drinks_container: productType === 'packaging' ? eprIsDrinksContainer : null,
        // Climate
        impact_climate: parseNum(impactClimate),
        carbon_intensity: parseNum(impactClimate) ?? parseNum(carbonIntensity), // sync legacy field
        // Water
        impact_water: parseNum(impactWater),
        water_blue: parseNum(waterBlue),
        water_green: parseNum(waterGreen),
        water_grey: parseNum(waterGrey),
        // Circularity
        impact_waste: parseNum(impactWaste),
        recycled_content_pct: parseNum(recycledContentPct),
        recyclability_pct: parseNum(recyclabilityPct),
        end_of_life_pathway: endOfLifePathway || null,
        // Nature
        impact_land: parseNum(impactLand),
        // Certifications
        certifications,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('supplier_products')
        .update(updateData)
        .eq('id', productId);

      if (updateError) throw updateError;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase
        .from('supplier_products')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

      router.push('/supplier-portal/products');
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setError(err.message || 'Failed to delete product');
      setDeleting(false);
    }
  };

  // --- Material component management (packaging only) ---
  const addComponent = async () => {
    if (!supplier) return;
    setSavingComponents(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: insertError } = await supabase
        .from('supplier_product_components')
        .insert({
          supplier_product_id: productId,
          component_name: '',
          epr_material_type: 'other',
          weight_grams: 0,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setComponents(prev => [...prev, data]);
    } catch (err: any) {
      console.error('Error adding component:', err);
      setError(err.message || 'Failed to add component');
    } finally {
      setSavingComponents(false);
    }
  };

  const updateComponent = async (id: string, field: string, value: any) => {
    // Optimistic update
    setComponents(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const saveComponent = async (comp: SupplierProductComponent) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('supplier_product_components')
        .update({
          component_name: comp.component_name,
          epr_material_type: comp.epr_material_type,
          weight_grams: comp.weight_grams,
          percentage: comp.percentage,
          recycled_content_pct: comp.recycled_content_pct,
          is_recyclable: comp.is_recyclable,
        })
        .eq('id', comp.id);
      if (updateError) throw updateError;
    } catch (err: any) {
      console.error('Error saving component:', err);
    }
  };

  const deleteComponent = async (id: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase
        .from('supplier_product_components')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      setComponents(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      console.error('Error deleting component:', err);
      setError(err.message || 'Failed to delete component');
    }
  };

  const totalComponentWeight = components.reduce((sum, c) => sum + Number(c.weight_grams || 0), 0);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supplier) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${supplier.id}/products/${productId}/${timestamp}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('supplier-product-images')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('supplier-product-images')
        .getPublicUrl(storagePath);

      setProductImageUrl(publicUrl);

      // Persist image URL to database immediately
      const { error: updateError } = await supabase
        .from('supplier_products')
        .update({ product_image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', productId);

      if (updateError) {
        console.error('Error saving image URL:', updateError);
        setError('Image uploaded but failed to save. Please click Save All Changes.');
      }
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const addCertification = (cert: string) => {
    const trimmed = cert.trim();
    if (trimmed && !certifications.includes(trimmed)) {
      setCertifications([...certifications, trimmed]);
    }
  };

  const removeCertification = (cert: string) => {
    setCertifications(certifications.filter((c) => c !== cert));
  };

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-24 bg-muted rounded" />
            <div className="h-6 w-px bg-border" />
            <div className="h-7 w-40 bg-muted rounded" />
          </div>
          <div className="h-10 w-36 bg-muted rounded" />
        </div>
        <div className="h-10 w-full bg-muted rounded" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="flex items-start gap-6">
            <div className="w-32 h-32 bg-muted rounded-lg" />
            <div className="space-y-2">
              <div className="h-9 w-32 bg-muted rounded" />
              <div className="h-3 w-40 bg-muted rounded" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/supplier-portal/products')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Products
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-xl font-serif text-foreground">{name || 'Product Details'}</h1>
          {productType === 'packaging' ? (
            <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
              <Box className="h-3 w-3 mr-1" />
              Packaging
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
              <Wheat className="h-3 w-3 mr-1" />
              Ingredient
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={deleting}>
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete product?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{name}&rdquo;. Any brands using this product in their specifications will lose the linked data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete product
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                Saved
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save All Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert className="border-green-500/30 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-400">All changes saved successfully</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Product Info</span>
            <span className="sm:hidden">Info</span>
          </TabsTrigger>
          <TabsTrigger value="impact" className="flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Impact Data</span>
            <span className="sm:hidden">Impact</span>
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="certifications" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Certifications</span>
            <span className="sm:hidden">Certs</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: Product Info */}
        {/* ============================================================ */}
        <TabsContent value="info" className="space-y-6 mt-6">
          {/* Product Image */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Product Image
            </h2>
            <div className="flex items-start gap-6">
              {productImageUrl ? (
                <div className="relative group">
                  <img
                    src={productImageUrl}
                    alt={name}
                    className="w-32 h-32 object-contain rounded-lg border border-border"
                  />
                  <button
                    onClick={() => {
                      if (window.confirm('Remove this product image?')) {
                        setProductImageUrl('');
                        // Clear from DB immediately
                        const supabase = getSupabaseBrowserClient();
                        supabase.from('supplier_products')
                          .update({ product_image_url: null, updated_at: new Date().toISOString() })
                          .eq('id', productId)
                          .then(({ error: e }) => { if (e) console.error('Error clearing image:', e); });
                      }
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />{productImageUrl ? 'Replace Image' : 'Upload Image'}</>
                  )}
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleImageUpload}
                />
                <p className="text-xs text-muted-foreground mt-2">JPG, PNG or WebP. Max 10MB.</p>
              </div>
            </div>
          </div>

          {/* Basic Details */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Basic Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Organic Barley Malt" />
              </div>
              <div className="space-y-2">
                <Label>Product Code / SKU</Label>
                <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="e.g., BM-001" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this product..." rows={3} />
            </div>

            {productType === 'ingredient' ? (
              /* Ingredient: unit, measurement, category */
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Unit <span className="text-destructive">*</span></Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg (kilograms)</SelectItem>
                        <SelectItem value="g">g (grams)</SelectItem>
                        <SelectItem value="tonne">tonne</SelectItem>
                        <SelectItem value="L">L (litres)</SelectItem>
                        <SelectItem value="ml">ml (millilitres)</SelectItem>
                        <SelectItem value="unit">unit (each)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Measurement</Label>
                    <Input type="number" step="any" value={unitMeasurement} onChange={(e) => setUnitMeasurement(e.target.value)} placeholder="e.g., 25" />
                  </div>
                  <div className="space-y-2">
                    <Label>Measurement Type</Label>
                    <select value={unitMeasurementType} onChange={(e) => setUnitMeasurementType(e.target.value)} className={selectClass}>
                      <option value="">Select...</option>
                      <option value="weight">Weight</option>
                      <option value="volume">Volume</option>
                      <option value="length">Length</option>
                      <option value="area">Area</option>
                      <option value="count">Count</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Grain" />
                  </div>
                  <div className="space-y-2">
                    <Label>Origin Country Code</Label>
                    <Input value={originCountryCode} onChange={(e) => setOriginCountryCode(e.target.value)} placeholder="e.g., GB" maxLength={3} />
                    <p className="text-xs text-muted-foreground">ISO country code (e.g., GB, US, DE)</p>
                  </div>
                </div>
              </>
            ) : (
              /* Packaging: category, unit, weight, material */
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Packaging Category</Label>
                    <Select
                      value={packagingCategory}
                      onValueChange={(val) => setPackagingCategory(val as PackagingCategoryType)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(PACKAGING_CATEGORY_LABELS) as Array<[PackagingCategoryType, string]>).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={unit || 'unit'} onValueChange={setUnit}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unit">unit (each)</SelectItem>
                        <SelectItem value="pack">pack</SelectItem>
                        <SelectItem value="box">box</SelectItem>
                        <SelectItem value="case">case</SelectItem>
                        <SelectItem value="pallet">pallet</SelectItem>
                        <SelectItem value="roll">roll</SelectItem>
                        <SelectItem value="sheet">sheet</SelectItem>
                        <SelectItem value="m">m (metres)</SelectItem>
                        <SelectItem value="m²">m² (square metres)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">How this packaging is counted or measured</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Weight per Unit (g)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={weightG}
                      onChange={(e) => setWeightG(e.target.value)}
                      placeholder="e.g., 83"
                    />
                    <p className="text-xs text-muted-foreground">Weight of a single unit in grams</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Material</Label>
                    <Select value={primaryMaterial} onValueChange={setPrimaryMaterial}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select material..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIMARY_MATERIAL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Origin Country Code</Label>
                    <Input value={originCountryCode} onChange={(e) => setOriginCountryCode(e.target.value)} placeholder="e.g., GB" maxLength={3} />
                    <p className="text-xs text-muted-foreground">ISO country code (e.g., GB, US, DE)</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: Environmental Impact Data */}
        {/* ============================================================ */}
        <TabsContent value="impact" className="space-y-6 mt-6">
          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <p className="text-sm text-blue-300">
              Enter your product&apos;s environmental impact data across the 4 sustainability pillars. Upload supporting evidence (LCA reports, EPDs) in the Evidence tab.
            </p>
          </div>

          {/* Climate */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <Cloud className="h-4 w-4 text-blue-400" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Climate</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carbon Footprint (kg CO2e per {unit || 'unit'})</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={impactClimate}
                  onChange={(e) => setImpactClimate(e.target.value)}
                  placeholder="e.g., 0.35"
                />
                <p className="text-xs text-muted-foreground">
                  Total greenhouse gas emissions per unit of product
                </p>
              </div>
            </div>
          </div>

          {/* Water */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-cyan-500/10">
                <Droplets className="h-4 w-4 text-cyan-400" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Water</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Water Footprint (m&sup3; per {unit || 'unit'})</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={impactWater}
                  onChange={(e) => setImpactWater(e.target.value)}
                  placeholder="e.g., 1.2"
                />
                <p className="text-xs text-muted-foreground">Total water consumption per unit</p>
              </div>
            </div>
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                Advanced: Water breakdown (ISO 14046)
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t border-border">
                <div className="space-y-2">
                  <Label className="text-xs">Blue Water (m&sup3;)</Label>
                  <Input type="number" step="any" min="0" value={waterBlue} onChange={(e) => setWaterBlue(e.target.value)} placeholder="Surface & ground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Green Water (m&sup3;)</Label>
                  <Input type="number" step="any" min="0" value={waterGreen} onChange={(e) => setWaterGreen(e.target.value)} placeholder="Rainwater" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Grey Water (m&sup3;)</Label>
                  <Input type="number" step="any" min="0" value={waterGrey} onChange={(e) => setWaterGrey(e.target.value)} placeholder="Dilution volume" />
                </div>
              </div>
            </details>
          </div>

          {/* Circularity */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <Recycle className="h-4 w-4 text-amber-400" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Circularity</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recycled Content (%)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={recycledContentPct}
                  onChange={(e) => setRecycledContentPct(e.target.value)}
                  placeholder="e.g., 30"
                />
                <p className="text-xs text-muted-foreground">Percentage of recycled material in this product</p>
              </div>
              <div className="space-y-2">
                <Label>Recyclability (%)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={recyclabilityPct}
                  onChange={(e) => setRecyclabilityPct(e.target.value)}
                  placeholder="e.g., 85"
                />
                <p className="text-xs text-muted-foreground">Percentage of product that can be recycled</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Waste per Unit (kg per {unit || 'unit'})</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={impactWaste}
                  onChange={(e) => setImpactWaste(e.target.value)}
                  placeholder="e.g., 0.05"
                />
              </div>
              <div className="space-y-2">
                <Label>End of Life Pathway</Label>
                <select value={endOfLifePathway} onChange={(e) => setEndOfLifePathway(e.target.value)} className={selectClass}>
                  <option value="">Select...</option>
                  {END_OF_LIFE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Nature — ingredient products only */}
          {productType === 'ingredient' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-green-500/10">
                  <Leaf className="h-4 w-4 text-green-400" />
                </div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Nature &amp; Biodiversity</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Land Use (m&sup2;a crop eq per {unit || 'unit'})</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={impactLand}
                    onChange={(e) => setImpactLand(e.target.value)}
                    placeholder="e.g., 2.5"
                  />
                  <p className="text-xs text-muted-foreground">Agricultural land use impact per unit</p>
                </div>
              </div>
            </div>
          )}

          {/* Material Composition — packaging only */}
          {productType === 'packaging' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-purple-500/10">
                    <Box className="h-4 w-4 text-purple-400" />
                  </div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Material Composition</h2>
                </div>
                <Button variant="outline" size="sm" onClick={addComponent} disabled={savingComponents}>
                  {savingComponents ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add Component</>}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Break down the materials that make up this packaging unit. This data helps your customers with EPR reporting and circularity calculations.
              </p>

              {components.length > 0 ? (
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                    <div className="col-span-3">Component</div>
                    <div className="col-span-3">Material Type</div>
                    <div className="col-span-2">Weight (g)</div>
                    <div className="col-span-2">Recycled %</div>
                    <div className="col-span-2"></div>
                  </div>
                  {components.map((comp) => (
                    <div key={comp.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <Input
                          value={comp.component_name}
                          onChange={(e) => updateComponent(comp.id, 'component_name', e.target.value)}
                          onBlur={() => saveComponent(comp)}
                          placeholder="e.g., Outer shell"
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={comp.epr_material_type}
                          onChange={(e) => {
                            updateComponent(comp.id, 'epr_material_type', e.target.value);
                            saveComponent({ ...comp, epr_material_type: e.target.value });
                          }}
                          className={selectClass + ' text-sm'}
                        >
                          {EPR_COMPONENT_MATERIAL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={comp.weight_grams}
                          onChange={(e) => updateComponent(comp.id, 'weight_grams', parseFloat(e.target.value) || 0)}
                          onBlur={() => saveComponent(comp)}
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={comp.recycled_content_pct ?? ''}
                          onChange={(e) => updateComponent(comp.id, 'recycled_content_pct', e.target.value ? parseFloat(e.target.value) : null)}
                          onBlur={() => saveComponent(comp)}
                          placeholder="%"
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => deleteComponent(comp.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {/* Total weight summary */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Total component weight: <strong className="text-foreground">{totalComponentWeight.toFixed(1)}g</strong>
                    </span>
                    {weightG && Math.abs(totalComponentWeight - parseFloat(weightG)) > 0.5 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Differs from unit weight ({weightG}g)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  No components added yet. Click &ldquo;Add Component&rdquo; to break down the materials in this packaging.
                </div>
              )}
            </div>
          )}

          {/* EPR Data — packaging only */}
          {productType === 'packaging' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10">
                  <FileText className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">EPR Data</h2>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300">
                  Extended Producer Responsibility (EPR) data helps your customers comply with UK packaging regulations and the Report Packaging Data (RPD) requirements.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>EPR Material Code</Label>
                  <Select
                    value={eprMaterialCode}
                    onValueChange={(val) => setEprMaterialCode(val as EPRMaterialCode)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select RPD material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(EPR_MATERIAL_CODE_LABELS) as Array<[EPRMaterialCode, string]>).map(([code, label]) => (
                        <SelectItem key={code} value={code}>{code} — {label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">UK RPD material classification code</p>
                </div>
                <div className="space-y-2">
                  <Label>Is Drinks Container?</Label>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setEprIsDrinksContainer(!eprIsDrinksContainer)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        eprIsDrinksContainer ? 'bg-[#ccff00]' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          eprIsDrinksContainer ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {eprIsDrinksContainer ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Whether this is classified as a drinks container for EPR</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Impact Data</>}
            </Button>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: Evidence & Documents */}
        {/* ============================================================ */}
        <TabsContent value="evidence" className="mt-6">
          {supplier ? (
            <SupplierProductEvidenceTab
              supplierProductId={productId}
              organizationId={supplier.organization_id}
              productName={name}
              canVerify={false}
              canUpload={true}
            />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              Loading supplier information...
            </div>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 4: Certifications */}
        {/* ============================================================ */}
        <TabsContent value="certifications" className="space-y-6 mt-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[#ccff00]/10">
                <Shield className="h-4 w-4 text-[#ccff00]" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Certifications &amp; Eco-Labels</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Add any certifications that apply to this product. Upload supporting certificates in the Evidence tab.
            </p>

            {/* Current certifications */}
            {certifications.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {certifications.map((cert) => (
                  <Badge
                    key={cert}
                    variant="secondary"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm"
                  >
                    {cert}
                    <button
                      onClick={() => removeCertification(cert)}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Common certifications */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Common certifications:</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_CERTIFICATIONS.filter((c) => !certifications.includes(c)).map((cert) => (
                  <button
                    key={cert}
                    onClick={() => addCertification(cert)}
                    className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:border-[#ccff00]/50 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3 inline mr-1" />
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom certification */}
            <div className="flex gap-2">
              <Input
                value={customCert}
                onChange={(e) => setCustomCert(e.target.value)}
                placeholder="Add a custom certification..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCertification(customCert);
                    setCustomCert('');
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  addCertification(customCert);
                  setCustomCert('');
                }}
                disabled={!customCert.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Certifications</>}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
