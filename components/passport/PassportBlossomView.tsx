import Image from 'next/image';
import { Cloud, Droplets, Recycle, Award, Info, TrendingDown, Sparkles, Leaf } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PassportMetricCard from './PassportMetricCard';

interface PassportBlossomViewProps {
  product: any;
  lca: any;
  materials: any[];
  organization: any;
}

export default function PassportBlossomView({ product, lca, materials, organization }: PassportBlossomViewProps) {
  const impacts = lca?.aggregated_impacts || {};

  console.log('LCA:', lca);
  console.log('Impacts:', impacts);
  console.log('Breakdown:', impacts.breakdown);
  console.log('Organization:', organization);

  const ghgEmissions = impacts.climate_change_gwp100 || 0;
  const waterConsumption = impacts.water_consumption || 0;
  const wasteGenerated = impacts.waste || 0;

  const functionalUnit = product.functional_unit
    || (product.unit_size_value && product.unit_size_unit ? `${product.unit_size_value} ${product.unit_size_unit}` : null)
    || 'per unit';

  const hasValidData = ghgEmissions > 0 || waterConsumption > 0 || wasteGenerated > 0;

  const categoryBreakdown = impacts.breakdown?.by_category || {};
  const ingredients = categoryBreakdown.materials || 0;
  const packaging = categoryBreakdown.packaging || 0;
  const transportation = categoryBreakdown.transport || 0;
  const processing = categoryBreakdown.production || 0;
  const hasBreakdown = ingredients > 0 || packaging > 0 || transportation > 0 || processing > 0;

  console.log('Category Breakdown:', categoryBreakdown);
  console.log('Has breakdown?', hasBreakdown, { ingredients, packaging, transportation, processing });

  const hasEF31 = !!lca?.ef31_impacts;
  const hasRecipe = !!impacts;

  return (
    <div className="space-y-8">
      <Card className="border-neutral-200 shadow-lg overflow-hidden">
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div className="space-y-4">
            <div className="relative w-full h-64 rounded-lg overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 flex items-center justify-center">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="text-center p-8">
                  <Sparkles className="h-16 w-16 text-green-300 mx-auto mb-2" />
                  <p className="text-sm text-green-600 font-medium">{product.name}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              {organization?.logo_url && (
                <Image
                  src={organization.logo_url}
                  alt={organization.name}
                  width={120}
                  height={40}
                  className="mb-4"
                />
              )}
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold text-neutral-900">
                  {product.name}
                </h1>
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Blossom
                </Badge>
              </div>
              {product.product_description && (
                <p className="text-neutral-600 mb-4">
                  {product.product_description}
                </p>
              )}
              <Badge variant="outline" className="text-xs">
                Functional Unit: {functionalUnit}
              </Badge>
            </div>

            {product.certifications && product.certifications.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.certifications.map((cert: any, idx: number) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {cert.name || cert}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {hasValidData ? (
        <>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Cloud className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold text-neutral-900">Environmental Impact</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <PassportMetricCard
                title="GHG Emissions"
                value={ghgEmissions}
                unit="kg CO₂eq"
                icon={Cloud}
                description="Carbon footprint"
                color="green"
              />
              <PassportMetricCard
                title="Water Consumption"
                value={waterConsumption}
                unit="m³"
                icon={Droplets}
                description="Freshwater use"
                color="blue"
              />
              <PassportMetricCard
                title="Waste Generated"
                value={wasteGenerated}
                unit="kg"
                icon={Recycle}
                description="Total waste"
                color="orange"
              />
            </div>

            {hasBreakdown && (
              <Card className="border-neutral-200">
                <CardHeader>
                  <CardTitle className="text-base">GHG Emissions Breakdown</CardTitle>
                  <CardDescription>By lifecycle stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ingredients > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Ingredients</span>
                        <span className="font-semibold text-neutral-900">
                          {ingredients.toFixed(3)} kg CO₂eq
                        </span>
                      </div>
                    )}
                    {packaging > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Packaging</span>
                        <span className="font-semibold text-neutral-900">
                          {packaging.toFixed(3)} kg CO₂eq
                        </span>
                      </div>
                    )}
                    {processing > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Processing</span>
                        <span className="font-semibold text-neutral-900">
                          {processing.toFixed(3)} kg CO₂eq
                        </span>
                      </div>
                    )}
                    {transportation > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Transportation</span>
                        <span className="font-semibold text-neutral-900">
                          {transportation.toFixed(3)} kg CO₂eq
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-neutral-200 bg-neutral-50/50">
            <CardHeader>
              <CardTitle className="text-base">Assessment Methodology</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hasRecipe && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">ReCiPe 2016 Midpoint (H)</Badge>
                  <span className="text-neutral-600">Multi-capital impact assessment</span>
                </div>
              )}
              {hasEF31 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">EF 3.1</Badge>
                  <span className="text-neutral-600">European Commission methodology</span>
                </div>
              )}
              {lca?.updated_at && (
                <p className="text-xs text-neutral-500 mt-3">
                  Last updated: {new Date(lca.updated_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Environmental impact data is currently being calculated for this product.
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <TrendingDown className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2 text-lg">Our Environmental Commitment</h3>
            <p className="text-sm text-green-800 mb-3">
              We&apos;re committed to transparency across multiple environmental impact categories.
              This comprehensive assessment guides our sustainability strategy and helps us
              continuously improve our environmental performance.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white/50 text-green-800 border-green-300">
                Climate Action
              </Badge>
              <Badge variant="outline" className="bg-white/50 text-green-800 border-green-300">
                Water Stewardship
              </Badge>
              <Badge variant="outline" className="bg-white/50 text-green-800 border-green-300">
                Circular Economy
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
