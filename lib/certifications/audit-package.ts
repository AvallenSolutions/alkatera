import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { calculateCertificationReadiness } from './readiness';
import { createZip, type ZipEntry } from './zip';
import {
  renderCoverSheetHtml,
  renderRequirementsSummaryHtml,
  renderRiskToolHtml,
  buildReadme,
} from './render-audit-html';

const BUCKET = 'evidence-library';

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

export interface AuditPackageResult {
  url: string;
  fileCount: number;
  evidenceFileCount: number;
}

/**
 * Build the audit package ZIP, upload it to Supabase Storage, and stamp the
 * certification_audit_packages row with exported_at + export_url.
 */
export async function generateAuditPackage(
  supabase: SupabaseClient,
  organizationId: string,
  packageId: string,
): Promise<AuditPackageResult> {
  const { data: pkg } = await supabase
    .from('certification_audit_packages')
    .select('*')
    .eq('id', packageId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (!pkg) throw new Error('Audit package not found');

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();
  const orgName = org?.name ?? 'Organisation';

  const { data: cert } = await supabase
    .from('organization_certifications')
    .select('id, certification_type, auditor_name')
    .eq('organization_id', organizationId)
    .eq('framework_id', pkg.framework_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const readiness = await calculateCertificationReadiness(
    supabase,
    organizationId,
    cert?.id ?? null,
  );

  // Verified evidence for this org's framework.
  const { data: evidence } = await supabase
    .from('certification_evidence_links')
    .select(
      'id, requirement_id, source_module, source_record_id, evidence_description, verification_status',
    )
    .eq('organization_id', organizationId)
    .eq('verification_status', 'verified');
  const verified = evidence ?? [];

  const evidenceCountByReq: Record<string, number> = {};
  for (const e of verified) {
    evidenceCountByReq[e.requirement_id] =
      (evidenceCountByReq[e.requirement_id] ?? 0) + 1;
  }

  const topicByReq = new Map(
    readiness.requirementStatuses.map((r) => [r.requirementId, r.topicArea]),
  );

  // Risk profile
  const { data: riskRow } = await supabase
    .from('organization_risk_profiles')
    .select('risk_profile, responses, triggered_requirements, completed_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const submissionDate = new Date().toISOString().slice(0, 10);

  const [coverPdf, reqPdf, riskPdf] = await Promise.all([
    convertHtmlToPdf(
      renderCoverSheetHtml({
        organisationName: orgName,
        certificationType:
          (cert?.certification_type as 'new' | 'recertification' | null) ??
          null,
        submissionDate,
        auditorName: cert?.auditor_name ?? null,
        contactEmail: null,
        requirementStatuses: readiness.requirementStatuses,
      }),
    ),
    convertHtmlToPdf(
      renderRequirementsSummaryHtml(
        orgName,
        readiness.requirementStatuses,
        evidenceCountByReq,
      ),
    ),
    convertHtmlToPdf(
      renderRiskToolHtml({
        organisationName: orgName,
        completedAt: riskRow?.completed_at ?? null,
        riskProfile: (riskRow?.risk_profile as Record<string, string>) ?? null,
        responses: (riskRow?.responses as Record<string, string>) ?? null,
        triggered: (riskRow?.triggered_requirements as string[]) ?? [],
      }),
    ),
  ]);

  const entries: ZipEntry[] = [
    { name: 'cover_sheet.pdf', data: coverPdf.buffer },
    { name: 'requirements_summary.pdf', data: reqPdf.buffer },
    { name: 'risk_tool_output.pdf', data: riskPdf.buffer },
    { name: 'README.txt', data: Buffer.from(buildReadme(orgName), 'utf8') },
  ];

  // Pull verified evidence files from the evidence library.
  let evidenceFileCount = 0;
  const docIds = verified
    .filter((e) => e.source_module === 'evidence_library' && e.source_record_id)
    .map((e) => e.source_record_id as string);
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('evidence_documents')
      .select('id, document_name, storage_object_path')
      .in('id', docIds);
    const docById = new Map(
      (docs ?? []).map((d: any) => [d.id, d]),
    );
    for (const e of verified) {
      if (e.source_module !== 'evidence_library' || !e.source_record_id) {
        continue;
      }
      const docMeta = docById.get(e.source_record_id);
      if (!docMeta) continue;
      try {
        const { data: blob } = await supabase.storage
          .from(BUCKET)
          .download(docMeta.storage_object_path);
        if (!blob) continue;
        const buf = Buffer.from(await blob.arrayBuffer());
        const area = safeName(topicByReq.get(e.requirement_id) ?? 'other');
        entries.push({
          name: `evidence/${area}-${e.requirement_id}-${safeName(
            docMeta.document_name,
          )}`,
          data: buf,
        });
        evidenceFileCount += 1;
      } catch (err) {
        console.error('Failed to add evidence file to package:', err);
      }
    }
  }

  const zipBuffer = createZip(entries);
  const ts = Date.now();
  const storagePath = `${organizationId}/audit-packages/${packageId}-${ts}.zip`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, zipBuffer, {
      contentType: 'application/zip',
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Audit package upload failed: ${uploadError.message}`);
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 604800);
  const url = signed?.signedUrl ?? '';

  await supabase
    .from('certification_audit_packages')
    .update({
      exported_at: new Date().toISOString(),
      export_url: url,
      generated_documents: {
        storage_path: storagePath,
        files: entries.map((e) => e.name),
        evidence_file_count: evidenceFileCount,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', packageId);

  return { url, fileCount: entries.length, evidenceFileCount };
}
