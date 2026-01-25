// Rosa Document Extraction Module
// Feature 4: Smart Document Data Extraction using AI

import { createClient } from '@supabase/supabase-js';
import type {
  RosaDocumentExtraction,
  RosaDocumentType,
  RosaExtractedField,
  RosaExtractionStatus,
} from '@/lib/types/gaia';

type SupabaseClient = ReturnType<typeof createClient>;

// Field mapping patterns for different document types
const DOCUMENT_FIELD_PATTERNS: Record<RosaDocumentType, {
  fields: string[];
  targetTable: string;
  targetFields: Record<string, string>;
}> = {
  utility_bill: {
    fields: ['vendor', 'account_number', 'billing_period', 'consumption', 'unit', 'total_amount', 'currency'],
    targetTable: 'facility_activity_entries',
    targetFields: {
      consumption: 'quantity',
      unit: 'unit',
      billing_period: 'activity_date',
    },
  },
  invoice: {
    fields: ['vendor', 'invoice_number', 'date', 'line_items', 'total_amount', 'currency'],
    targetTable: 'corporate_overheads',
    targetFields: {
      total_amount: 'spend_amount',
      date: 'period_start',
    },
  },
  waste_manifest: {
    fields: ['waste_type', 'quantity', 'unit', 'disposal_method', 'destination', 'date'],
    targetTable: 'facility_waste_data',
    targetFields: {
      waste_type: 'waste_category',
      quantity: 'quantity',
      disposal_method: 'treatment_method',
    },
  },
  supplier_report: {
    fields: ['supplier_name', 'reporting_period', 'emissions_scope1', 'emissions_scope2', 'emissions_scope3'],
    targetTable: 'supplier_emissions_data',
    targetFields: {
      emissions_scope1: 'scope1_emissions',
      emissions_scope2: 'scope2_emissions',
      emissions_scope3: 'scope3_emissions',
    },
  },
  certificate: {
    fields: ['certificate_type', 'issuing_body', 'issue_date', 'expiry_date', 'certificate_number'],
    targetTable: 'certifications',
    targetFields: {
      certificate_type: 'certification_type',
      issue_date: 'awarded_date',
      expiry_date: 'expiry_date',
    },
  },
  other: {
    fields: ['content', 'date', 'type'],
    targetTable: '',
    targetFields: {},
  },
};

// Common extraction prompts for different document types
const EXTRACTION_PROMPTS: Record<RosaDocumentType, string> = {
  utility_bill: `Extract the following information from this utility bill:
- Vendor/utility company name
- Account number
- Billing period (start and end dates)
- Total consumption (quantity)
- Unit of measurement (kWh, m³, therms, etc.)
- Total amount due
- Currency

Format as JSON with keys: vendor, account_number, period_start, period_end, consumption, unit, total_amount, currency`,

  invoice: `Extract the following information from this invoice:
- Vendor/supplier name
- Invoice number
- Invoice date
- Line items (description, quantity, unit price, total)
- Total amount
- Currency

Format as JSON with keys: vendor, invoice_number, date, line_items (array), total_amount, currency`,

  waste_manifest: `Extract the following information from this waste manifest:
- Waste type/category
- Quantity
- Unit of measurement
- Disposal/treatment method
- Destination facility
- Collection/processing date

Format as JSON with keys: waste_type, quantity, unit, disposal_method, destination, date`,

  supplier_report: `Extract sustainability/emissions data from this supplier report:
- Supplier name
- Reporting period
- Scope 1 emissions (if available)
- Scope 2 emissions (if available)
- Scope 3 emissions (if available)
- Units (tCO2e, kgCO2e, etc.)

Format as JSON with keys: supplier_name, reporting_period, emissions_scope1, emissions_scope2, emissions_scope3, unit`,

  certificate: `Extract certification details from this document:
- Certificate type (ISO 14001, B Corp, etc.)
- Issuing body/organization
- Issue date
- Expiry date
- Certificate number

Format as JSON with keys: certificate_type, issuing_body, issue_date, expiry_date, certificate_number`,

  other: `Extract the key information from this document. Identify:
- Document type
- Date
- Any numerical data with units
- Key entities mentioned

Format as JSON.`,
};

