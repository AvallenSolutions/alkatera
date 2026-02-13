/**
 * EPR Compliance Tool — Public API
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Mappings
export {
  mapActivityToRPD,
  mapRPDToActivity,
  mapMaterialToRPD,
  deriveMaterialSubtype,
  mapNationToRPD,
  mapRPDToNation,
  mapRAMRatingToRPD,
  derivePackagingType,
  derivePackagingClass,
  categoryToPackagingLevel,
} from './mappings';

// Fee Calculator
export {
  calculateLineFee,
  getApplicableRate,
  findFeeRate,
} from './fee-calculator';

// Obligation Checker
export { checkObligation } from './obligation-checker';

// Drinks Container Rules
export {
  isDRSExcluded,
  isGlassDrinksContainer,
  isAggregatedDrinksContainer,
  extractComponentWeights,
  processContainerComponents,
} from './drinks-container-rules';

// CSV Generator
export {
  generateRPDCSV,
  calculateCSVChecksum,
  validateSubmissionLine,
} from './csv-generator';

// Validation
export {
  checkMissingFields,
  assessDataCompleteness,
  isSubmissionReady,
} from './validation';

// Nation Estimator
export {
  postcodeToNation,
  estimateFromAddresses,
  populationWeightedFallback,
} from './nation-estimator';

// PRN Calculator
export {
  calculateObligationTonnage,
  determinePRNStatus,
  remainingObligation,
  calculatePRNCost,
  totalPRNSpend,
  overallFulfilmentPct,
  buildPRNObligations,
} from './prn-calculator';
