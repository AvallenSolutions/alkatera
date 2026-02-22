"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, CheckCircle2, AlertCircle, Layers } from "lucide-react";
import Image from "next/image";

interface ProductHeaderProps {
  product: {
    name: string;
    sku: string;
    image_url?: string;
    product_category?: string;
    is_multipack?: boolean;
  };
  isHealthy: boolean;
  onEdit: () => void;
}

export function ProductHeader({ product, isHealthy, onEdit }: ProductHeaderProps) {
  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-start gap-6">
          {/* Product Image */}
          <div className="flex-shrink-0">
            <div className="h-24 w-24 rounded-lg border bg-muted overflow-hidden shadow-lg">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  <span className="text-2xl font-bold">
                    {product.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-foreground truncate">
                    {product.name}
                  </h1>
                  {product.is_multipack && (
                    <Badge className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">
                      <Layers className="h-3 w-3 mr-1" />
                      Multipack
                    </Badge>
                  )}
                  {isHealthy ? (
                    <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready for Calculation
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Setup Incomplete
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {product.sku && (
                    <span className="font-mono">SKU: {product.sku}</span>
                  )}
                  {product.product_category && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{product.product_category}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <Button
                variant="outline"
                onClick={onEdit}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Product Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