/**
 * Create a new document extraction request
 */
export async function createDocumentExtraction(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  fileName: string,
  fileUrl: string,
  documentType: RosaDocumentType = 'other'
): Promise<RosaDocumentExtraction> {
  const extraction: Omit<RosaDocumentExtraction, 'id'> = {
    organizationId,
    userId,
    documentType,
    fileName,
    fileUrl,
    status: 'pending',
    extractedFields: [],
    metadata: {},
    suggestedActions: [],
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('rosa_document_extractions')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      document_type: documentType,
      file_name: fileName,
      file_url: fileUrl,
      status: 'pending',
      extracted_fields: [],
      metadata: {},
      suggested_actions: [],
    } as any)
    .select()
    .single();

  if (error) throw error;

  return {
    ...extraction,
    id: (data as any).id,
  };
}

/**
 * Process a document for extraction using Gemini Vision
 * This function would be called from an edge function or background job
 */
export async function processDocumentExtraction(
  supabase: SupabaseClient,
  extractionId: string,
  geminiApiKey: string
): Promise<RosaDocumentExtraction> {
  // Fetch the extraction record
  const { data: extractionData, error: fetchError } = await supabase
    .from('rosa_document_extractions')
    .select('*')
    .eq('id', extractionId)
    .single();

  if (fetchError || !extractionData) {
    throw new Error('Extraction not found');
  }

  const extraction = extractionData as any;

  // Update status to processing
  await (supabase
    .from('rosa_document_extractions') as any)
    .update({ status: 'processing' })
    .eq('id', extractionId);

  try {
    // Get the extraction prompt for this document type
    const documentType = extraction.document_type as RosaDocumentType;
    const prompt = EXTRACTION_PROMPTS[documentType];
    const fieldPatterns = DOCUMENT_FIELD_PATTERNS[documentType];

    // Call Gemini Vision API for extraction
    const extractedData = await callGeminiVision(
      extraction.file_url,
      prompt,
      geminiApiKey
    );

    // Parse and validate extracted fields
    const extractedFields = parseExtractedFields(extractedData, fieldPatterns.fields);

    // Generate suggested actions based on extracted data
    const suggestedActions = generateSuggestedActions(extractedFields, fieldPatterns);

    // Validate the extracted data
    const validationErrors = validateExtractedData(extractedFields, documentType);

    // Determine final status
    const status: RosaExtractionStatus = validationErrors.length > 0
      ? 'needs_review'
      : 'completed';

    // Extract metadata
    const metadata = extractMetadata(extractedFields);

    // Update the extraction record
    const { data: updatedData, error: updateError } = await (supabase
      .from('rosa_document_extractions') as any)
      .update({
        status,
        extracted_fields: extractedFields,
        metadata,
        suggested_actions: suggestedActions,
        validation_errors: validationErrors,
        processed_at: new Date().toISOString(),
      })
      .eq('id', extractionId)
      .select()
      .single();

    if (updateError) throw updateError;

    const updated = updatedData as any;
    return {
      id: updated.id,
      organizationId: updated.organization_id,
      userId: updated.user_id,
      documentType: updated.document_type,
      fileName: updated.file_name,
      fileUrl: updated.file_url,
      status: updated.status,
      extractedFields: updated.extracted_fields,
      metadata: updated.metadata,
      suggestedActions: updated.suggested_actions,
      validationErrors: updated.validation_errors,
      createdAt: updated.created_at,
      processedAt: updated.processed_at,
    };
  } catch (error) {
    // Update status to failed
    await (supabase
      .from('rosa_document_extractions') as any)
      .update({
        status: 'failed',
        validation_errors: [(error as Error).message],
      })
      .eq('id', extractionId);

    throw error;
  }
}

/**
 * Call Gemini Vision API for document extraction
 */
async function callGeminiVision(
  imageUrl: string,
  prompt: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: await fetchImageAsBase64(imageUrl),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Gemini response');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Fetch an image and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  return base64;
}

/**
 * Parse extracted data into structured fields
 */
