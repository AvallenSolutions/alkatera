import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import type { ExtractedSupplierProduct } from '@/lib/extraction/supplier-product-extractor';
import { normaliseSupplierKey } from '@/lib/ingest/supplier-key';
import { computeFieldDiff } from '@/lib/ingest/feedback-diff';
import { bumpDocumentProfile } from '@/lib/ingest/profile-upsert';

export const runtime = 'nodejs';

/**
 * POST /api/supplier-products/smart-import/confirm
 *
 * Body: {
 *   jobId: string,
 *   supplierId: string,
 *   products: ExtractedSupplierProduct[]   // already filtered + edited by the client
 * }
 *
 * Validates packaging rows still satisfy the same rules the supplier-portal
 * detail page enforces (weight_g > 0, recycled_content_pct != null), then
 * bulk-inserts to supplier_products with is_active=true and is_verified=false.
 *
 * Response: { created: number, productIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const jobId: string | undefined = body.jobId;
    const supplierId: string | undefined = body.supplierId;
    const products: ExtractedSupplierProduct[] = Array.isArray(body.products) ? body.products : [];

    if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    if (!supplierId) return NextResponse.json({ error: 'supplierId is required' }, { status: 400 });
    if (products.length === 0) {
      return NextResponse.json({ error: 'At least one product must be selected' }, { status: 400 });
    }

    // Caller must own the supplier or be a member of its org.
    const { data: supplier, error: supplierError } = await (client as any)
      .from('suppliers')
      .select('id, name, organization_id, user_id')
      .eq('id', supplierId)
      .maybeSingle();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const isOwner = supplier.user_id === user.id;
    let isOrgMember = false;
    if (!isOwner && supplier.organization_id) {
      const { data: membership } = await (client as any)
        .from('organization_members')
        .select('id')
        .eq('organization_id', supplier.organization_id)
        .eq('user_id', user.id)
        .maybeSingle();
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate packaging rules. Mirrors the inline validation just shipped to
    // the supplier-portal detail page so the smart-import path can't slip
    // bad rows through.
    const errors: string[] = [];
    // Unwrap the {value, source_quote} numeric fields, dropping any whose
    // source_quote is empty (extra hallucination guard on top of the
    // extractor's). Used by BOTH validation and the insert below — they must
    // apply the same rule, otherwise a value that passes validation (e.g. a
    // declared 0% recycled with a blank quote) is silently inserted as null,
    // violating the very invariant validation just enforced.
    const numeric = (f: any) => {
      if (!f || typeof f !== 'object') return null;
      if (f.source_quote == null || !String(f.source_quote).trim()) return null;
      return typeof f.value === 'number' ? f.value : null;
    };

    products.forEach((p, idx) => {
      if (!p.name || !p.name.trim()) {
        errors.push(`Row ${idx + 1}: name is required`);
      }
      if (p.product_type !== 'ingredient' && p.product_type !== 'packaging') {
        errors.push(`Row ${idx + 1} ("${p.name}"): product_type must be 'ingredient' or 'packaging'`);
      }
      if (p.product_type === 'packaging') {
        if (!p.packaging_category) {
          errors.push(`Row ${idx + 1} ("${p.name}"): packaging_category is required for packaging`);
        }
        const weight = numeric(p.weight_g);
        if (weight === null || weight <= 0) {
          errors.push(`Row ${idx + 1} ("${p.name}"): weight per unit (g) is required for packaging and must be > 0`);
        }
        // numeric() so a value without a source quote fails HERE with a clear
        // message instead of passing validation and inserting as null. An
        // explicit 0 with a quote passes — 0 is a declared zero, not "unset".
        const rec = numeric(p.recycled_content_pct);
        if (rec === null) {
          errors.push(`Row ${idx + 1} ("${p.name}"): recycled content (%) is required for packaging — enter 0 if none`);
        }
      }
    });
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', issues: errors }, { status: 400 });
    }

    const rows = products.map(p => {
      const isPackaging = p.product_type === 'packaging';
      const row: Record<string, any> = {
        supplier_id: supplierId,
        organization_id: supplier.organization_id,
        name: p.name.trim(),
        description: p.description?.trim() || null,
        unit: p.unit?.trim() || (isPackaging ? 'unit' : 'kg'),
        product_type: p.product_type,
        is_active: true,
        is_verified: false,
        origin_country_code: p.origin_country_code?.trim() || null,
        // numerics with provenance
        weight_g: numeric(p.weight_g),
        recycled_content_pct: numeric(p.recycled_content_pct),
        recyclability_pct: numeric(p.recyclability_pct),
        impact_climate: numeric(p.impact_climate),
        carbon_intensity: numeric(p.impact_climate), // legacy mirror
        impact_water: numeric(p.impact_water),
        impact_waste: numeric(p.impact_waste),
        impact_land: numeric(p.impact_land),
      };
      if (isPackaging) {
        row.packaging_category = p.packaging_category;
        row.primary_material = p.primary_material || null;
        row.epr_material_code = p.epr_material_code || null;
        row.epr_is_drinks_container = p.epr_is_drinks_container ?? null;
        row.category = 'Packaging';
      } else {
        row.category = null;
      }
      return row;
    });

    const { data: inserted, error: insertError } = await (client as any)
      .from('supplier_products')
      .insert(rows)
      .select('id');

    if (insertError) {
      console.error('[smart-import confirm] insert failed:', insertError);
      return NextResponse.json(
        { error: `Could not create supplier products: ${insertError.message}`, code: insertError.code ?? null },
        { status: 500 }
      );
    }

    const productIds: string[] = (inserted ?? []).map((r: any) => String(r.id));

    // Best-effort: stamp the originating job_id into the metadata so we have
    // an audit trail of where each row came from. Failure here is non-fatal.
    try {
      await (client as any)
        .from('supplier_products')
        .update({ metadata: { smart_import_job_id: jobId } })
        .in('id', productIds);
    } catch (auditErr) {
      console.error('[smart-import confirm] audit stamp failed (non-fatal):', auditErr);
    }

    // Best-effort: suggest ingredient matches for the brand and notify them
    // that this supplier just published data. Non-fatal if Inngest is absent.
    if (productIds.length > 0 && supplier.organization_id) {
      try {
        const { inngest } = await import('@/lib/inngest/client');
        await inngest.send({
          name: 'ingredients/match.suggest',
          data: { organization_id: supplier.organization_id, supplier_product_ids: productIds },
        });
      } catch (eventErr) {
        console.error('[smart-import confirm] match.suggest dispatch failed (non-fatal):', eventErr);
      }
    }

    // Pillar 1 (data-revolution-plan.md): teach ingest_document_profiles from
    // this confirm, the same learning mechanism /api/ingest/feedback uses for
    // every other Smart Upload channel. Diffs what the CATALOGUE EXTRACTOR
    // originally read (job.extracted_products.products, before the user's
    // edits) against what was actually confirmed just now — that comparison
    // is the real correction signal here, not the classify-document.ts pass
    // (which frequently can't recognise a multi-product catalogue and is only
    // there for admin-visible classification stats). Best-effort: any
    // failure here must never affect the products that were just created.
    try {
      const supplierKey = normaliseSupplierKey(supplier.name || '');
      if (supplierKey && supplier.organization_id) {
        const { data: jobRow } = await (client as any)
          .from('supplier_product_import_jobs')
          .select('extracted_products')
          .eq('id', jobId)
          .maybeSingle();
        const originalProducts = Array.isArray(jobRow?.extracted_products?.products)
          ? jobRow.extracted_products.products
          : [];
        const ingestJobId: string | null = jobRow?.extracted_products?._classification?.ingestJobId ?? null;
        const modeUsed: string | null = jobRow?.extracted_products?.mode_used ?? null;

        const fieldDiff = computeFieldDiff({ products: originalProducts }, { products });
        await (client as any).from('ingest_feedback').insert({
          // Links to the classify-document.ts job when the classify pass
          // succeeded; null is fine (the column allows it) when it didn't.
          job_id: ingestJobId,
          organization_id: supplier.organization_id,
          user_id: user.id,
          // Not a classify-document.ts ClassifierResultType — this channel's
          // extraction schema is genuinely different (see
          // lib/extraction/supplier-product-extractor.ts), so it gets its own
          // descriptive result_type. ingest_feedback.result_type has no CHECK
          // constraint restricting it to the classifier's union.
          result_type: 'supplier_catalogue_product',
          supplier_key: supplierKey,
          classifier_payload: { products: originalProducts },
          saved_payload: { products },
          field_diff: fieldDiff,
          context: { supplier_id: supplierId, mode_used: modeUsed, product_count: products.length },
        });

        await bumpDocumentProfile(client, {
          organizationId: supplier.organization_id,
          matchKind: 'supplier',
          supplierKey,
          resultType: 'supplier_catalogue_product',
          hints: modeUsed ? { typical_mode_used: modeUsed } : {},
          lastConfirmedPayload: { products },
        });
      }
    } catch (learnErr) {
      console.error('[smart-import confirm] feedback learning failed (non-fatal):', learnErr);
    }

    return NextResponse.json({ created: productIds.length, productIds });
  } catch (error: any) {
    console.error('[smart-import confirm] error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to confirm import' }, { status: 500 });
  }
}
