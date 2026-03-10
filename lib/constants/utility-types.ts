/**
 * Shared constants for utility, water, and waste data entry.
 * Single source of truth — imported by facility pages, log-data page, and DirectDataEntry.
 */

// =============================================================================
// Utility Types (Scope 1 & 2)
// =============================================================================

export interface UtilityType {
  value: string;
  label: string;
  defaultUnit: string;
  fuelType: string;
  scope: '1' | '2';
}

export const UTILITY_TYPES: UtilityType[] = [
  { value: 'electricity_grid', label: 'Purchased Electricity', defaultUnit: 'kWh', fuelType: 'grid_electricity', scope: '2' },
  { value: 'heat_steam_purchased', label: 'Purchased Heat / Steam', defaultUnit: 'kWh', fuelType: 'heat_steam', scope: '2' },
  { value: 'natural_gas', label: 'Natural Gas', defaultUnit: 'kWh', fuelType: 'natural_gas_kwh', scope: '1' },
  { value: 'natural_gas_m3', label: 'Natural Gas (by m³)', defaultUnit: 'm3', fuelType: 'natural_gas_m3', scope: '1' },
  { value: 'lpg', label: 'LPG (Propane/Butane)', defaultUnit: 'litre', fuelType: 'lpg_litre', scope: '1' },
  { value: 'diesel_stationary', label: 'Diesel (Generators/Stationary)', defaultUnit: 'litre', fuelType: 'diesel_stationary', scope: '1' },
  { value: 'heavy_fuel_oil', label: 'Heavy Fuel Oil', defaultUnit: 'litre', fuelType: 'heavy_fuel_oil', scope: '1' },
  { value: 'biomass_solid', label: 'Biogas / Biomass', defaultUnit: 'kg', fuelType: 'biomass_wood_chips', scope: '1' },
  { value: 'refrigerant_leakage', label: 'Refrigerants (Leakage)', defaultUnit: 'kg', fuelType: 'refrigerant_r410a', scope: '1' },
  { value: 'diesel_mobile', label: 'Company Fleet (Diesel)', defaultUnit: 'litre', fuelType: 'diesel_stationary', scope: '1' },
  { value: 'petrol_mobile', label: 'Company Fleet (Petrol/Gasoline)', defaultUnit: 'litre', fuelType: 'petrol', scope: '1' },
];

// =============================================================================
// Water Categories & Sources
// =============================================================================

export const WATER_CATEGORIES = [
  { value: 'water_intake', label: 'Water Intake', description: 'Fresh water consumed' },
  { value: 'water_discharge', label: 'Wastewater Discharge', description: 'Treated/untreated discharge' },
  { value: 'water_recycled', label: 'Recycled Water', description: 'Water reused on-site' },
] as const;

export const WATER_SOURCES = [
  { value: 'municipal', label: 'Municipal Supply' },
  { value: 'groundwater', label: 'Groundwater / Borehole' },
  { value: 'surface_water', label: 'Surface Water (River/Lake)' },
  { value: 'recycled', label: 'Recycled / Reclaimed' },
  { value: 'rainwater', label: 'Rainwater Harvesting' },
  { value: 'other', label: 'Other Source' },
] as const;

export const WATER_CLASSIFICATIONS = [
  { value: 'blue', label: 'Blue Water', description: 'Freshwater from surface or groundwater' },
  { value: 'green', label: 'Green Water', description: 'Rainwater stored in soil' },
  { value: 'grey', label: 'Grey Water', description: 'Wastewater from processes' },
] as const;

export const WATER_TREATMENT_METHODS = [
  { value: 'primary_treatment', label: 'Primary Treatment' },
  { value: 'secondary_treatment', label: 'Secondary Treatment' },
  { value: 'tertiary_treatment', label: 'Tertiary Treatment' },
  { value: 'none', label: 'No Treatment' },
  { value: 'unknown', label: 'Unknown' },
] as const;

