"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, FileText, Award, Image as ImageIcon, Box } from "lucide-react";
import Image from "next/image";
import type { Product } from "@/hooks/data/useProductData";

interface OverviewTabProps {
  product: Product;
}

export function OverviewTab({ product }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Image Card */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-500 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Product Image</CardTitle>
              <CardDescription>Visual representation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {product.image_url ? (
            <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 border">
              <Image
                src={product.image_url}
                alt={product.name}
                width={400}
                height={400}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-900 border flex items-center justify-center">
              <div className="text-center">
                <Package className="h-16 w-16 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No image uploaded</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Details Card */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>Core product information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Product Name</Label>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {product.name}
              </p>
            </div>

            {product.sku && (
              <div>
                <Label>SKU</Label>
                <p className="text-lg font-mono font-medium text-slate-900 dark:text-slate-100">
                  {product.sku}
                </p>
              </div>
            )}

            {product.product_category && (
              <div>
                <Label>Category</Label>
                <Badge variant="secondary" className="text-sm">
                  {product.product_category}
                </Badge>
              </div>
            )}

            {product.functional_unit && (
              <div>
                <Label>Functional Unit</Label>
                <p className="text-base text-slate-900 dark:text-slate-100">
                  {product.functional_unit_quantity && (
                    <span className="font-semibold">{product.functional_unit_quantity} </span>
                  )}
                  {product.functional_unit}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <Label>Description</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                {product.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certifications Card */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Certifications & Awards</CardTitle>
              <CardDescription>Product accreditations and recognitions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <Award className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium mb-1">No certifications added</p>
            <p className="text-xs text-slate-400">
              Edit product details to add certifications and awards
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
      {children}
    </span>
  );
}
