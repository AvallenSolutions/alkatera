import type { SupabaseClient } from '@supabase/supabase-js';
import { extractTextFromPdf } from './extractors/pdf-extractor';
import { extractTextFromExcel } from './extractors/excel-extractor';
import { extractFromImage } from './extractors/image-extractor';
import { extractFieldsFromDocument } from './llm-document-extractor';
import { decideConflict } from './conflict-resolver';
import {
  coerceFieldValue,
  FIELD_DEFINITIONS,
  type FieldKey,
} from '../scraping/field-definitions';
import { recalculateCompleteness } from '../scoring/recalculate';

export interface ProcessArgs {
  supabase: SupabaseClient;
  submissionId: string;
  jobId: string;
}

export interface ProcessResult {
  ok: boolean;
  fields_extracted: number;
  fields_conflicted: number;
  errors: string[];
}

const BRAND_UPLOAD_CONFIDENCE = 0.85;
const KNOWN_FIELD_KEYS = new Set<FieldKey>(FIELD_DEFINITIONS.map((f) => f.key));

interface SubmissionRow {
  id: string;
  brand_profile_id: string;
  distributor_org_id: string;
  file_path: string;
  file_type: string;
  file_name: string;
  document_type: string;
  vintage_year: number | null;
  /** SKUs this document applies to. Empty/null = whole brand. */
  brand_sku_ids: string[] | null;
}

/**
 * End-to-end processing for a single document submission. The cron
 * route wraps this in a try/finally that records the job's terminal
 * status — this function just returns counts + errors.
 *
 *   1. Load the submission row + the parent brand.
 *   2. Download the file from the brand-documents Supabase Storage bucket.
 *   3. Pick an extractor based on mime type:
 *        application/pdf            → pdf-parse
 *        application/vnd…spreadsheet→ xlsx → CSV
 *        text/csv | text/plain      → raw utf-8
 *        image/*                    → Claude vision (returns structured fields directly)
 *   4. For text-based extractors, run claude-sonnet-4-6 over the text to
 *      pull out structured FieldKey values. For image extraction the
 *      vision call already returns the structured object.
 *   5. Compare each new field to the current "active" scraped_brand_data
 *      row (if any). Insert a brand_data_conflicts row when values
 *      differ; auto-resolve where possible.
 *   6. Insert (or supersede + insert) the new scraped_brand_data row.
 *   7. Update the submission's extracted_data summary so the brand-detail
 *      page can show "we pulled N fields from this file" without a join.
 */
