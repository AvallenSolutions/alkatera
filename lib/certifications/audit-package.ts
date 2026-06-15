import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { calculateCertificationReadiness } from './readiness';
import { createZip, type ZipEntry } from './zip';
import {
  renderCoverSheetHtml,
  renderRequirementsSummaryHtml,
  renderRiskToolHtml,
  renderBiaManifestHtml,
  buildReadme,
  type BiaManifestGroup,
} from './render-audit-html';
import { BIA_AREAS, biaAreaForRequirement, biaAreaNote } from './bia-mapping';

const BUCKET = 'evidence-library';

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

export interface AuditPackageOptions {
  /** Include pending (unverified) evidence too, marked PENDING-. Default false. */
  includePending?: boolean;
  /** 'requirement' (auditor, by requirement) or 'bia' (by B Impact Assessment area). */
  layout?: 'requirement' | 'bia';
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
  options: AuditPackageOptions = {},
): Promise<AuditPackageResult> {
  const { includePending = false, layout = 'requirement' } = options;
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

  // Evidence for this org's framework. Always include verified; optionally
  // include pending too. Rejected evidence is never bundled.
  const acceptedStatuses = includePending
    ? ['verified', 'pending']
    : ['verified'];
  const { data: evidence } = await supabase
    .from('certification_evidence_links')
    .select(
      'id, requirement_id, source_module, source_record_id, evidence_description, verification_status',
    )
    .eq('organization_id', organizationId)
    .in('verification_status', acceptedStatuses);
  const included = evidence ?? [];

  const evidenceCountByReq: Record<string, number> = {};
  for (const e of included) {
    evidenceCountByReq[e.requirement_id] =
      (evidenceCountByReq[e.requirement_id] ?? 0) + 1;
  }

  const topicByReq = new Map(
    readiness.requirementStatuses.map((r) => [r.requirementId, r.topicArea]),
  );
  const codeByReq = new Map(
    readiness.requirementStatuses.map((r) => [r.requirementId, r.code]),
  );
  const nameByReq = new Map(
    readiness.requirementStatuses.map((r) => [r.requirementId, r.name]),
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
  ];

  // Pull evidence files from the evidence library. Track the bundled file names
  // per requirement so the BIA manifest can list exactly what's in each area.
  let evidenceFileCount = 0;
  const filesByReq = new Map<string, string[]>();
  const docIds = included
    .filter((e) => e.source_module === 'evidence_library' && e.source_record_id)
    .map((e) => e.source_record_id as string);
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('evidence_documents')
      .select('id, document_name, storage_object_path')
      .in('id', docIds);
    const docById = new Map((docs ?? []).map((d: any) => [d.id, d]));
    for (const e of included) {
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
        const pending = e.verification_status !== 'verified';
        const prefix = pending ? 'PENDING-' : '';
        const fileName = safeName(docMeta.document_name);
        let entryName: string;
        if (layout === 'bia') {
          const area = biaAreaForRequirement(
            topicByReq.get(e.requirement_id),
            codeByReq.get(e.requirement_id),
          );
          const code = safeName(codeByReq.get(e.requirement_id) ?? e.requirement_id);
          entryName = `evidence/${area}/${prefix}${code}-${fileName}`;
        } else {
          const area = safeName(topicByReq.get(e.requirement_id) ?? 'other');
          entryName = `evidence/${prefix}${area}-${e.requirement_id}-${fileName}`;
        }
        entries.push({ name: entryName, data: buf });
        const justName = entryName.split('/').pop() as string;
        filesByReq.set(e.requirement_id, [
          ...(filesByReq.get(e.requirement_id) ?? []),
          justName,
        ]);
        evidenceFileCount += 1;
      } catch (err) {
        console.error('Failed to add evidence file to package:', err);
      }
    }
  }

  // B Impact Assessment evidence map: group requirements (and the files we
  // bundled for them) by BIA Impact Area.
  if (layout === 'bia') {
    const groups: BiaManifestGroup[] = BIA_AREAS.map((area) => ({
      area,
      note: biaAreaNote(area),
      requirements: readiness.requirementStatuses
        .filter(
          (r) =>
            biaAreaForRequirement(r.topicArea, r.code) === area &&
            r.status !== 'future',
        )
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((r) => ({
          code: r.code,
          name: r.name,
          status: r.status,
          files: filesByReq.get(r.requirementId) ?? [],
        })),
    })).filter((g) => g.requirements.length > 0);

    const manifestPdf = await convertHtmlToPdf(
      renderBiaManifestHtml(orgName, groups),
    );
    entries.push({ name: 'bia_evidence_map.pdf', data: manifestPdf.buffer });
  }

  entries.push({
    name: 'README.txt',
    data: Buffer.from(buildReadme(orgName, { layout, includePending }), 'utf8'),
  });

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
