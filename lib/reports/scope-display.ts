// Shared display helpers for Scope 1/2/3 emissions charts.
//
// One source of truth for scope colours (so the trend and the breakdown agree)
// and plain-language labels for the GHG Protocol Scope 3 categories. The
// category numbers stay in `ghgCategory` for a tooltip; the visible label is
// jargon-free for a reader who is not a carbon accountant.

import type { Scope3Breakdown } from '@/lib/calculations/corporate-emissions';

/** Scope colours. Hex chosen to read in both light and dark mode. */
export const SCOPE_COLOURS = {
  scope1: '#f59e0b', // amber: direct emissions you burn
  scope2: '#38bdf8', // sky: bought energy
  scope3: '#a78bfa', // violet: the value chain
} as const;

export const SCOPE_LABELS = {
  scope1: 'Scope 1, direct',
  scope2: 'Scope 2, energy',
  scope3: 'Scope 3, value chain',
} as const;

/**
 * Canonical Scope 3 categories (the alias keys logistics/waste/marketing on
 * Scope3Breakdown are deliberately excluded to avoid double-counting). Order
 * is the display order before sorting by value.
 */
export interface Scope3CategoryMeta {
  key: keyof Scope3Breakdown;
  label: string;
  /** GHG Protocol Scope 3 category number, shown only in the tooltip. */
  ghgCategory: number;
}

export const SCOPE3_CATEGORIES: Scope3CategoryMeta[] = [
  { key: 'products', label: 'Ingredients and packaging you buy', ghgCategory: 1 },
  { key: 'capital_goods', label: 'Equipment and capital goods', ghgCategory: 2 },
  { key: 'upstream_transport', label: 'Bringing goods in', ghgCategory: 4 },
  { key: 'operational_waste', label: 'Waste from operations', ghgCategory: 5 },
  { key: 'business_travel', label: 'Business travel', ghgCategory: 6 },
  { key: 'employee_commuting', label: 'Staff commuting', ghgCategory: 7 },
  { key: 'purchased_services', label: 'Services you pay for', ghgCategory: 8 },
  { key: 'marketing_materials', label: 'Marketing materials', ghgCategory: 8 },
  { key: 'downstream_logistics', label: 'Getting products to customers', ghgCategory: 9 },
  { key: 'downstream_transport', label: 'Onward distribution', ghgCategory: 9 },
  { key: 'use_phase', label: 'Customers using the product', ghgCategory: 11 },
];

export interface Scope3Bar {
  key: string;
  label: string;
  ghgCategory: number;
  value: number;
  /** Share of total Scope 3, 0-100. */
  pct: number;
}

/**
 * Turn a Scope3Breakdown into sorted, non-zero bars (largest first) with each
 * category's share of the Scope 3 total. Pure, so it is unit-testable.
 */
export function scope3Bars(breakdown: Scope3Breakdown): Scope3Bar[] {
  const total = SCOPE3_CATEGORIES.reduce((sum, c) => sum + (Number(breakdown[c.key]) || 0), 0);
  return SCOPE3_CATEGORIES.map((c) => {
    const value = Number(breakdown[c.key]) || 0;
    return {
      key: String(c.key),
      label: c.label,
      ghgCategory: c.ghgCategory,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    };
  })
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Compact tonnes/kg formatter shared by the charts. */
export function formatCo2e(kg: number): string {
  if (!Number.isFinite(kg)) return '0';
  if (Math.abs(kg) >= 1000) {
    return `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`;
  }
  return `${Math.round(kg).toLocaleString('en-GB')} kg`;
}
