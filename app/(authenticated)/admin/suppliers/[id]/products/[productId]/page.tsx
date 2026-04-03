'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wheat,
  Box,
  Cloud,
  Droplets,
  Leaf,
  Recycle,
  MapPin,
  Calendar,
  FileText,
  ExternalLink,
  Package,
  Info,
  BarChart3,
  Award,
  Beaker,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface SupplierProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  product_type: string;
  packaging_category: string | null;
  unit: string;
  unit_measurement: number | null;
  unit_measurement_type: string | null;
  product_code: string | null;
  product_image_url: string | null;
  primary_material: string | null;
  epr_material_code: string | null;
  epr_is_drinks_container: boolean | null;
  weight_g: number | null;
  origin_address: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_country_code: string | null;
  // Impact
  impact_climate: number | null;
  impact_water: number | null;
  impact_land: number | null;
  impact_waste: number | null;
  carbon_intensity: number | null;
  // GHG breakdown
  ghg_fossil: number | null;
  ghg_biogenic: number | null;
  ghg_land_use_change: number | null;
  // Water breakdown
  water_blue: number | null;
  water_green: number | null;
  water_grey: number | null;
  water_scarcity_factor: number | null;
  // Circularity
  recycled_content_pct: number | null;
  recyclability_pct: number | null;
  end_of_life_pathway: string | null;
  circularity_score: number | null;
  // Biodiversity
  terrestrial_ecotoxicity: number | null;
  freshwater_eutrophication: number | null;
  terrestrial_acidification: number | null;
  // Data quality
  data_quality_score: number | null;
  data_confidence_pct: number | null;
  data_source_type: string | null;
  methodology_standard: string | null;
  functional_unit: string | null;
  system_boundary: string | null;
  // Validity
  valid_from: string | null;
  valid_until: string | null;
  reference_year: number | null;
  geographic_scope: string | null;
  // Uncertainty
  uncertainty_type: string | null;
  uncertainty_value: number | null;
  // External verification
  external_verifier_name: string | null;
  external_verification_date: string | null;
  external_verification_expiry: string | null;
  external_verification_standard: string | null;
  external_verification_url: string | null;
  // Internal verification
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  // Status
  is_active: boolean;
  certifications: string[] | null;
  created_at: string;
  updated_at: string;
}

