/**
 * Single source of truth for the Inngest function registry. Add new
 * functions by importing them here and pushing onto the array. The
 * webhook handler at `app/api/inngest/route.ts` reads from this list
 * so every function is auto-registered with one import.
 */

import type { InngestFunction } from 'inngest';

// Add new functions here as they're built.
import { scrapingQueueTick, scrapingBrandRun } from './scraping';

export const allFunctions: InngestFunction.Any[] = [
  scrapingQueueTick,
  scrapingBrandRun,
];
