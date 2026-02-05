/**
 * OpenLCA Schema TypeScript Definitions
 * Based on https://greendelta.github.io/olca-schema/
 *
 * Comprehensive type definitions for programmatic LCA with OpenLCA gdt-server REST API
 * Reference: https://github.com/GreenDelta/gdt-server
 */

/**
 * Base reference object used throughout OpenLCA schema
 */
export interface Ref {
  '@type': string;
  '@id': string;
  name?: string;
  description?: string;
  category?: string;
}

/**
 * Flow Types in OpenLCA
 */
export enum FlowType {
  ELEMENTARY_FLOW = 'ELEMENTARY_FLOW',
  PRODUCT_FLOW = 'PRODUCT_FLOW',
  WASTE_FLOW = 'WASTE_FLOW'
}

/**
 * Process Types in OpenLCA
 */
export enum ProcessType {
  UNIT_PROCESS = 'UNIT_PROCESS',
  SYSTEM_PROCESS = 'SYSTEM_PROCESS'
}

/**
 * Calculation Types
 */
export enum CalculationType {
  SIMPLE_CALCULATION = 'SIMPLE_CALCULATION',
  CONTRIBUTION_ANALYSIS = 'CONTRIBUTION_ANALYSIS',
  UPSTREAM_ANALYSIS = 'UPSTREAM_ANALYSIS',
  MONTE_CARLO_SIMULATION = 'MONTE_CARLO_SIMULATION'
}

/**
 * Provider Linking Strategy for Product System Building
 */
export enum ProviderLinking {
  PREFER_DEFAULTS = 'PREFER_DEFAULTS',
  ONLY_DEFAULTS = 'ONLY_DEFAULTS',
  IGNORE_DEFAULTS = 'IGNORE_DEFAULTS'
}

/**
 * Allocation Method
 */
export enum AllocationType {
  PHYSICAL_ALLOCATION = 'PHYSICAL_ALLOCATION',
  ECONOMIC_ALLOCATION = 'ECONOMIC_ALLOCATION',
  CAUSAL_ALLOCATION = 'CAUSAL_ALLOCATION',
  USE_DEFAULT_ALLOCATION = 'USE_DEFAULT_ALLOCATION',
  NO_ALLOCATION = 'NO_ALLOCATION'
}

/**
 * Unit Reference
 */
export interface Unit {
  '@type': 'Unit';
  '@id': string;
  name: string;
  description?: string;
  conversionFactor?: number;
  referenceUnit?: boolean;
  synonyms?: string[];
}

/**
 * Unit Group (e.g., Units of mass, Units of energy)
 */
export interface UnitGroup {
  '@type': 'UnitGroup';
  '@id': string;
  name: string;
  description?: string;
  category?: string;
  units?: Unit[];
  defaultFlowProperty?: Ref;
}

/**
 * Flow Property (e.g., Mass, Energy, Volume)
 */
export interface FlowProperty {
  '@type': 'FlowProperty';
  '@id': string;
  name: string;
  description?: string;
  category?: string;
  flowPropertyType?: 'ECONOMIC_QUANTITY' | 'PHYSICAL_QUANTITY';
  unitGroup?: Ref;
}

/**
 * Location/Geography
 */