export default function AdminSupplierProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params?.id as string;
  const productId = params?.productId as string;

  const [product, setProduct] = useState<SupplierProduct | null>(null);
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierLocation, setSupplierLocation] = useState<{
    address: string | null;
    city: string | null;
    country: string | null;
    country_code: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [unverifyDialogOpen, setUnverifyDialogOpen] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (productId && supplierId) loadProduct();
  }, [productId, supplierId]);

  async function loadProduct() {
    setLoading(true);
    try {
      const authClient = getSupabaseBrowserClient();
      const { data: sessionData } = await authClient.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      // Fetch supplier data and products via admin API
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
        const supplier = data.supplier;
        const products: SupplierProduct[] = data.products || [];

        // Set supplier info
        if (supplier) {
          setSupplierName(supplier.name || '');
          setSupplierLocation({
            address: supplier.address,
            city: supplier.city,
            country: supplier.country,
            country_code: supplier.country_code,
          });
        } else {
          // Fallback to platform supplier name
          const { data: ps } = await supabase
            .from('platform_suppliers')
            .select('name')
            .eq('id', supplierId)
            .maybeSingle();
          setSupplierName(ps?.name || '');
        }

        // Find our product
        const found = products.find(p => p.id === productId) || null;
        setProduct(found);

        if (!found) {
          toast.error('Product not found');
        }
      } else {
        toast.error('Failed to load product');
      }
    } catch (err) {
      console.error('Error loading product:', err);
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  }

  const handleVerify = async () => {
    if (!product) return;
    try {
      setVerifying(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await (supabase.from('supplier_products') as any)
        .update({
          is_verified: true,
          verified_by: userData.user.id,
          verified_at: new Date().toISOString(),
          verification_notes: verificationNotes || null,
        })
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Product verified successfully');
      setVerifyDialogOpen(false);
      setVerificationNotes('');
      setProduct(prev => prev ? {
        ...prev,
        is_verified: true,
        verified_by: userData.user!.id,
        verified_at: new Date().toISOString(),
        verification_notes: verificationNotes || null,
      } : prev);
    } catch (err: any) {
      console.error('Error verifying product:', err);
      toast.error(err.message || 'Failed to verify product');
    } finally {
      setVerifying(false);
    }
  };

  const handleUnverify = async () => {
    if (!product) return;
    try {
      setVerifying(true);
      const { error } = await (supabase.from('supplier_products') as any)
        .update({
          is_verified: false,
          verified_by: null,
          verified_at: null,
          verification_notes: null,
        })
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Product verification removed');
      setUnverifyDialogOpen(false);
      setProduct(prev => prev ? {
        ...prev,
        is_verified: false,
        verified_by: null,
        verified_at: null,
        verification_notes: null,
      } : prev);
    } catch (err: any) {
      console.error('Error unverifying product:', err);
      toast.error(err.message || 'Failed to unverify product');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Product not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push(`/admin/suppliers/${supplierId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to supplier
        </Button>
      </div>
    );
  }

  const climateVal = product.impact_climate ?? product.carbon_intensity;
  const hasGhgBreakdown = product.ghg_fossil != null || product.ghg_biogenic != null || product.ghg_land_use_change != null;
  const hasWaterBreakdown = product.water_blue != null || product.water_green != null || product.water_grey != null;
  const hasCircularity = product.recycled_content_pct != null || product.recyclability_pct != null || product.end_of_life_pathway != null;
  const hasBiodiversity = product.terrestrial_ecotoxicity != null || product.freshwater_eutrophication != null || product.terrestrial_acidification != null;
  const hasDataQuality = product.data_quality_score != null || product.data_source_type != null || product.methodology_standard != null;
  const hasExternalVerification = product.external_verifier_name != null;
  const hasValidity = product.valid_from != null || product.valid_until != null || product.reference_year != null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/suppliers/${supplierId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {supplierName || 'Supplier'}
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          {product.product_type === 'packaging' ? (
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
          {!product.is_active && (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {product.is_verified ? (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => setUnverifyDialogOpen(true)}
            >
              <ShieldX className="h-4 w-4 mr-2" />
              Remove Verification
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setVerificationNotes('');
                setVerifyDialogOpen(true);
              }}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verify Product
            </Button>
          )}
        </div>
      </div>

      {/* Verification Status Banner */}
      {product.is_verified ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-400">Verified</p>
            <p className="text-xs text-muted-foreground">
              Verified on {product.verified_at ? new Date(product.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'unknown date'}
              {product.verification_notes && ` — ${product.verification_notes}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">Awaiting verification</p>
            <p className="text-xs text-muted-foreground">
              This product has not been verified by an alkatera admin. It will not appear in general search results until verified.
            </p>
          </div>
        </div>
      )}

      {/* Product Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Basic Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField label="Product Name" value={product.name} />
              <InfoField label="Product Code" value={product.product_code} />
              <InfoField label="Category" value={product.category} />
              <InfoField label="Unit" value={product.unit} />
              {product.product_type === 'packaging' && (
                <>
                  <InfoField label="Packaging Type" value={product.packaging_category} capitalize />
                  <InfoField label="Weight" value={product.weight_g != null ? `${product.weight_g}g` : null} />
                  <InfoField label="Primary Material" value={product.primary_material} capitalize />
                  <InfoField label="EPR Material Code" value={product.epr_material_code} />
                  {product.epr_is_drinks_container != null && (
                    <InfoField label="EPR Drinks Container" value={product.epr_is_drinks_container ? 'Yes' : 'No'} />
                  )}
                </>
              )}
              {product.description && (
                <div className="sm:col-span-2">
                  <InfoField label="Description" value={product.description} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Image & Origin */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Origin & Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {product.product_image_url ? (
              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
                <Image
                  src={product.product_image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            <div className="space-y-2">
              {(() => {
                const originAddress = product.origin_address
                  || (supplierLocation
                    ? [supplierLocation.address, supplierLocation.city, supplierLocation.country].filter(Boolean).join(', ')
                    : null)
                  || null;
                const originCountry = product.origin_country_code || supplierLocation?.country_code || null;
                const isFromSupplier = !product.origin_address && originAddress;
                return (
                  <>
                    <InfoField label="Origin" value={originAddress} />
                    <InfoField label="Country Code" value={originCountry} />
                    {isFromSupplier && (
                      <p className="text-xs text-muted-foreground italic">From supplier registered address</p>
                    )}
                  </>
                );
              })()}
              {product.origin_lat != null && product.origin_lng != null && (
                <p className="text-xs text-muted-foreground">{product.origin_lat.toFixed(4)}, {product.origin_lng.toFixed(4)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environmental Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Environmental Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ImpactCard
              icon={<Cloud className="h-5 w-5" />}
              label="Climate"
              value={climateVal}
              unit={`kg CO₂e/${product.unit}`}
              color="blue"
            />
            <ImpactCard
              icon={<Droplets className="h-5 w-5" />}
              label="Water"
              value={product.impact_water}
              unit={`L/${product.unit}`}
              color="cyan"
            />
            <ImpactCard
              icon={<Leaf className="h-5 w-5" />}
              label="Land Use"
              value={product.impact_land}
              unit={`m²/${product.unit}`}
              color="green"
            />
            <ImpactCard
              icon={<Recycle className="h-5 w-5" />}
              label="Waste"
              value={product.impact_waste}
              unit={`kg/${product.unit}`}
              color="orange"
            />
          </div>

          {/* GHG Breakdown */}
          {hasGhgBreakdown && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                GHG Breakdown (ISO 14067)
              </h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <InfoField label="Fossil CO₂" value={product.ghg_fossil != null ? `${product.ghg_fossil} kg CO₂` : null} />
                <InfoField label="Biogenic CO₂" value={product.ghg_biogenic != null ? `${product.ghg_biogenic} kg CO₂` : null} />
                <InfoField label="Land Use Change" value={product.ghg_land_use_change != null ? `${product.ghg_land_use_change} kg CO₂e` : null} />
              </div>
            </div>
          )}

          {/* Water Breakdown */}
          {hasWaterBreakdown && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                Water Breakdown (ISO 14046)
              </h4>
              <div className="grid gap-4 sm:grid-cols-4">
                <InfoField label="Blue Water" value={product.water_blue != null ? `${product.water_blue} m³` : null} />
                <InfoField label="Green Water" value={product.water_green != null ? `${product.water_green} m³` : null} />
                <InfoField label="Grey Water" value={product.water_grey != null ? `${product.water_grey} m³` : null} />
                <InfoField label="Scarcity Factor" value={product.water_scarcity_factor?.toString()} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Circularity */}
      {hasCircularity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Recycle className="h-4 w-4" />
              Circularity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoField label="Recycled Content" value={product.recycled_content_pct != null ? `${product.recycled_content_pct}%` : null} />
              <InfoField label="Recyclability" value={product.recyclability_pct != null ? `${product.recyclability_pct}%` : null} />
              <InfoField label="End of Life Pathway" value={product.end_of_life_pathway?.replace(/_/g, ' ')} capitalize />
              <InfoField label="Circularity Score" value={product.circularity_score?.toString()} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Biodiversity */}
      {hasBiodiversity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Leaf className="h-4 w-4" />
              Biodiversity (ReCiPe 2016)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoField label="Terrestrial Ecotoxicity" value={product.terrestrial_ecotoxicity?.toString()} />
              <InfoField label="Freshwater Eutrophication" value={product.freshwater_eutrophication?.toString()} />
              <InfoField label="Terrestrial Acidification" value={product.terrestrial_acidification?.toString()} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Quality & Methodology */}
      {hasDataQuality && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Data Quality & Methodology
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Data Quality Score" value={product.data_quality_score != null ? `${product.data_quality_score}/5` : null} />
              <InfoField label="Confidence" value={product.data_confidence_pct != null ? `${product.data_confidence_pct}%` : null} />
              <InfoField label="Source Type" value={product.data_source_type?.replace(/_/g, ' ')} capitalize />
              <InfoField label="Methodology Standard" value={product.methodology_standard} />
              <InfoField label="Functional Unit" value={product.functional_unit} />
              <InfoField label="System Boundary" value={product.system_boundary?.replace(/-/g, ' ')} capitalize />
              {product.uncertainty_type && (
                <>
                  <InfoField label="Uncertainty Type" value={product.uncertainty_type.replace(/_/g, ' ')} capitalize />
                  <InfoField label="Uncertainty Value" value={product.uncertainty_value?.toString()} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validity Period */}
      {hasValidity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Validity & Scope
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoField label="Valid From" value={product.valid_from ? new Date(product.valid_from).toLocaleDateString('en-GB') : null} />
              <InfoField label="Valid Until" value={product.valid_until ? new Date(product.valid_until).toLocaleDateString('en-GB') : null} />
              <InfoField label="Reference Year" value={product.reference_year?.toString()} />
              <InfoField label="Geographic Scope" value={product.geographic_scope} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* External Verification */}
      {hasExternalVerification && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              External Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField label="Verifier" value={product.external_verifier_name} />
              <InfoField label="Standard" value={product.external_verification_standard} />
              <InfoField label="Verification Date" value={product.external_verification_date ? new Date(product.external_verification_date).toLocaleDateString('en-GB') : null} />
              <InfoField label="Expiry Date" value={product.external_verification_expiry ? new Date(product.external_verification_expiry).toLocaleDateString('en-GB') : null} />
              {product.external_verification_url && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Verification Document</p>
                  <a
                    href={product.external_verification_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View document <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certifications */}
      {product.certifications && product.certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {product.certifications.map((cert) => (
                <Badge key={cert} variant="secondary" className="text-sm">
                  {cert}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span>Created {new Date(product.created_at).toLocaleDateString('en-GB')}</span>
        {product.updated_at && product.updated_at !== product.created_at && (
          <span>Updated {new Date(product.updated_at).toLocaleDateString('en-GB')}</span>
        )}
        <span className="font-mono">{product.id}</span>
      </div>

      {/* Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify product</DialogTitle>
            <DialogDescription>
              Verify &ldquo;{product.name}&rdquo; to confirm the data meets quality standards. Verified products will appear in search results for brand users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="verification-notes">Verification notes (optional)</Label>
              <Textarea
                id="verification-notes"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="e.g. Impact data cross-checked against EPD, methodology reviewed..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)} disabled={verifying}>
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={verifying} className="bg-emerald-600 hover:bg-emerald-700">
              {verifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
              ) : (
                <><ShieldCheck className="mr-2 h-4 w-4" />Confirm Verification</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unverify Dialog */}
      <Dialog open={unverifyDialogOpen} onOpenChange={setUnverifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove verification</DialogTitle>
            <DialogDescription>
              This will remove the verification status from &ldquo;{product.name}&rdquo;. The product will no longer appear in general search results.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnverifyDialogOpen(false)} disabled={verifying}>
              Cancel
            </Button>
            <Button onClick={handleUnverify} disabled={verifying} variant="destructive">
              {verifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removing...</>
              ) : (
                'Remove Verification'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helper Components ── */

function InfoField({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string | null | undefined;
  capitalize?: boolean;
}) {
  if (!value) {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm text-muted-foreground/50">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}

function ImpactCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  unit: string;
  color: 'blue' | 'cyan' | 'green' | 'orange';
}) {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/5 border-blue-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/5 border-cyan-500/20',
    green: 'text-green-400 bg-green-500/5 border-green-500/20',
    orange: 'text-orange-400 bg-orange-500/5 border-orange-500/20',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {value != null ? (
        <>
          <p className="text-2xl font-bold">{value < 0.01 && value > 0 ? value.toExponential(2) : value.toFixed(4)}</p>
          <p className="text-xs opacity-70">{unit}</p>
        </>
      ) : (
        <p className="text-sm opacity-50">No data</p>
      )}
    </div>
  );
}
