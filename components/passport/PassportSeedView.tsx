import Image from 'next/image';
import { Cloud, Award, Info, TrendingDown, Leaf } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PassportMetricCard from './PassportMetricCard';

interface PassportSeedViewProps {
  product: any;
  lca: any;
  materials: any[];
  organization: any;
}

export default function PassportSeedView({ product, lca, materials, organization }: PassportSeedViewProps) {
  const ghgEmissions = lca?.aggregated_impacts?.climate_change_gwp100 || 0;
  const functionalUnit = product.functional_unit
    || (product.unit_size_value && product.unit_size_unit ? `${product.unit_size_value} ${product.unit_size_unit}` : null)
    || 'per unit';

  const ghgBreakdown = lca?.aggregated_impacts?.breakdown?.by_scope || {};
  const scope1 = ghgBreakdown.scope1 || 0;
  const scope2 = ghgBreakdown.scope2 || 0;
  const scope3 = ghgBreakdown.scope3 || 0;

  const hasValidData = ghgEmissions > 0;

  return (
    <div className="space-y-8">
      <Card className="border-neutral-200 shadow-lg overflow-hidden">
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div className="space-y-4">
            <div className="relative w-full h-64 rounded-lg overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="text-center p-8">
                  <Leaf className="h-16 w-16 text-green-300 mx-auto mb-2" />
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
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                {product.name}
              </h1>
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

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="h-5 w-5 text-green-600" />
          <h2 className="text-xl font-semibold text-neutral-900">Climate Impact</h2>
        </div>

        {hasValidData ? (
          <div className="grid gap-4">
            <PassportMetricCard
              title="Total GHG Emissions"
              value={ghgEmissions}
              unit="kg CO₂eq"
              icon={Cloud}
              description={`Carbon footprint per ${functionalUnit}`}
              color="green"
            />

            {(scope1 > 0 || scope2 > 0 || scope3 > 0) && (
              <Card className="border-neutral-200">
                <CardHeader>
                  <CardTitle className="text-base">Emissions Breakdown</CardTitle>
                  <CardDescription>By greenhouse gas protocol scope</CardDescription>
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
          </div>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Climate impact data is currently being calculated for this product.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {lca?.methodology && (
        <Card className="border-neutral-200 bg-neutral-50/50">
          <CardHeader>
            <CardTitle className="text-base">Methodology</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            <p>Calculated using {lca.methodology} methodology</p>
            {lca.updated_at && (
              <p className="mt-2 text-xs text-neutral-500">
                Last updated: {new Date(lca.updated_at).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrendingDown className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 mb-1">Our Commitment</h3>
            <p className="text-sm text-green-800">
              We&apos;re committed to transparency and continuous improvement in reducing our
              environmental impact. This data represents our current footprint and guides
              our sustainability initiatives.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