// WRI Aqueduct AWARE protocol — extremely high baseline water stress
export const WATER_STRESSED_COUNTRIES = [
  'AE', 'AF', 'BH', 'DJ', 'DZ', 'EG', 'ER', 'IL', 'IN', 'IQ', 'IR', 'JO',
  'KW', 'LB', 'LY', 'MA', 'OM', 'PK', 'PS', 'QA', 'SA', 'SD', 'SY', 'TN',
  'YE', 'CN', 'MN', 'ES', 'GR', 'IT', 'MX', 'ZA',
] as const;

// =============================================================================
// Waste Categories & Treatment
// =============================================================================

export const WASTE_CATEGORIES = [
  { value: 'waste_general', label: 'General Waste', description: 'Non-hazardous, mixed waste' },
  { value: 'waste_hazardous', label: 'Hazardous Waste', description: 'Regulated hazardous materials' },
  { value: 'waste_recycling', label: 'Recycling Stream', description: 'Materials sent for recycling' },
] as const;

export const WASTE_TYPES = [
  { value: 'food_waste', label: 'Food Waste' },
  { value: 'packaging_waste', label: 'Packaging Waste' },
  { value: 'process_waste', label: 'Process / Industrial Waste' },
  { value: 'hazardous', label: 'Hazardous Materials' },
  { value: 'construction', label: 'Construction & Demolition' },
  { value: 'electronic', label: 'Electronic Waste (WEEE)' },
  { value: 'other', label: 'Other' },
] as const;

export const WASTE_TREATMENT_METHODS = [
  { value: 'landfill', label: 'Landfill', description: 'Sent to landfill disposal' },
  { value: 'recycling', label: 'Recycling', description: 'Material recovery and recycling' },
  { value: 'composting', label: 'Composting', description: 'Organic waste composting' },
  { value: 'incineration_with_recovery', label: 'Incineration (Energy Recovery)', description: 'Waste-to-energy' },
  { value: 'incineration_without_recovery', label: 'Incineration (No Recovery)', description: 'Destruction only' },
  { value: 'anaerobic_digestion', label: 'Anaerobic Digestion', description: 'Biogas production' },
  { value: 'reuse', label: 'Reuse', description: 'Direct reuse without processing' },
  { value: 'other', label: 'Other', description: 'Other treatment method' },
] as const;

export const HAZARD_CLASSIFICATIONS = [
  { value: 'non_hazardous', label: 'Non-Hazardous' },
  { value: 'hazardous', label: 'Hazardous' },
  { value: 'unknown', label: 'Unknown / Not Classified' },
] as const;

// =============================================================================
// Data Quality / Provenance
// =============================================================================

export const DATA_QUALITY_OPTIONS = [
  { value: 'primary_measured_onsite', label: 'Measured On-site', confidence: 90, color: 'bg-green-400' },
  { value: 'primary_supplier_verified', label: 'Supplier Verified', confidence: 95, color: 'bg-green-500' },
  { value: 'secondary_calculated_allocation', label: 'Allocated from Facility Total', confidence: 70, color: 'bg-amber-500' },
  { value: 'secondary_modelled_industry_average', label: 'Industry Average (Estimated)', confidence: 50, color: 'bg-red-400' },
] as const;

// =============================================================================
// Facility Activity Types (for secondary/estimated data)
// =============================================================================

export const FACILITY_ACTIVITY_TYPES = [
  { value: 'Soft Drinks Bottling', label: 'Soft Drinks Bottling', intensity: 0.15 },
  { value: 'Brewing', label: 'Brewing', intensity: 0.22 },
  { value: 'Distilling', label: 'Distilling', intensity: 0.35 },
  { value: 'Juice Processing', label: 'Juice Processing', intensity: 0.18 },
  { value: 'Dairy Processing', label: 'Dairy Processing', intensity: 0.25 },
] as const;

export const PRODUCTION_UNITS = [
  { value: 'Litres', label: 'Litres' },
  { value: 'Hectolitres', label: 'Hectolitres' },
  { value: 'Units', label: 'Units (individual products)' },
  { value: 'kg', label: 'Kilograms' },
] as const;
