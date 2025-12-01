/**
 * Recipe Builder - Dynamic OpenLCA Process Creation
 * Transforms drink recipes into OpenLCA Unit Processes for calculation
 */

import {
  Process,
  ProcessType,
  Exchange,
  FlowType,
  Ref,
} from './schema';
import { OpenLCAClient } from './client';

const uuidv4 = () => crypto.randomUUID();

/**
 * Recipe ingredient with OpenLCA linkage
 */
export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  openlcaProcessId?: string;
  openlcaFlowId?: string;
  location?: string;
  isOrganic?: boolean;
  notes?: string;
}

/**
 * Recipe packaging material
 */
export interface RecipePackaging {
  name: string;
  amount: number;
  unit: string;
  openlcaProcessId?: string;
  openlcaFlowId?: string;
  location?: string;
  recycledContent?: number;
  notes?: string;
}

/**
 * Transport specification
 */
export interface RecipeTransport {
  mode: 'truck' | 'train' | 'ship' | 'air';
  distanceKm: number;
  openlcaProcessId?: string;
}

/**
 * Complete recipe definition
 */
export interface DrinkRecipe {
  productName: string;
  functionalUnit: string;
  functionalUnitAmount: number;
  description?: string;
  ingredients: RecipeIngredient[];
  packaging: RecipePackaging[];
  transport?: RecipeTransport[];
  energyMJ?: number;
  waterL?: number;
  location?: string;
}

/**
 * Recipe validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Recipe Builder Class
 */
export class RecipeBuilder {
  private client: OpenLCAClient;

  constructor(client: OpenLCAClient) {
    this.client = client;
  }