export async function processDocument(args: ProcessArgs): Promise<ProcessResult> {
  const { supabase, submissionId, jobId } = args;
  const errors: string[] = [];

  const { data: submission, error: subError } = await supabase
    .from('brand_document_submissions')
    .select('id, brand_profile_id, distributor_org_id, file_path, file_type, file_name, document_type, vintage_year, brand_sku_ids')
    .eq('id', submissionId)
    .maybeSingle();
  if (subError || !submission) {
    return {
      ok: false,
      fields_extracted: 0,
      fields_conflicted: 0,
      errors: [`submission_not_found: ${subError?.message ?? submissionId}`],
    };
  }
  const sub = submission as SubmissionRow;

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('name')
    .eq('id', sub.brand_profile_id)
    .maybeSingle();
  const brandName = (brand as { name?: string } | null)?.name ?? 'this brand';

  const { data: download, error: downloadError } = await supabase.storage
    .from('brand-documents')
    .download(sub.file_path);
  if (downloadError || !download) {
    return {
      ok: false,
      fields_extracted: 0,
      fields_conflicted: 0,
      errors: [`download_failed: ${downloadError?.message ?? 'no_body'}`],
    };
  }
  const buffer = Buffer.from(await download.arrayBuffer());

  // Step 1: pull fields out of the file. Two routes — text-based goes
  // through llm-document-extractor; images go through vision directly.
  let extracted: Partial<Record<FieldKey, unknown>> = {};
  try {
    if (sub.file_type === 'application/pdf') {
      const text = await extractTextFromPdf(buffer);
      const result = await extractFieldsFromDocument({
        text,
        brandName,
        documentType: sub.document_type,
      });
      if (result.error) errors.push(`pdf: ${result.error}`);
      extracted = result.values;
    } else if (
      sub.file_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      sub.file_type === 'application/vnd.ms-excel'
    ) {
      const text = extractTextFromExcel(buffer);
      const result = await extractFieldsFromDocument({
        text,
        brandName,
        documentType: sub.document_type,
      });
      if (result.error) errors.push(`excel: ${result.error}`);
      extracted = result.values;
    } else if (sub.file_type === 'text/csv' || sub.file_type === 'text/plain') {
      const text = buffer.toString('utf-8').slice(0, 20_000);
      const result = await extractFieldsFromDocument({
        text,
        brandName,
        documentType: sub.document_type,
      });
      if (result.error) errors.push(`text: ${result.error}`);
      extracted = result.values;
    } else if (sub.file_type.startsWith('image/')) {
      const result = await extractFromImage(buffer, sub.file_type, brandName);
      if (result.error) errors.push(`image: ${result.error}`);
      extracted = result.values;
    } else {
      errors.push(`unsupported_file_type: ${sub.file_type}`);
    }
  } catch (err: unknown) {
    errors.push(`extractor_threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: persist findings. We sequence inserts so the
  // superseded_by chain stays consistent.
  //
  // SKU attribution: if the brand uploader tagged this document with
  // applicable SKUs (sub.brand_sku_ids), we fan out one finding row
  // per (field, sku). If they didn't, we write a single brand-level
  // row per field (brand_sku_id=null). Conflict detection happens
  // per-scope — a new SKU-level finding never conflicts with a
  // brand-level row for the same field, since they live in different
  // logical scopes.
  let written = 0;
  let conflicted = 0;
  const writtenFieldKeys: FieldKey[] = [];

  const targetSkuIds: Array<string | null> =
    sub.brand_sku_ids && sub.brand_sku_ids.length > 0 ? sub.brand_sku_ids : [null];

  for (const [rawKey, rawValue] of Object.entries(extracted)) {
    if (!KNOWN_FIELD_KEYS.has(rawKey as FieldKey)) continue;
    const fieldKey = rawKey as FieldKey;
    const coerced = coerceFieldValue(fieldKey, rawValue);
    if (!coerced) continue;

    let wroteForThisField = false;
    for (const targetSkuId of targetSkuIds) {
      // Find the existing active row in the same scope (brand-level
      // vs the specific SKU). Pass `null` filter for brand-level.
      const existingQuery = supabase
        .from('scraped_brand_data')
        .select('id, field_value, field_value_numeric, confidence, source_name')
        .eq('brand_profile_id', sub.brand_profile_id)
        .eq('field_key', fieldKey)
        .is('superseded_by', null)
        .order('confidence', { ascending: false })
        .limit(1);
      const { data: existing } =
        targetSkuId === null
          ? await existingQuery.is('brand_sku_id', null).maybeSingle()
          : await existingQuery.eq('brand_sku_id', targetSkuId).maybeSingle();

      let resolution: 'use_new' | 'keep_existing' | 'flagged_for_review' | null = null;
      if (existing) {
        const decision = decideConflict({
          fieldKey,
          existingValueText: (existing as { field_value: string | null }).field_value,
          existingValueNumeric: (existing as { field_value_numeric: number | null }).field_value_numeric,
          existingConfidence: (existing as { confidence: number }).confidence ?? 0.5,
          existingSource: (existing as { source_name: string }).source_name,
          newValueText: coerced.text,
          newValueNumeric: coerced.numeric,
          newConfidence: BRAND_UPLOAD_CONFIDENCE,
          newSource: 'brand_upload',
        });
        if (decision.differs) {
          resolution = decision.resolution ?? 'flagged_for_review';
          await supabase.from('brand_data_conflicts').insert({
            brand_profile_id: sub.brand_profile_id,
            field_key: fieldKey,
            existing_value: (existing as { field_value: string | null }).field_value,
            existing_source: (existing as { source_name: string }).source_name,
            existing_confidence: (existing as { confidence: number }).confidence,
            new_value: coerced.text,
            new_source: 'brand_upload',
            new_confidence: BRAND_UPLOAD_CONFIDENCE,
            resolution: resolution === 'flagged_for_review' ? null : resolution,
            resolved_at: resolution === 'flagged_for_review' ? null : new Date().toISOString(),
            submission_id: sub.id,
          });
          if (resolution === 'flagged_for_review') conflicted += 1;
        }
      }

      const shouldWriteNewRow = !existing || resolution === 'use_new' || resolution === null;
      if (!shouldWriteNewRow) continue;

      const { data: inserted, error: insertError } = await supabase
        .from('scraped_brand_data')
        .insert({
          brand_profile_id: sub.brand_profile_id,
          brand_sku_id: targetSkuId,
          scraping_job_id: null,
          field_key: fieldKey,
          field_value: coerced.text,
          field_value_numeric: coerced.numeric,
          source_name: 'brand_upload',
          source_url: sub.file_path,
          confidence: BRAND_UPLOAD_CONFIDENCE,
          extraction_method: 'llm_extract',
        })
        .select('id')
        .single();
      if (insertError || !inserted) {
        errors.push(`insert_failed[${fieldKey}${targetSkuId ? '@' + targetSkuId.slice(0, 8) : ''}]: ${insertError?.message ?? 'no_row'}`);
        continue;
      }
      written += 1;
      if (!wroteForThisField) {
        writtenFieldKeys.push(fieldKey);
        wroteForThisField = true;
      }

      if (existing && resolution === 'use_new') {
        await supabase
          .from('scraped_brand_data')
          .update({ superseded_by: inserted.id })
          .eq('id', (existing as { id: string }).id);
      }
      // For 'flagged_for_review' we leave the existing active row in
      // place; the new row is also active until the distributor picks a
      // winner via the conflict UI.
    }
  }

  // Step 3: stamp the submission with a summary so the brand-detail
  // page can show "5 fields extracted" without a join. extracted_data
  // is intentionally small — it's a summary, not the full payload.
  const summary = {
    extracted_field_keys: writtenFieldKeys,
    extracted_count: written,
    conflicted_count: conflicted,
    errors: errors.slice(0, 5),
  };
  await supabase
    .from('brand_document_submissions')
    .update({
      processing_status: errors.length > 0 && written === 0 ? 'error' : 'complete',
      extracted_data: summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  // Refresh completeness now that scraped_brand_data has new rows.
  try {
    await recalculateCompleteness(supabase, sub.brand_profile_id);
  } catch {
    // best-effort — see brand-agent.ts comment.
  }

  return {
    ok: errors.length === 0 || written > 0,
    fields_extracted: written,
    fields_conflicted: conflicted,
    errors,
  };
}
