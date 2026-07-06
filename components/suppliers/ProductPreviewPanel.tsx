'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Package,
  CheckCircle2,
  Cloud,
  Droplets,
  Recycle,
  Leaf,
  Globe,
  Tag,
  FileText,
  Wheat,
  Box,
  ExternalLink,
  Award,
  Hash,
  Weight,
} from 'lucide-react';

interface SupplierProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  product_type: 'ingredient' | 'packaging';
  weight_g: number | null;
  packaging_category: string | null;
  carbon_intensity: number | null;
  impact_climate: number | null;
  impact_water: number | null;
  impact_waste: number | null;
  impact_land: number | null;
  recycled_content_pct: number | null;
  product_code: string | null;
  product_image_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  origin_country_code: string | null;
  certifications: string[] | null;
  created_at: string;
}

interface ProductPreviewPanelProps {
  product: SupplierProduct;
}

const PILLAR_CONFIG = [
  {
    key: 'climate' as const,
    label: 'Climate',
    icon: Cloud,
    color: 'text-room-accent',
    bg: 'bg-card',
    border: 'border-border',
    unit: 'kg CO₂e',
  },
  {
    key: 'water' as const,
    label: 'Water',
    icon: Droplets,
    color: 'text-room-accent',
    bg: 'bg-card',
    border: 'border-border',
    unit: 'L',
  },
  {
    key: 'circularity' as const,
    label: 'Circularity',
    icon: Recycle,
    color: 'text-studio-attention',
    bg: 'bg-card',
    border: 'border-border',
    unit: '',
  },
  {
    key: 'nature' as const,
    label: 'Nature',
    icon: Leaf,
    color: 'text-studio-good',
    bg: 'bg-card',
    border: 'border-border',
    unit: 'pt',
  },
];

function getPillarValue(product: SupplierProduct, key: string): number | null {
  switch (key) {
    case 'climate':
      return product.impact_climate ?? product.carbon_intensity;
    case 'water':
      return product.impact_water;
    case 'circularity':
      return product.impact_waste ?? product.recycled_content_pct;
    case 'nature':
      return product.impact_land;
    default:
      return null;
  }
}

function formatPillarValue(value: number, key: string, product: SupplierProduct): string {
  if (key === 'circularity' && product.recycled_content_pct !== null && product.impact_waste === null) {
    return `${value}% recycled`;
  }
  return value.toFixed(2);
}

export default function ProductPreviewPanel({ product }: ProductPreviewPanelProps) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Product image and header */}
      <div className="flex items-start gap-4">
        {product.product_image_url ? (
          <div className="w-20 h-20 rounded-[6px] overflow-hidden flex-shrink-0 border border-border flex items-center justify-center bg-secondary">
            <img
              src={product.product_image_url}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-[6px] flex-shrink-0 flex items-center justify-center bg-secondary border border-border">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-foreground truncate">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {product.product_type === 'packaging' ? (
              <span className="inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <Box className="h-3 w-3 mr-1" />
                Packaging
              </span>
            ) : (
              <span className="inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <Wheat className="h-3 w-3 mr-1" />
                Ingredient
              </span>
            )}
            {product.is_verified && (
              <span className="inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-good">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </span>
            )}
            {!product.is_active && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">Inactive</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
      )}

      {/* Key details */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Key Details</h4>
        <div className="grid grid-cols-2 gap-3">
          {product.product_type === 'ingredient' && product.category && (
            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm text-foreground">{product.category}</p>
              </div>
            </div>
          )}
          {product.product_type === 'packaging' && product.packaging_category && (
            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Packaging Category</p>
                <p className="text-sm text-foreground capitalize">{product.packaging_category.replace('_', ' ')}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Weight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                {product.product_type === 'packaging' && product.weight_g ? 'Weight' : 'Unit'}
              </p>
              <p className="text-sm text-foreground">
                {product.product_type === 'packaging' && product.weight_g
                  ? `${product.weight_g}g per unit`
                  : product.unit}
              </p>
            </div>
          </div>
          {product.origin_country_code && (
            <div className="flex items-start gap-2">
              <Globe className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Origin</p>
                <p className="text-sm text-foreground">{product.origin_country_code}</p>
              </div>
            </div>
          )}
          {product.product_code && (
            <div className="flex items-start gap-2">
              <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Product Code</p>
                <p className="text-sm text-foreground font-mono text-xs">{product.product_code}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Impact data */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Impact Data</h4>
        <div className="grid grid-cols-2 gap-2">
          {PILLAR_CONFIG.map((pillar) => {
            const value = getPillarValue(product, pillar.key);
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.key}
                className={`rounded-[6px] border p-3 ${
                  value !== null
                    ? `${pillar.bg} ${pillar.border}`
                    : 'bg-secondary border-border'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${value !== null ? pillar.color : 'text-muted-foreground/50'}`} />
                  <span className={`text-xs font-medium ${value !== null ? pillar.color : 'text-muted-foreground/50'}`}>
                    {pillar.label}
                  </span>
                </div>
                {value !== null ? (
                  <p className="text-sm font-semibold text-foreground">
                    {formatPillarValue(value, pillar.key, product)}
                    {pillar.unit && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">{pillar.unit}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/50">No data</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Certifications */}
      {product.certifications && product.certifications.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Certifications</h4>
          <div className="flex flex-wrap gap-2">
            {product.certifications.map((cert) => (
              <span
                key={cert}
                className="inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent"
              >
                <Award className="h-3 w-3 mr-1" />
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* View Full Details button */}
      <div className="pt-2">
        <Button asChild className="w-full">
          <Link href={`/supplier-portal/products/${product.id}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Details
          </Link>
        </Button>
      </div>
    </div>
  );
}