  /**
   * Validate recipe completeness and consistency
   */
  validateRecipe(recipe: DrinkRecipe): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!recipe.productName || recipe.productName.trim() === '') {
      errors.push('Product name is required');
    }

    if (!recipe.functionalUnit || recipe.functionalUnit.trim() === '') {
      errors.push('Functional unit is required');
    }

    if (!recipe.functionalUnitAmount || recipe.functionalUnitAmount <= 0) {
      errors.push('Functional unit amount must be greater than 0');
    }

    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      errors.push('At least one ingredient is required');
    }

    if (!recipe.packaging || recipe.packaging.length === 0) {
      warnings.push('No packaging materials specified');
    }

    recipe.ingredients.forEach((ing, index) => {
      if (!ing.name || ing.name.trim() === '') {
        errors.push(`Ingredient ${index + 1}: Name is required`);
      }
      if (!ing.amount || ing.amount <= 0) {
        errors.push(`Ingredient ${index + 1}: Amount must be greater than 0`);
      }
      if (!ing.unit || ing.unit.trim() === '') {
        errors.push(`Ingredient ${index + 1}: Unit is required`);
      }
      if (!ing.openlcaProcessId && !ing.openlcaFlowId) {
        warnings.push(
          `Ingredient ${index + 1} (${ing.name}): No OpenLCA reference. Will use generic data.`
        );
      }
    });

    recipe.packaging.forEach((pkg, index) => {
      if (!pkg.name || pkg.name.trim() === '') {
        errors.push(`Packaging ${index + 1}: Name is required`);
      }
      if (!pkg.amount || pkg.amount <= 0) {
        errors.push(`Packaging ${index + 1}: Amount must be greater than 0`);
      }
      if (!pkg.unit || pkg.unit.trim() === '') {
        errors.push(`Packaging ${index + 1}: Unit is required`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create an OpenLCA Exchange from a recipe ingredient
   */
  private async createIngredientExchange(
    ingredient: RecipeIngredient
  ): Promise<Exchange> {
    let flowRef: Ref;
    let providerRef: Ref | undefined;

    if (ingredient.openlcaFlowId) {
      const flow = await this.client.getFlow(ingredient.openlcaFlowId);
      flowRef = {
        '@type': 'Flow',
        '@id': ingredient.openlcaFlowId,
        name: flow.name,
      };
    } else {
      flowRef = {
        '@type': 'Flow',
        '@id': uuidv4(),
        name: ingredient.name,
      };
    }

    if (ingredient.openlcaProcessId) {
      const process = await this.client.getProcess(ingredient.openlcaProcessId);
      providerRef = {
        '@type': 'Process',
        '@id': ingredient.openlcaProcessId,
        name: process.name,
      };
    }

    const exchange: Exchange = {
      '@type': 'Exchange',
      flow: flowRef,
      amount: ingredient.amount,
      unit: {
        '@type': 'Unit',
        '@id': uuidv4(),
        name: ingredient.unit,
      },
      isInput: true,
      quantitativeReference: false,
    };

    if (providerRef) {
      exchange.defaultProvider = providerRef;
    }

    if (ingredient.location) {
      exchange.location = {
        '@type': 'Location',
        '@id': uuidv4(),
        name: ingredient.location,
      };
    }

    if (ingredient.notes) {
      exchange.description = ingredient.notes;
    }

    return exchange;
  }

  /**
   * Create an OpenLCA Exchange from packaging material
   */
  private async createPackagingExchange(
    packaging: RecipePackaging
  ): Promise<Exchange> {
    let flowRef: Ref;
    let providerRef: Ref | undefined;

    if (packaging.openlcaFlowId) {
      const flow = await this.client.getFlow(packaging.openlcaFlowId);
      flowRef = {
        '@type': 'Flow',
        '@id': packaging.openlcaFlowId,
        name: flow.name,
      };
    } else {
      flowRef = {
        '@type': 'Flow',
        '@id': uuidv4(),
        name: packaging.name,
      };
    }

    if (packaging.openlcaProcessId) {
      const process = await this.client.getProcess(packaging.openlcaProcessId);
      providerRef = {
        '@type': 'Process',
        '@id': packaging.openlcaProcessId,
        name: process.name,
      };
    }

    const exchange: Exchange = {
      '@type': 'Exchange',
      flow: flowRef,
      amount: packaging.amount,
      unit: {
        '@type': 'Unit',
        '@id': uuidv4(),
        name: packaging.unit,
      },
      isInput: true,
      quantitativeReference: false,
    };

    if (providerRef) {
      exchange.defaultProvider = providerRef;
    }

    if (packaging.location) {
      exchange.location = {
        '@type': 'Location',
        '@id': uuidv4(),
        name: packaging.location,
      };
    }

    let description = packaging.notes || '';
    if (packaging.recycledContent) {
      description += ` (${packaging.recycledContent}% recycled content)`;
    }
    if (description) {
      exchange.description = description;
    }

    return exchange;
  }

  /**
   * Create product output exchange (the drink itself)
   */
  private createProductOutputExchange(recipe: DrinkRecipe): Exchange {
    return {
      '@type': 'Exchange',
      flow: {
        '@type': 'Flow',
        '@id': uuidv4(),
        name: recipe.productName,
      },
      amount: recipe.functionalUnitAmount,
      unit: {
        '@type': 'Unit',
        '@id': uuidv4(),
        name: recipe.functionalUnit,
      },
      isInput: false,
      quantitativeReference: true,
    };
  }

  /**
   * Build complete OpenLCA Process from recipe
   */
  async buildProcess(recipe: DrinkRecipe): Promise<Process> {
    const validation = this.validateRecipe(recipe);
    if (!validation.valid) {
      throw new Error(
        `Recipe validation failed: ${validation.errors.join(', ')}`
      );
    }

    const processId = uuidv4();
    const exchanges: Exchange[] = [];

    exchanges.push(this.createProductOutputExchange(recipe));

    for (const ingredient of recipe.ingredients) {
      const exchange = await this.createIngredientExchange(ingredient);
      exchanges.push(exchange);
    }

    for (const packaging of recipe.packaging) {
      const exchange = await this.createPackagingExchange(packaging);
      exchanges.push(exchange);
    }

    if (recipe.energyMJ && recipe.energyMJ > 0) {
      exchanges.push({
        '@type': 'Exchange',
        flow: {
          '@type': 'Flow',
          '@id': uuidv4(),
          name: 'Electricity, medium voltage',
        },
        amount: recipe.energyMJ / 3.6,
        unit: {
          '@type': 'Unit',
          '@id': uuidv4(),
          name: 'kWh',
        },
        isInput: true,
        quantitativeReference: false,
        description: 'Processing energy',
      });
    }

    if (recipe.waterL && recipe.waterL > 0) {
      exchanges.push({
        '@type': 'Exchange',
        flow: {
          '@type': 'Flow',
          '@id': uuidv4(),
          name: 'Water, deionised',
        },
        amount: recipe.waterL,
        unit: {
          '@type': 'Unit',
          '@id': uuidv4(),
          name: 'l',
        },
        isInput: true,
        quantitativeReference: false,
        description: 'Processing water',
      });
    }

    const process: Process = {
      '@type': 'Process',
      '@id': processId,
      name: recipe.productName,
      description: recipe.description,
      processType: ProcessType.UNIT_PROCESS,
      exchanges,
    };

    if (recipe.location) {
      process.location = {
        '@type': 'Location',
        '@id': uuidv4(),
        name: recipe.location,
      };
    }

    return process;
  }

  /**
   * Build and upload process to OpenLCA server
   */
  async createAndUploadProcess(recipe: DrinkRecipe): Promise<Ref> {
    const process = await this.buildProcess(recipe);
    return await this.client.putProcess(process);
  }
}

/**
 * Helper function to convert product materials to recipe ingredients
 */
export function convertMaterialsToRecipe(
  productName: string,
  functionalUnit: string,
  functionalUnitAmount: number,
  materials: Array<{
    name: string;
    quantity: number;
    unit: string;
    material_type: 'ingredient' | 'packaging';
    data_source?: string;
    data_source_id?: string;
    origin_country?: string;
    is_organic_certified?: boolean;
    packaging_category?: string;
  }>
): DrinkRecipe {
  const ingredients: RecipeIngredient[] = [];
  const packaging: RecipePackaging[] = [];

  materials.forEach((material) => {
    if (material.material_type === 'ingredient') {
      ingredients.push({
        name: material.name,
        amount: material.quantity,
        unit: material.unit,
        openlcaProcessId:
          material.data_source === 'openlca' ? material.data_source_id : undefined,
        location: material.origin_country,
        isOrganic: material.is_organic_certified,
      });
    } else if (material.material_type === 'packaging') {
      packaging.push({
        name: material.name,
        amount: material.quantity,
        unit: material.unit,
        openlcaProcessId:
          material.data_source === 'openlca' ? material.data_source_id : undefined,
        location: material.origin_country,
      });
    }
  });

  return {
    productName,
    functionalUnit,
    functionalUnitAmount,
    ingredients,
    packaging,
  };
}
