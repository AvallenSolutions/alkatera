import Image from 'next/image';
import { Cloud, Droplets, Recycle, TreeDeciduous, Award, Info, TrendingDown, Crown, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import PassportMetricCard from './PassportMetricCard';

interface PassportCanopyViewProps {
  product: any;
  lca: any;
  materials: any[];
  organization: any;
}

export default function PassportCanopyView({ product, lca, materials, organization }: PassportCanopyViewProps) {
  const impacts = lca?.aggregated_impacts || {};
  const ghgEmissions = impacts.climate_change_gwp100 || 0;
  const waterConsumption = impacts.water_consumption || 0;
  const waterScarcity = impacts.water_scarcity_aware || 0;
  const wasteGenerated = impacts.waste_generated || 0;
  const landUse = impacts.land_use || 0;
  const terrestrialEcotox = impacts.terrestrial_ecotoxicity || 0;
  const freshwaterEutro = impacts.freshwater_eutrophication || 0;
  const terrestrialAcid = impacts.terrestrial_acidification || 0;

  const functionalUnit = product.functional_unit || product.unit_size_value
    ? `${product.unit_size_value} ${product.unit_size_unit}`
    : 'per unit';

  const hasValidData = ghgEmissions > 0 || waterConsumption > 0;

  const ghgBreakdown = impacts.breakdown?.ghg || {};
  const scope1 = ghgBreakdown.scope_1 || 0;
  const scope2 = ghgBreakdown.scope_2 || 0;
  const scope3 = ghgBreakdown.scope_3 || 0;

  const hasEF31 = !!lca?.ef31_impacts;
  const hasRecipe = !!impacts;

  return (
    <div className="space-y-8">
      <Card className="border-amber-200 shadow-xl overflow-hidden bg-gradient-to-br from-white to-amber-50/30">
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div className="space-y-4">
            {product.image_url && (
              <div className="relative w-full h-64 rounded-lg overflow-hidden bg-neutral-100 ring-2 ring-amber-200">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
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
                <Badge className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Canopy
                </Badge>
              </div>
              {product.product_description && (
                <p className="text-neutral-600 mb-4">
                  {product.product_description}
                </p>
              )}
              <Badge variant="outline" className="text-xs border-amber-300">
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
              <Sparkles className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-semibold text-neutral-900">Comprehensive Impact Assessment</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <PassportMetricCard
                title="GHG Emissions"
                value={ghgEmissions}
                unit="kg CO₂eq"
                icon={Cloud}
                description="Carbon footprint"
                color="green"
              />
              <PassportMetricCard
                title="Water Use"
                value={waterConsumption}
                unit="m³"
                icon={Droplets}
                description="Freshwater consumption"
                color="blue"
              />
              <PassportMetricCard
                title="Waste"
                value={wasteGenerated}
                unit="kg"
                icon={Recycle}
                description="Total waste generated"
                color="orange"
              />
              <PassportMetricCard
                title="Land Use"
                value={landUse}
                unit="m²a"
                icon={TreeDeciduous}
                description="Crop equivalent land"
                color="green"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {(scope1 > 0 || scope2 > 0 || scope3 > 0) && (
              <Card className="border-neutral-200">
                <CardHeader>
                  <CardTitle className="text-base">Climate Impact Details</CardTitle>
                  <CardDescription>GHG emissions by scope</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scope1 > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Scope 1 (Direct)</span>
                        <span className="font-semibold text-neutral-900">
                          {scope1.toFixed(2)} kg CO₂eq
                        </span>
                      </div>
                    )}
                    {scope2 > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Scope 2 (Energy)</span>
                        <span className="font-semibold text-neutral-900">
                          {scope2.toFixed(2)} kg CO₂eq
                        </span>
                      </div>
                    )}
                    {scope3 > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-600">Scope 3 (Supply Chain)</span>
                        <span className="font-semibold text-neutral-900">
                          {scope3.toFixed(2)} kg CO₂eq
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {waterScarcity > 0 && (
              <Card className="border-neutral-200">
                <CardHeader>
                  <CardTitle className="text-base">Water Scarcity Impact</CardTitle>
                  <CardDescription>Spatially-explicit water stress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Water Consumption</span>
                      <span className="font-semibold text-neutral-900">
                        {waterConsumption.toFixed(2)} m³
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Scarcity Impact (AWARE)</span>
                      <span className="font-semibold text-blue-700">
                        {waterScarcity.toFixed(2)} m³ eq
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {(terrestrialEcotox > 0 || freshwaterEutro > 0 || terrestrialAcid > 0) && (
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TreeDeciduous className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-base">Biodiversity & Ecosystem Impacts</CardTitle>
                </div>
                <CardDescription>Advanced environmental indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {terrestrialEcotox > 0 && (
                    <div>
                      <p className="text-xs text-neutral-600 mb-1">Terrestrial Ecotoxicity</p>
                      <p className="text-lg font-semibold text-neutral-900">
                        {terrestrialEcotox.toFixed(3)} kg 1,4-DCB
                      </p>
                    </div>
                  )}
                  {freshwaterEutro > 0 && (
                    <div>
                      <p className="text-xs text-neutral-600 mb-1">Freshwater Eutrophication</p>
                      <p className="text-lg font-semibold text-neutral-900">
                        {freshwaterEutro.toFixed(4)} kg P eq
                      </p>
                    </div>
                  )}
                  {terrestrialAcid > 0 && (
                    <div>
                      <p className="text-xs text-neutral-600 mb-1">Terrestrial Acidification</p>
                      <p className="text-lg font-semibold text-neutral-900">
                        {terrestrialAcid.toFixed(3)} kg SO₂ eq
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-neutral-200 bg-neutral-50/50">
            <CardHeader>
              <CardTitle className="text-base">Assessment Methodology</CardTitle>
              <CardDescription>Industry-leading impact assessment frameworks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasRecipe && (
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="text-xs mt-0.5">ReCiPe 2016 Midpoint (H)</Badge>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700 font-medium">Multi-capital Impact Assessment</p>
                    <p className="text-xs text-neutral-500">Comprehensive environmental indicator suite</p>
                  </div>
                </div>
              )}
              {hasEF31 && (
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="text-xs mt-0.5">EF 3.1</Badge>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700 font-medium">Environmental Footprint 3.1</p>
                    <p className="text-xs text-neutral-500">European Commission PEF methodology</p>
                  </div>
                </div>
              )}
              <Separator />
              {lca?.updated_at && (
                <p className="text-xs text-neutral-500">
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

      <div className="bg-gradient-to-br from-amber-50 via-green-50 to-emerald-50 border-2 border-amber-200 rounded-xl p-6 shadow-md">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-100 to-green-100 rounded-lg">
            <TreeDeciduous className="h-7 w-7 text-green-700" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-neutral-900 mb-2 text-lg">
              Leading Environmental Transparency
            </h3>
            <p className="text-sm text-neutral-700 mb-4">
              This product assessment represents our commitment to the highest standards of
              environmental transparency. We measure and report across climate, water,
              biodiversity, and ecosystem health indicators to drive meaningful sustainability improvements.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white/70 text-green-800 border-green-300">
                CSRD Aligned
              </Badge>
              <Badge variant="outline" className="bg-white/70 text-green-800 border-green-300">
                TNFD Compatible
              </Badge>
              <Badge variant="outline" className="bg-white/70 text-green-800 border-green-300">
                Science-Based
              </Badge>
              <Badge variant="outline" className="bg-white/70 text-amber-800 border-amber-300">
                <Crown className="h-3 w-3 mr-1" />
                Premium Assessment
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
