import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import { summariseSupplierEsg, type SupplierEsgRow } from '@/lib/certifications/supplier-esg-evidence';
import { getBcorpFrameworkId } from '@/lib/certifications/readiness';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import {
  renderSupplierEsgReportHtml,
  type ReportSupplier,
} from '@/lib/pdf/render-supplier-esg-html';
import { enforceExportAllowed } from '@/middleware/subscription-check';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'evidence-library';

/**
 * POST /api/certifications/supplier-esg-report
 *
 * Generates a "Supply Chain ESG Due Diligence" PDF from the brand's suppliers'
 * ESG responses, stores it, AUTO-LINKS it as a B Corp evidence item (so it appears
 * in the Evidence tab without a manual upload), and returns the PDF for download.
 */
export async function POST() {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user);
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation found' }, { status: 403 });
    }

    const exportBlocked = await enforceExportAllowed(organizationId);
    if (exportBlocked) return exportBlocked;

    // Fetch the org's suppliers + their assessments (service-role bypasses RLS).
    const { data: supplierRows } = await supabase
      .from('suppliers')
      .select('id, name, supplier_tier, annual_spend, country, city, industry_sector')
      .eq('organization_id', organizationId);
    const sups = (supplierRows ?? []) as Array<Record<string, any>>;
    const ids = sups.map((s) => s.id);

    const { data: assessmentRows } = ids.length
      ? await supabase
          .from('supplier_esg_assessments')
          .select(
            'supplier_id, id, submitted, is_verified, score_total, score_labour, score_ethics, score_environment, score_rating, answers',
          )
          .in('supplier_id', ids)
      : { data: [] as any[] };
    const bySupplier = new Map<string, any>((assessmentRows ?? []).map((a: any) => [a.supplier_id, a]));

    // Rows for the coverage summary (matches SupplierEsgRow).
    const esgRows: SupplierEsgRow[] = sups.map((s) => {
      const a = bySupplier.get(s.id);
      return {
        supplierId: s.id,
        name: s.name ?? null,
        tier: s.supplier_tier ?? null,
        annualSpend: s.annual_spend ?? null,
        assessmentId: a?.id ?? null,
        submitted: !!a?.submitted,
        isVerified: !!a?.is_verified,
        scoreTotal: a?.score_total ?? null,
        scoreLabour: a?.score_labour ?? null,
        scoreEthics: a?.score_ethics ?? null,
        scoreEnvironment: a?.score_environment ?? null,
        scoreRating: a?.score_rating ?? null,
        answers: (a?.answers as Record<string, string> | null) ?? null,
      };
    });

    const reportSuppliers: ReportSupplier[] = sups
      .filter((s) => bySupplier.get(s.id)?.submitted)
      .map((s) => {
        const a = bySupplier.get(s.id);
        return {
          name: s.name || 'Unnamed supplier',
          country: s.country ?? null,
          city: s.city ?? null,
          sector: s.industry_sector ?? null,
          tier: s.supplier_tier ?? null,
          submitted: !!a?.submitted,
          verified: !!a?.is_verified,
          scoreTotal: a?.score_total ?? null,
          scoreLabour: a?.score_labour ?? null,
          scoreEthics: a?.score_ethics ?? null,
          scoreEnvironment: a?.score_environment ?? null,
          scoreRating: a?.score_rating ?? null,
          answers: (a?.answers as Record<string, string> | null) ?? null,
        };
      });

    if (reportSuppliers.length === 0) {
      return NextResponse.json(
        { error: 'No supplier ESG responses to report yet. Send the survey to your suppliers first.' },
        { status: 400 },
      );
    }

    const coverage = summariseSupplierEsg(esgRows);

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const orgName = org?.name || 'Your organisation';
    const generatedAt = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = renderSupplierEsgReportHtml({
      orgName,
      generatedAt,
      coverage: {
        tierBasis: coverage.tierBasis,
        denominator: coverage.denominator,
        assessed: coverage.assessed,
        verified: coverage.verified,
        coveragePct: coverage.coveragePct,
        avgLabour: coverage.avgLabour,
        avgEthics: coverage.avgEthics,
        distribution: coverage.distribution,
      },
      suppliers: reportSuppliers,
    });

    const { buffer } = await convertHtmlToPdf(html, {
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    // Store + auto-link as B Corp evidence (best-effort; never block the download).
    try {
      const path = `${organizationId}/supply-chain-esg/${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true });
      if (!uploadErr) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
        const url = signed?.signedUrl ?? '';
        const frameworkId = await getBcorpFrameworkId(supabase);
        if (url && frameworkId) {
          const { data: reqs } = await supabase
            .from('certification_framework_requirements')
            .select('id, requirement_code')
            .eq('framework_id', frameworkId)
            .in('requirement_code', ['IT4-Y3-001', 'IT4-Y0-002']);
          const reqId =
            (reqs ?? []).find((r: any) => r.requirement_code === 'IT4-Y3-001')?.id ??
            (reqs ?? []).find((r: any) => r.requirement_code === 'IT4-Y0-002')?.id;
          if (reqId) {
            const payload = {
              organization_id: organizationId,
              framework_id: frameworkId,
              requirement_id: reqId,
              evidence_type: 'document',
              evidence_description: `Supply Chain ESG Due Diligence Report (${generatedAt})`,
              document_url: url,
              source_module: 'supply_chain_esg_report',
              verification_status: 'pending',
              updated_at: new Date().toISOString(),
            };
            const { data: existing } = await supabase
              .from('certification_evidence_links')
              .select('id')
              .eq('organization_id', organizationId)
              .eq('source_module', 'supply_chain_esg_report')
              .limit(1);
            if (existing && existing.length > 0) {
              await supabase.from('certification_evidence_links').update(payload).eq('id', existing[0].id);
            } else {
              await supabase.from('certification_evidence_links').insert(payload);
            }
          }
        }
      }
    } catch (linkErr) {
      console.error('Supply-chain ESG evidence link failed (non-fatal):', linkErr);
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="supply-chain-esg-due-diligence.pdf"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/certifications/supplier-esg-report:', error);
    return NextResponse.json({ error: 'Failed to generate the report' }, { status: 500 });
  }
}
