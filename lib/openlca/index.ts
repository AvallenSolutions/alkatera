/**
 * OpenLCA Integration Module
 * Complete toolkit for automated LCA calculations with Ecoinvent database
 */

export * from './schema';
export * from './client';
export * from './recipe-builder';
export * from './calculator';

export { OpenLCAClient, createOpenLCAClient } from './client';
export { RecipeBuilder, convertMaterialsToRecipe } from './recipe-builder';
export { OpenLCACalculator } from './calculator';

export type {
  DrinkRecipe,
  RecipeIngredient,
  RecipePackaging,
  RecipeTransport,
  ValidationResult,
} from './recipe-builder';

export type {
  CalculationOptions,
  LCAResult,
  GHGBreakdown,
  ImpactMethodConfig,
} from './calculator';
