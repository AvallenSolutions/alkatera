import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBcorpFrameworkId } from './readiness';
import { BCORP_SECTIONS, bcorpSectionForRequirement } from './bcorp-structure';
import { createZip, type ZipEntry } from './zip';

const BUCKET = 'evidence-library';

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

export class NoEvidenceError extends Error {
  readonly code = 'NO_EVIDENCE';
  constructor() {
    super('No evidence files found for the selected sections');
  }
}

export interface SectionExportOptions {
  topicAreas?: string[];
  includePending?: boolean;
}

export interface SectionExportResult {
  signedUrl: string;
  fileCount: number;
}

export async function buildSectionExport(
  supabase: SupabaseClient,
  organizationId: string,
  options: SectionExportOptions = {},
): Promise<SectionExportResult> {
  const { topicAreas, includePending = false } = options;

  const frameworkId = await getBcorpFrameworkId(supabase);
  if (!frameworkId) throw new Error('B Corp framework not found');

  // Requirements in the selected topic areas
  let reqQuery = supabase
    .from('certification_framework_requirements')
    .select('id, requirement_code, topic_area')
    .eq('framework_id', frameworkId);
  if (topicAreas && topicAreas.length > 0) {
    reqQuery = reqQuery.in('topic_area', topicAreas);
  }
  const { data: reqs } = await reqQuery;
  const reqRows = reqs ?? [];
  const reqById = new Map(reqRows.map((r: any) => [r.id as string, r as { id: string; requirement_code: string; topic_area: string | null }]));
  const reqIds = Array.from(reqById.keys());
  if (reqIds.length === 0) throw new NoEvidenceError();

  // Evidence links for these requirements
  const acceptedStatuses = includePending ? ['verified', 'pending'] : ['verified'];
  const { data: links } = await supabase
    .from('certification_evidence_links')
    .select('id, requirement_id, source_module, source_record_id, verification_status')
    .eq('organization_id', organizationId)
    .in('requirement_id', reqIds)
    .in('verification_status', acceptedStatuses);

  const libraryLinks = (links ?? []).filter(
    (l: any) => l.source_module === 'evidence_library' && l.source_record_id,
  );
  if (libraryLinks.length === 0) throw new NoEvidenceError();

  // Fetch document metadata (deduplicated)
  const docIds = Array.from(new Set(libraryLinks.map((l: any) => l.source_record_id as string)));
  const { data: docs } = await supabase
    .from('evidence_documents')
    .select('id, document_name, storage_object_path')
    .in('id', docIds);
  const docById = new Map((docs ?? []).map((d: any) => [d.id as string, d as { id: string; document_name: string; storage_object_path: string }]));

  // Download each file and build ZIP entries
  const entries: ZipEntry[] = [];
  for (const link of libraryLinks) {
    const doc = docById.get(link.source_record_id);
    if (!doc) continue;
    const req = reqById.get(link.requirement_id);
    if (!req) continue;

    try {
      const { data: blob } = await supabase.storage
        .from(BUCKET)
        .download(doc.storage_object_path);
      if (!blob) continue;
      const buf = Buffer.from(await blob.arrayBuffer());

      const section = bcorpSectionForRequirement(req.topic_area, req.requirement_code);
      const pending = link.verification_status !== 'verified';
      const prefix = pending ? 'PENDING-' : '';
      const code = safeName(req.requirement_code);
      const fileName = safeName(doc.document_name);
      const entryName = `${section.abbrev}/${prefix}${code}-${fileName}`;

      entries.push({ name: entryName, data: buf });
    } catch {
      // Skip individual file failures rather than aborting the whole export
    }
  }

  if (entries.length === 0) throw new NoEvidenceError();

  // MANIFEST.txt: list sections and files in B Corp order
  const filesBySection = new Map<string, string[]>();
  for (const entry of entries) {
    const folder = entry.name.split('/')[0];
    filesBySection.set(folder, [...(filesBySection.get(folder) ?? []), entry.name]);
  }

  const manifestLines: string[] = [
    'B Corp Evidence Export: Section Manifest',
    '==========================================',
    '',
    'This ZIP contains Evidence Library files filtered to the selected B Corp',
    'Impact Topics. Auto-evidence (platform data probes) is not stored as files',
    'and is not included here. Use the Answer Key export for a full data picture.',
    '',
  ];
  for (const section of BCORP_SECTIONS) {
    const files = filesBySection.get(section.abbrev);
    if (!files || files.length === 0) continue;
    manifestLines.push(`${section.label} (${section.abbrev})`);
    manifestLines.push('-'.repeat(section.label.length + section.abbrev.length + 3));
    for (const f of files) manifestLines.push(`  ${f}`);
    manifestLines.push('');
  }
  entries.push({
    name: 'MANIFEST.txt',
    data: Buffer.from(manifestLines.join('\n'), 'utf8'),
  });

  const zipBuffer = createZip(entries);
  const storagePath = `${organizationId}/section-exports/${Date.now()}.zip`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, zipBuffer, { contentType: 'application/zip', upsert: true });
  if (uploadError) throw new Error(`Section export upload failed: ${uploadError.message}`);

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 604800);

  return {
    signedUrl: signed?.signedUrl ?? '',
    fileCount: entries.length - 1, // exclude MANIFEST.txt from the count
  };
}