function parseExtractedFields(
  data: Record<string, unknown>,
  expectedFields: string[]
): RosaExtractedField[] {
  const fields: RosaExtractedField[] = [];

  for (const fieldName of expectedFields) {
    const value = data[fieldName];
    if (value !== undefined && value !== null) {
      fields.push({
        fieldName,
        value: value as string | number,
        confidence: 0.85, // Default confidence - would be enhanced with actual model confidence
        needsReview: false,
        suggestedMapping: fieldName,
      });
    }
  }

  // Add any additional fields not in the expected list
  for (const [key, value] of Object.entries(data)) {
    if (!expectedFields.includes(key) && value !== undefined && value !== null) {
      fields.push({
        fieldName: key,
        value: value as string | number,
        confidence: 0.7,
        needsReview: true, // Unknown fields need review
        suggestedMapping: undefined,
      });
    }
  }

  return fields;
}

/**
 * Generate suggested actions based on extracted data
 */
function generateSuggestedActions(
  fields: RosaExtractedField[],
  fieldPatterns: typeof DOCUMENT_FIELD_PATTERNS[RosaDocumentType]
): RosaDocumentExtraction['suggestedActions'] {
  const actions: RosaDocumentExtraction['suggestedActions'] = [];

  if (!fieldPatterns.targetTable) return actions;

  for (const field of fields) {
    const targetField = fieldPatterns.targetFields[field.fieldName];
    if (targetField) {
      actions.push({
        action: `Add ${field.fieldName} to ${fieldPatterns.targetTable}`,
        targetTable: fieldPatterns.targetTable,
        targetField,
        value: field.value,
        confidence: field.confidence,
      });
    }
  }

  return actions;
}

/**
 * Validate extracted data
 */
function validateExtractedData(
  fields: RosaExtractedField[],
  documentType: RosaDocumentType
): string[] {
  const errors: string[] = [];
  const requiredFields = DOCUMENT_FIELD_PATTERNS[documentType].fields.slice(0, 3); // First 3 are usually required

  for (const required of requiredFields) {
    const field = fields.find(f => f.fieldName === required);
    if (!field) {
      errors.push(`Missing required field: ${required}`);
    } else if (field.confidence < 0.5) {
      errors.push(`Low confidence for field: ${required} (${(field.confidence * 100).toFixed(0)}%)`);
    }
  }

  // Validate numeric fields
  for (const field of fields) {
    if (field.fieldName.includes('consumption') || field.fieldName.includes('amount') || field.fieldName.includes('quantity')) {
      const numValue = typeof field.value === 'number' ? field.value : parseFloat(String(field.value));
      if (isNaN(numValue) || numValue < 0) {
        errors.push(`Invalid numeric value for ${field.fieldName}: ${field.value}`);
      }
    }
  }

  return errors;
}

/**
 * Extract metadata from fields
 */
function extractMetadata(fields: RosaExtractedField[]): RosaDocumentExtraction['metadata'] {
  const metadata: RosaDocumentExtraction['metadata'] = {};

  for (const field of fields) {
    switch (field.fieldName) {
      case 'vendor':
        metadata.vendor = String(field.value);
        break;
      case 'date':
      case 'invoice_date':
        metadata.documentDate = String(field.value);
        break;
      case 'period_start':
      case 'billing_period_start':
        metadata.periodStart = String(field.value);
        break;
      case 'period_end':
      case 'billing_period_end':
        metadata.periodEnd = String(field.value);
        break;
      case 'total_amount':
        metadata.totalAmount = typeof field.value === 'number' ? field.value : parseFloat(String(field.value));
        break;
      case 'currency':
        metadata.currency = String(field.value);
        break;
    }
  }

  return metadata;
}

/**
 * Get pending extractions for an organization
 */
export async function getPendingExtractions(
  supabase: SupabaseClient,
  organizationId: string
): Promise<RosaDocumentExtraction[]> {
  const { data, error } = await supabase
    .from('rosa_document_extractions')
    .select('*')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'processing', 'needs_review'])
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as any[]).map(d => ({
    id: d.id,
    organizationId: d.organization_id,
    userId: d.user_id,
    documentType: d.document_type,
    fileName: d.file_name,
    fileUrl: d.file_url,
    status: d.status,
    extractedFields: d.extracted_fields,
    metadata: d.metadata,
    suggestedActions: d.suggested_actions,
    validationErrors: d.validation_errors,
    createdAt: d.created_at,
    processedAt: d.processed_at,
  }));
}

