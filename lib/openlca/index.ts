/**
 * OpenLCA Integration Module
 * Complete toolkit for automated LCA calculations with Ecoinvent database
 *
 * Key Components:
 * - OpenLCAClient: REST API client for OpenLCA gdt-server
 * - OpenLCACalculator: High-level calculation orchestration
 * - RecipeBuilder: Convert drink recipes to OpenLCA processes
 * - ImpactFactorResolver: Resolve impacts from OpenLCA for waterfall resolver
 */

export * from './schema';
export * from './client';
export * from './recipe-builder';
export * from './calculator';
export * from './impact-factor-resolver';
export * from './drinks-process-filter';
export * from './drinks-aliases';

export { OpenLCAClient, createOpenLCAClient, createOpenLCAClientForDatabase, resolveServerConfig } from './client';
export { RecipeBuilder, convertMaterialsToRecipe } from './recipe-builder';
export { OpenLCACalculator } from './calculator';
export {
  resolveOpenLCAImpacts,
  isOpenLCAEnabled,
  getOpenLCAConfig,
} from './impact-factor-resolver';

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

export type {
  OpenLCAResolverConfig,
  OpenLCAImpactData,
} from './impact-factor-resolver';