export interface Location {
  '@type': 'Location';
  '@id': string;
  name: string;
  code?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Flow - Represents materials, energy, or services
 */
export interface Flow {
  '@type': 'Flow';
  '@id': string;
  name: string;
  description?: string;
  category?: string;
  flowType: FlowType;
  cas?: string;
  formula?: string;
  flowProperties?: FlowPropertyFactor[];
  location?: Ref;
  synonyms?: string[];
}

/**
 * Flow Property Factor - Links a flow to its properties
 */
export interface FlowPropertyFactor {
  '@type': 'FlowPropertyFactor';
  flowProperty: Ref;
  conversionFactor: number;
  referenceFlowProperty: boolean;
}

/**
 * Exchange - Connection between a Process and a Flow
 */
export interface Exchange {
  '@type': 'Exchange';
  '@id'?: string;
  avoidedProduct?: boolean;
  flow: Ref;
  flowProperty?: Ref;
  unit?: Ref;
  amount?: number;
  amountFormula?: string;
  isInput: boolean;
  quantitativeReference?: boolean;
  baseUncertainty?: number;
  costFormula?: string;
  costValue?: number;
  currency?: Ref;
  description?: string;
  dqEntry?: string;
  location?: Ref;
  uncertainty?: Uncertainty;
  defaultProvider?: Ref;
}

/**
 * Uncertainty Distribution
 */
export interface Uncertainty {
  '@type': 'Uncertainty';
  distributionType: 'NORMAL_DISTRIBUTION' | 'LOG_NORMAL_DISTRIBUTION' |
                    'UNIFORM_DISTRIBUTION' | 'TRIANGLE_DISTRIBUTION';
  mean?: number;
  meanFormula?: string;
  sd?: number;
  sdFormula?: string;
  minimum?: number;
  maximum?: number;
  mode?: number;
  geomMean?: number;
  geomSd?: number;
}

/**
 * Process - The core transformation unit
 */
export interface Process {
  '@type': 'Process';
  '@id': string;
  name: string;
  description?: string;
  category?: string;
  processType: ProcessType;
  exchanges?: Exchange[];
  location?: Ref;
  processDocumentation?: ProcessDocumentation;
  dqSystem?: Ref;
  exchangeDqSystem?: Ref;
  socialDqSystem?: Ref;
  parameters?: Parameter[];
  allocationFactors?: AllocationFactor[];
  defaultAllocationMethod?: AllocationType;
  infrastructureProcess?: boolean;
  lastChange?: string;
  tags?: string[];
  version?: string;
}

/**
 * Process Documentation
 */
export interface ProcessDocumentation {
  '@type': 'ProcessDocumentation';
  copyright?: boolean;
  creationDate?: string;
  dataCollectionPeriod?: string;
  dataDocumentor?: Ref;
  dataGenerator?: Ref;
  dataSetOwner?: Ref;
  intendedApplication?: string;
  inventoryMethod?: string;
  modeling?: string;
  project?: Ref;
  publication?: Ref;
  reviewDetails?: string;
  reviewer?: Ref;
  sampling?: string;
  sources?: Ref[];
  technology?: string;
  time?: string;
  validFrom?: string;
  validUntil?: string;
}

/**
 * Parameter for calculations
 */
export interface Parameter {
  '@type': 'Parameter';
  '@id': string;
  name: string;
  description?: string;
  isInputParameter?: boolean;
  value?: number;
  formula?: string;
  uncertainty?: Uncertainty;
}

/**
 * Allocation Factor
 */
export interface AllocationFactor {
  '@type': 'AllocationFactor';
  allocationType: AllocationType;
  product?: Ref;
  value?: number;
  formula?: string;
  exchange?: Exchange;
}

/**
 * Product System - The execution graph
 */
export interface ProductSystem {
  '@type': 'ProductSystem';
  '@id': string;
  name: string;
  description?: string;
  category?: string;
  referenceProcess?: Ref;
  referenceExchange?: Exchange;
  targetAmount?: number;
  targetUnit?: Ref;
  targetFlowProperty?: Ref;
  processes?: Ref[];
  processLinks?: ProcessLink[];
  parameterSets?: ParameterRedefSet[];
}

/**
 * Process Link - Connects provider to recipient in product system
 */
export interface ProcessLink {
  '@type': 'ProcessLink';
  provider: Ref;
  flow: Ref;
  process: Ref;
  exchange?: Exchange;
}

/**
 * Parameter Redefinition Set
 */
export interface ParameterRedefSet {
  '@type': 'ParameterRedefSet';
  name: string;
  description?: string;
  isBaseline?: boolean;
  parameters?: ParameterRedef[];
}

/**
 * Parameter Redefinition
 */
export interface ParameterRedef {
  '@type': 'ParameterRedef';
  name: string;
  value?: number;
  uncertainty?: Uncertainty;
  context?: Ref;
}

/**
 * Impact Category
 */
export interface ImpactCategory {
  '@type': 'ImpactCategory';
  '@id': string;
  name: string;
  description?: string;
  category?: string;
  referenceUnitName?: string;
  impactFactors?: ImpactFactor[];
  parameters?: Parameter[];
}

/**
 * Impact Factor - Characterization factor
 */
export interface ImpactFactor {
  '@type': 'ImpactFactor';
  flow: Ref;
  flowProperty?: Ref;
  unit?: Ref;
  location?: Ref;
  value: number;
  formula?: string;
  uncertainty?: Uncertainty;
}

/**
 * Impact Method (e.g., IPCC 2021, AWARE)
 */
export interface ImpactMethod {
  '@type': 'ImpactMethod';
  '@id': string;
  name: string;
  description?: string;
  category?: string;
  impactCategories?: Ref[];
  nwSets?: NwSet[];
}

/**
 * Normalization and Weighting Set
 */
export interface NwSet {
  '@type': 'NwSet';
  '@id': string;
  name: string;
  description?: string;
  weightedScoreUnit?: string;
  factors?: NwFactor[];
}

/**
 * Normalization and Weighting Factor
 */
export interface NwFactor {
  '@type': 'NwFactor';
  impactCategory: Ref;
  normalisationFactor?: number;
  weightingFactor?: number;
}

/**
 * Linking Configuration for Product System Building
 */
export interface LinkingConfig {
  preferUnitProcesses?: boolean;
  providerLinking?: ProviderLinking;
  cutoff?: number;
}

/**
 * Calculation Setup
 */
export interface CalculationSetup {
  '@type': 'CalculationSetup';
  calculationType: CalculationType;
  productSystem: Ref;
  impactMethod?: Ref;
  nwSet?: Ref;
  amount?: number;
  unit?: Ref;
  flowProperty?: Ref;
  withCosts?: boolean;
  withRegionalization?: boolean;
  allocationMethod?: AllocationType;
  parameterRedefs?: ParameterRedef[];
  numberOfRuns?: number;
}

/**
 * Simple Result - Total impacts only
 */
export interface SimpleResult {
  '@type': 'SimpleResult';
  '@id': string;
  impactResults?: ImpactResult[];
  flowResults?: FlowResult[];
  totalRequirements?: TechFlowValue[];
  totalCosts?: number;
}

/**
 * Impact Result
 * Note: OpenLCA 2.x returns 'amount', older versions used 'value'
 */
export interface ImpactResult {
  '@type'?: 'ImpactResult';
  impactCategory?: Ref;
  amount?: number; // OpenLCA 2.x
  value?: number;  // Legacy
}

/**
 * Flow Result
 */
export interface FlowResult {
  '@type': 'FlowResult';
  flow: Ref;
  flowProperty?: Ref;
  unit?: Ref;
  input?: boolean;
  value: number;
  location?: Ref;
}

/**
 * Tech Flow Value - Process contribution
 */
export interface TechFlowValue {
  '@type': 'TechFlowValue';
  provider: Ref;
  flow: Ref;
  value: number;
}

/**
 * Contribution Result - With analysis
 */
export interface ContributionResult extends Omit<SimpleResult, '@type'> {
  '@type': 'ContributionResult';
  contributions?: Contribution[];
}

/**
 * Contribution
 */
export interface Contribution {
  '@type': 'Contribution';
  techFlow: TechFlowValue;
  amount: number;
  share: number;
  rest: boolean;
}

/**
 * Upstream Tree Node for Hotspot Analysis
 */
export interface UpstreamNode {
  '@type': 'UpstreamNode';
  provider: Ref;
  requirementValue: number;
  result: number;
  children?: UpstreamNode[];
}

/**
 * Upstream Tree
 */
export interface UpstreamTree {
  '@type': 'UpstreamTree';
  ref: Ref;
  root: UpstreamNode;
}

/**
 * Result reference for disposal
 */
export interface ResultRef {
  '@type': 'ResultRef';
  '@id': string;
}
