// Duplicate Detection and Data Quality for Gaia
// Detects and consolidates duplicate entries, provides quality indicators

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  has_lca?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DuplicateGroup {
  products: Product[];
  isDuplicate: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: 'unique' | 'exact_match' | 'different_skus' | 'different_versions' | 'similar_names';
}

export interface DataQualityResult {
  overall: 'high' | 'medium' | 'low';
  issues: DataQualityIssue[];
  duplicateCount: number;
  uniqueCount: number;
}

export interface DataQualityIssue {
  type: 'duplicate' | 'missing_data' | 'outdated' | 'inconsistent';
  severity: 'high' | 'medium' | 'low';
  message: string;
  affectedItems?: string[];
}

/**
 * Normalize a product name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 1;

  // Simple Jaccard similarity on words
  const wordsArr1 = s1.split(' ');
  const wordsArr2 = s2.split(' ');
  const words1 = new Set(wordsArr1);
  const words2 = new Set(wordsArr2);

  // Calculate intersection
  const intersectionArr = wordsArr1.filter((x) => words2.has(x));
  const intersectionSize = new Set(intersectionArr).size;

  // Calculate union
  const unionArr = wordsArr1.concat(wordsArr2);
  const unionSize = new Set(unionArr).size;

  return intersectionSize / unionSize;
}

/**
 * Detect duplicate products in a list
 */
export function detectDuplicates(products: Product[]): DuplicateGroup[] {
  const groups: Map<string, Product[]> = new Map();

  // First pass: Group by normalized name
  products.forEach((product) => {
    const key = normalizeName(product.name);
    const existing = groups.get(key) || [];
    groups.set(key, [...existing, product]);
  });

  // Second pass: Also check for similar names (>80% similarity)
  const exactGroups = Array.from(groups.entries());

  // Analyze each group
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [, group] of exactGroups) {
    if (group.length === 1) {
      duplicateGroups.push({
        products: group,
        isDuplicate: false,
        confidence: 'high',
        reason: 'unique',
      });
      continue;
    }

    // Multiple products with same/similar name - analyze further
    const hasDifferentSKUs = hasDistinctSKUs(group);
    const hasDifferentVersions = hasVersionDifferences(group);

    if (hasDifferentSKUs) {
      // Products with different SKUs are likely intentionally different
      duplicateGroups.push({
        products: group,
        isDuplicate: false,
        confidence: 'medium',
        reason: 'different_skus',
      });
    } else if (hasDifferentVersions) {
      // Different update times suggest version history
      duplicateGroups.push({
        products: group,
        isDuplicate: false,
        confidence: 'high',
        reason: 'different_versions',
      });
    } else {
      // Likely duplicates
      duplicateGroups.push({
        products: group,
        isDuplicate: true,
        confidence: 'high',
        reason: 'exact_match',
      });
    }
  }

  return duplicateGroups;
}

/**
 * Check if products have distinct SKUs
 */
function hasDistinctSKUs(products: Product[]): boolean {
  const skus = products.map((p) => p.sku).filter(Boolean);
  if (skus.length < 2) return false;
  const uniqueSKUs = new Set(skus);
  return uniqueSKUs.size > 1;
}

/**
 * Check if products appear to be different versions based on dates
 */
function hasVersionDifferences(products: Product[]): boolean {
  const dates = products
    .map((p) => p.updated_at || p.created_at)
    .filter(Boolean)
    .map((d) => new Date(d).getTime());

  if (dates.length < 2) return false;

  const uniqueDates = new Set(dates);

  // If dates are at least 1 day apart, consider them different versions
  const sortedDates = Array.from(uniqueDates).sort();
  if (sortedDates.length > 1) {
    const dayInMs = 24 * 60 * 60 * 1000;
    const timeDiff = sortedDates[sortedDates.length - 1] - sortedDates[0];
    return timeDiff > dayInMs;
  }

  return false;
}

/**
 * Format product list with duplicate awareness
 */
export function formatProductList(duplicateGroups: DuplicateGroup[]): string {
  const lines: string[] = [];

  for (const group of duplicateGroups) {
    const { products, isDuplicate, reason } = group;

    if (products.length === 1) {
      // Single product
      const p = products[0];
      lines.push(`- ${p.name}${p.sku ? ` (SKU: ${p.sku})` : ''}`);
      continue;
    }

    // Multiple products with same name
    if (isDuplicate) {
      // Show as consolidated with duplicate warning
      lines.push(`- ${products[0].name} **(${products.length} duplicate entries detected)**`);
    } else if (reason === 'different_versions') {
      // Show as versions
      const sorted = products.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
      );
      const latest = sorted[0];
      const dateStr = formatDate(latest.updated_at || latest.created_at);
      lines.push(`- ${latest.name} (${products.length} versions, latest: ${dateStr})`);
    } else if (reason === 'different_skus') {
      // Show all with SKUs
      for (const p of products) {
        lines.push(`- ${p.name}${p.sku ? ` (SKU: ${p.sku})` : ''}`);
      }
    } else {
      // Uncertain - show with warning
      lines.push(`- ${products[0].name} **(${products.length} similar entries - may need review)**`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Assess overall data quality for a set of products
 */
export function assessDataQuality(products: Product[]): DataQualityResult {
  const duplicateGroups = detectDuplicates(products);
  const issues: DataQualityIssue[] = [];

  let duplicateCount = 0;
  let uniqueCount = 0;

  for (const group of duplicateGroups) {
    if (group.isDuplicate) {
      duplicateCount += group.products.length - 1; // Count extra entries as duplicates
      uniqueCount += 1;
      issues.push({
        type: 'duplicate',
        severity: 'medium',
        message: `${group.products.length} duplicate entries for "${group.products[0].name}"`,
        affectedItems: group.products.map((p) => p.id),
      });
    } else {
      uniqueCount += group.products.length;
    }
  }

  // Check for products missing LCA
  const missingLca = products.filter((p) => !p.has_lca);
  if (missingLca.length > 0 && missingLca.length > products.length * 0.5) {
    issues.push({
      type: 'missing_data',
      severity: 'low',
      message: `${missingLca.length} products are missing LCA calculations`,
      affectedItems: missingLca.map((p) => p.id),
    });
  }

  // Determine overall quality
  let overall: 'high' | 'medium' | 'low';
  const highSeverityCount = issues.filter((i) => i.severity === 'high').length;
  const mediumSeverityCount = issues.filter((i) => i.severity === 'medium').length;

  if (highSeverityCount > 0) {
    overall = 'low';
  } else if (mediumSeverityCount > 2) {
    overall = 'medium';
  } else if (mediumSeverityCount > 0) {
    overall = 'medium';
  } else {
    overall = 'high';
  }

  return {
    overall,
    issues,
    duplicateCount,
    uniqueCount,
  };
}

/**
 * Get a summary of data quality issues
 */
export function getDataQualitySummary(result: DataQualityResult): string {
  if (result.issues.length === 0) {
    return 'Data quality is good. No issues detected.';
  }

  const lines: string[] = [];
  lines.push(`Data Quality: ${result.overall.toUpperCase()}`);
  lines.push('');

  if (result.duplicateCount > 0) {
    lines.push(`- ${result.duplicateCount} duplicate entries detected`);
  }

  for (const issue of result.issues) {
    if (issue.type !== 'duplicate') {
      lines.push(`- ${issue.message}`);
    }
  }

  return lines.join('\n');
}
