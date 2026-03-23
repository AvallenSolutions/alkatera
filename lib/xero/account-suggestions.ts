/**
 * Smart account mapping suggestions.
 *
 * Suggests emission categories for Xero accounts based on
 * keyword matching against the account name. Designed for the
 * drinks industry (breweries, distilleries, wineries).
 */

const SUGGESTION_RULES: Array<{ keywords: string[]; category: string }> = [
  // Energy
  { keywords: ['electricity', 'electric'], category: 'grid_electricity' },
  { keywords: ['natural gas', 'gas bill', 'gas supply'], category: 'natural_gas' },
  { keywords: ['diesel'], category: 'diesel_mobile' },
  { keywords: ['petrol', 'gasoline'], category: 'petrol_mobile' },
  { keywords: ['lpg', 'propane'], category: 'lpg' },
  { keywords: ['water rate', 'water supply', 'water bill'], category: 'water' },

  // Travel & Accommodation
  { keywords: ['flight', 'airline', 'air travel', 'airfare'], category: 'air_travel' },
  { keywords: ['rail', 'train', 'railway'], category: 'rail_travel' },
  { keywords: ['hotel', 'accommodation', 'airbnb', 'lodging'], category: 'accommodation' },

  // Freight & Logistics
  { keywords: ['freight', 'haulage', 'shipping', 'logistics', 'distribution'], category: 'road_freight' },
  { keywords: ['courier', 'parcel', 'dhl', 'royal mail', 'fedex', 'ups'], category: 'courier' },

  // Supply Chain
  { keywords: ['packaging', 'bottles', 'cans', 'labels', 'carton', 'box'], category: 'packaging' },
  { keywords: ['ingredients', 'malt', 'hops', 'grain', 'sugar', 'fruit', 'raw material', 'barley', 'yeast', 'grape'], category: 'raw_materials' },

  // Waste
  { keywords: ['waste', 'skip hire', 'refuse', 'recycling', 'disposal'], category: 'waste' },

  // Broader matches (lower priority, checked last)
  { keywords: ['fuel'], category: 'diesel_mobile' },
  { keywords: ['travel'], category: 'air_travel' },
  { keywords: ['water'], category: 'water' },
]

/**
 * Suggest an emission category for a Xero account based on its name.
 * Returns the first matching category or null if no match found.
 */
export function suggestCategory(accountName: string): string | null {
  if (!accountName) return null
  const lower = accountName.toLowerCase()

  for (const rule of SUGGESTION_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        return rule.category
      }
    }
  }

  return null
}
