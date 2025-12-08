"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Package, ArrowRight, Building2, Database } from "lucide-react";
import Link from "next/link";
import type { ProductIngredient, ProductPackaging } from "@/hooks/data/useProductData";

interface SpecificationTabProps {
  productId: string;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
}

export function SpecificationTab({ productId, ingredients, packaging }: SpecificationTabProps) {
  // Calculate total ingredient weight
  const totalIngredientWeight = ingredients.reduce((sum, ing) => {
    const weight = ing.unit === 'kg' ? ing.quantity : ing.quantity / 1000;
    return sum + weight;
  }, 0);

  // Get top 3 ingredients by weight
  const topIngredients = [...ingredients]
    .sort((a, b) => {
      const aWeight = a.unit === 'kg' ? a.quantity : a.quantity / 1000;
      const bWeight = b.unit === 'kg' ? b.quantity : b.quantity / 1000;
      return bWeight - aWeight;
    })
    .slice(0, 3);

  // Calculate total packaging weight
  const totalPackagingWeight = packaging.reduce((sum, pkg) => {
    return sum + pkg.quantity;
  }, 0);

  // Get primary container
  const primaryContainer = packaging.find(p => p.packaging_category === 'container');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Ingredients Summary Card */}
      <Card className="backdrop-blur-xl bg-white/5 border border-white/10 border-l-4 border-l-green-500 shadow-xl hover:bg-white/10 transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/80 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20">
                <Leaf className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Ingredients</CardTitle>
                <CardDescription className="text-slate-400">Recipe composition</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ingredients.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Leaf className="h-12 w-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium mb-1 text-slate-300">No ingredients added</p>
              <p className="text-xs text-slate-500">
                Add ingredients to complete your product recipe
              </p>
            </div>
          ) : (
            <>
              {/* Total Weight */}
              <div className="flex items-baseline justify-between pb-3 border-b border-white/10">
                <span className="text-sm text-slate-400">Total Net Weight</span>
                <span className="text-2xl font-bold text-white">
                  {totalIngredientWeight.toFixed(2)} <span className="text-base font-normal text-slate-400">kg</span>
                </span>
              </div>

              {/* Top Ingredients */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Top Ingredients</h4>
                {topIngredients.map((ing, idx) => {
                  const weight = ing.unit === 'kg' ? ing.quantity : ing.quantity / 1000;
                  const percentage = (weight / totalIngredientWeight) * 100;
                  return (
                    <div key={ing.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-500 w-4">{idx + 1}.</span>
                        <span className="text-sm text-slate-300 truncate">{ing.material_name}</span>
                        {ing.data_source === 'supplier' && (
                          <Badge variant="outline" className="text-xs bg-green-500/20 border-green-500/30 text-green-400">
                            <Building2 className="h-2.5 w-2.5 mr-1" />
                            Primary
                          </Badge>
                        )}
                        {ing.data_source === 'openlca' && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/20 border-yellow-500/30 text-yellow-400">
                            <Database className="h-2.5 w-2.5 mr-1" />
                            Secondary
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">
                          {weight.toFixed(2)} kg
                        </div>
                        <div className="text-xs text-slate-400">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
                {ingredients.length > 3 && (
                  <p className="text-xs text-slate-400 pt-2">
                    + {ingredients.length - 3} more ingredient{ingredients.length - 3 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Action Button */}
          <Link href={`/products/${productId}/recipe?tab=ingredients`}>
            <Button className={`w-full ${ingredients.length === 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white'}`}>
              {ingredients.length === 0 ? 'Add Ingredients' : 'Manage Ingredients'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Packaging Summary Card */}
      <Card className="backdrop-blur-xl bg-white/5 border border-white/10 border-l-4 border-l-orange-500 shadow-xl hover:bg-white/10 transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/80 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Packaging</CardTitle>
                <CardDescription className="text-slate-400">Material composition</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {packaging.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium mb-1 text-slate-300">No packaging added</p>
              <p className="text-xs text-slate-500">
                Add packaging materials to complete your product
              </p>
            </div>
          ) : (
            <>
              {/* Total Weight */}
              <div className="flex items-baseline justify-between pb-3 border-b border-white/10">
                <span className="text-sm text-slate-400">Total Packaging Weight</span>
                <span className="text-2xl font-bold text-white">
                  {totalPackagingWeight.toFixed(1)} <span className="text-base font-normal text-slate-400">g</span>
                </span>
              </div>

              {/* Primary Container */}
              {primaryContainer && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">Primary Container</h4>
                  <div className="flex items-center justify-between py-2 px-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-orange-400" />
                      <span className="text-sm font-medium text-slate-300">
                        {primaryContainer.material_name}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">
                      {primaryContainer.quantity} {primaryContainer.unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Component Count */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {['container', 'label', 'closure', 'secondary'].map(cat => {
                  const count = packaging.filter(p => p.packaging_category === cat).length;
                  return (
                    <div key={cat} className="text-center">
                      <div className="text-lg font-bold text-white">{count}</div>
                      <div className="text-xs text-slate-400 capitalize">{cat}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Action Button */}
          <Link href={`/products/${productId}/recipe?tab=packaging`}>
            <Button className={`w-full ${packaging.length === 0 ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white'}`}>
              {packaging.length === 0 ? 'Add Packaging' : 'Manage Packaging'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
