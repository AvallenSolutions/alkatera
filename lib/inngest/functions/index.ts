/**
 * Single source of truth for the Inngest function registry. Add new
 * functions by importing them here and pushing onto the array. The
 * webhook handler at `app/api/inngest/route.ts` reads from this list
 * so every function is auto-registered with one import.
 */

import type { InngestFunction } from 'inngest';

// Add new functions here as they're built.
import { scrapingQueueTick, scrapingBrandRun } from './scraping';
import { enrichBrandRun } from './enrich';
import { documentsQueueTick, documentsProcessOne } from './documents';
import { ingestReclassifyRun } from './ingest-reclassify';
import { matchingSweepRun } from './matching';
import { openlcaCertMonitor } from './monitoring';
import { xeroSyncTick, xeroOrgSync } from './xero';
import { reportPdfGenerate } from './reports';
import { ingredientMatchSuggest } from './ingredient-match';
import { agribalyseBackfillRun } from './factors';
import { referenceDataLoadRun } from './reference-data';
import { geoSoilBaselineRun } from './geo';
import { trialReminderSweep } from './trial-reminders';
import { pulseRefreshRun } from './pulse-refresh';
import { outreachReportEnrich } from './outreach';

export const allFunctions: InngestFunction.Any[] = [
  scrapingQueueTick,
  scrapingBrandRun,
  enrichBrandRun,
  documentsQueueTick,
  documentsProcessOne,
  ingestReclassifyRun,
  matchingSweepRun,
  openlcaCertMonitor,
  xeroSyncTick,
  xeroOrgSync,
  reportPdfGenerate,
  ingredientMatchSuggest,
  agribalyseBackfillRun,
  referenceDataLoadRun,
  geoSoilBaselineRun,
  trialReminderSweep,
  pulseRefreshRun,
  outreachReportEnrich,
];