/**
 * Apply extracted data to the target table
 */
export async function applyExtractedData(
  supabase: SupabaseClient,
  extractionId: string,
  selectedActions: number[] // Indices of actions to apply
): Promise<void> {
  const { data: extractionData, error: fetchError } = await supabase
    .from('rosa_document_extractions')
    .select('*')
    .eq('id', extractionId)
    .single();

  if (fetchError || !extractionData) {
    throw new Error('Extraction not found');
  }

  const extraction = extractionData as any;
  const actions = extraction.suggested_actions as RosaDocumentExtraction['suggestedActions'];
  const selectedActionsList = selectedActions.map(i => actions[i]).filter(Boolean);

  // Group actions by target table
  const actionsByTable = new Map<string, typeof selectedActionsList>();
  for (const action of selectedActionsList) {
    const existing = actionsByTable.get(action.targetTable) || [];
    existing.push(action);
    actionsByTable.set(action.targetTable, existing);
  }

  // Apply actions to each table
  for (const [table, tableActions] of Array.from(actionsByTable.entries())) {
    const record: Record<string, unknown> = {
      organization_id: extraction.organization_id,
    };

    for (const action of tableActions) {
      record[action.targetField] = action.value;
    }

    const { error } = await (supabase.from(table) as any).insert(record);
    if (error) {
      throw new Error(`Failed to insert into ${table}: ${error.message}`);
    }
  }

  // Mark extraction as completed
  await (supabase
    .from('rosa_document_extractions') as any)
    .update({ status: 'completed' })
    .eq('id', extractionId);
}

/**
 * Format extraction for Rosa's context
 */
export function formatExtractionForPrompt(extraction: RosaDocumentExtraction): string {
  const lines: string[] = [];

  lines.push('### Document Extraction Result');
  lines.push(`Document: ${extraction.fileName} (${extraction.documentType})`);
  lines.push(`Status: ${extraction.status}`);
  lines.push('');

  if (extraction.extractedFields.length > 0) {
    lines.push('**Extracted Data:**');
    for (const field of extraction.extractedFields) {
      const confidence = (field.confidence * 100).toFixed(0);
      const reviewFlag = field.needsReview ? ' ⚠️ needs review' : '';
      lines.push(`- ${field.fieldName}: ${field.value} (${confidence}% confidence${reviewFlag})`);
    }
    lines.push('');
  }

  if (extraction.suggestedActions.length > 0) {
    lines.push('**Suggested Actions:**');
    for (let i = 0; i < extraction.suggestedActions.length; i++) {
      const action = extraction.suggestedActions[i];
      lines.push(`${i + 1}. ${action.action}`);
    }
    lines.push('');
  }

  if (extraction.validationErrors && extraction.validationErrors.length > 0) {
    lines.push('**Validation Issues:**');
    for (const error of extraction.validationErrors) {
      lines.push(`- ⚠️ ${error}`);
    }
  }

  return lines.join('\n');
}

/**
 * Detect document type from file name and content hints
 */
export function detectDocumentType(fileName: string, contentHints?: string): RosaDocumentType {
  const lowerName = fileName.toLowerCase();
  const lowerHints = (contentHints || '').toLowerCase();

  if (lowerName.includes('utility') || lowerName.includes('bill') || lowerName.includes('electricity') ||
      lowerName.includes('gas') || lowerName.includes('water') || lowerHints.includes('kwh')) {
    return 'utility_bill';
  }

  if (lowerName.includes('invoice') || lowerName.includes('inv') || lowerHints.includes('invoice')) {
    return 'invoice';
  }

  if (lowerName.includes('waste') || lowerName.includes('manifest') || lowerHints.includes('disposal')) {
    return 'waste_manifest';
  }

  if (lowerName.includes('supplier') || lowerName.includes('vendor') || lowerHints.includes('scope')) {
    return 'supplier_report';
  }

  if (lowerName.includes('cert') || lowerName.includes('iso') || lowerName.includes('bcorp')) {
    return 'certificate';
  }

  return 'other';
}
