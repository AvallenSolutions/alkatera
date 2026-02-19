"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Package, ArrowRight, Building2, Database, Wine } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { ProductIngredient, ProductPackaging } from "@/hooks/data/useProductData";
import type { MaturationProfile } from "@/lib/types/maturation";
import {
  BARREL_TYPE_LABELS,
  CLIMATE_ZONE_LABELS,
} from "@/lib/types/maturation";
import { calculateMaturationImpacts } from "@/lib/maturation-calculator";

interface SpecificationTabProps {
  productId: string;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  onManageIngredients?: () => void;
  onManagePackaging?: () => void;
}

export function SpecificationTab({ productId, ingredients, packaging, onManageIngredients, onManagePackaging }: SpecificationTabProps) {
  const [maturationProfile, setMaturationProfile] = useState<MaturationProfile | null>(null);

  useEffect(() => {
    async function fetchMaturation() {
      const { data } = await supabase
        .from("maturation_profiles")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      setMaturationProfile(data as MaturationProfile | null);
    }
    fetchMaturation();
  }, [productId]);

  const maturationImpacts = maturationProfile
    ? calculateMaturationImpacts(maturationProfile)
    : null;

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

  // Calculate total packaging weight (convert to grams if needed)
  const totalPackagingWeight = packaging.reduce((sum, pkg) => {
    // If unit is kg, convert to grams; otherwise assume already in grams
    const weightInGrams = pkg.unit === 'kg' ? pkg.quantity * 1000 : pkg.quantity;
    return sum + weightInGrams;
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
                  {totalIngredientWeight < 0.01
                    ? <>{(totalIngredientWeight * 1000).toFixed(1)} <span className="text-base font-normal text-slate-400">g</span></>
                    : <>{totalIngredientWeight.toFixed(2)} <span className="text-base font-normal text-slate-400">kg</span></>}
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
                        {ing.matched_source_name && ing.matched_source_name !== ing.material_name && (
                          <Badge variant="outline" className="text-xs bg-amber-500/20 border-amber-500/30 text-amber-400 shrink-0">
                            Proxy
                          </Badge>
                        )}
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
                          {weight < 0.01
                            ? `${(weight * 1000).toFixed(1)} g`
                            : `${weight.toFixed(2)} kg`}
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
          {onManageIngredients ? (
            <Button
              onClick={onManageIngredients}
              className={`w-full ${ingredients.length === 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white'}`}
            >
              {ingredients.length === 0 ? 'Add Ingredients' : 'Manage Ingredients'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Link href={`/products/${productId}/recipe?tab=ingredients`}>
              <Button className={`w-full ${ingredients.length === 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white'}`}>
                {ingredients.length === 0 ? 'Add Ingredients' : 'Manage Ingredients'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
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
                      {primaryContainer.matched_source_name && primaryContainer.matched_source_name !== primaryContainer.material_name && (
                        <Badge variant="outline" className="text-xs bg-amber-500/20 border-amber-500/30 text-amber-400 shrink-0">
                          Proxy
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-slate-400">
                      {(() => {
                        // Display weights under 1kg in grams for better readability
                        if (primaryContainer.unit === 'kg' && primaryContainer.quantity < 1) {
                          return `${(primaryContainer.quantity * 1000).toFixed(0)}g`;
                        }
                        return `${primaryContainer.quantity.toFixed(2)} ${primaryContainer.unit}`;
                      })()}
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
          {onManagePackaging ? (
            <Button
              onClick={onManagePackaging}
              className={`w-full ${packaging.length === 0 ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white'}`}
            >
              {packaging.length === 0 ? 'Add Packaging' : 'Manage Packaging'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Link href={`/products/${productId}/recipe?tab=packaging`}>
              <Button className={`w-full ${packaging.length === 0 ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white'}`}>
                {packaging.length === 0 ? 'Add Packaging' : 'Manage Packaging'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Maturation Summary Card (only shown if profile exists) */}
      {maturationProfile && maturationImpacts && (
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 border-l-4 border-l-amber-500 shadow-xl hover:bg-white/10 transition-all md:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/80 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                  <Wine className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white">Maturation</CardTitle>
                  <CardDescription className="text-slate-400">Barrel aging profile</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-amber-500/20 border-amber-500/30 text-amber-400">
                {(maturationProfile.aging_duration_months / 12).toFixed(1)} years
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-1">Barrel Type</div>
                <div className="text-sm font-medium text-white">
                  {BARREL_TYPE_LABELS[maturationProfile.barrel_type] || maturationProfile.barrel_type}
                </div>
                <div className="text-xs text-slate-500">
                  {maturationProfile.barrel_use_number === 1 ? 'New barrel' : `${maturationProfile.barrel_use_number}${maturationProfile.barrel_use_number === 2 ? 'nd' : 'rd+'} fill`}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Climate Zone</div>
                <div className="text-sm font-medium text-white">
                  {CLIMATE_ZONE_LABELS[maturationProfile.climate_zone] || maturationProfile.climate_zone}
                </div>
                <div className="text-xs text-slate-500">
                  Angel&apos;s share: {maturationProfile.angel_share_percent_per_year}%/yr
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Volume Loss</div>
                <div className="text-sm font-medium text-amber-400">
                  {maturationImpacts.angel_share_loss_percent_total.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500">
                  {maturationImpacts.angel_share_volume_loss_litres.toFixed(1)} L lost
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Maturation CO2e</div>
                <div className="text-sm font-medium text-white">
                  {maturationImpacts.total_maturation_co2e.toFixed(2)} kg
                </div>
                <div className="text-xs text-slate-500">
                  {maturationImpacts.total_maturation_co2e_per_litre_output.toFixed(3)} kg/L output
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
