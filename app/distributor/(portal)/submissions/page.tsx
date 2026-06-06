import type { SupabaseClient } from '@supabase/supabase-js';
import { Inbox } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { SubmissionsList, type SubmissionRow } from '@/components/distributor/documents/submissions-list';

export const dynamic = 'force-dynamic';

/**
 * Org-wide brand-submission inbox.
 *
 * Brands self-upload documents (LCA/carbon/cert PDFs etc.) via their
 * outreach link; each lands in brand_document_submissions and is processed
 * by the document-queue cron. A per-brand list existed
 * (/brands/[id]/documents) but nothing surfaced submissions across the
 * portfolio, so failed extractions in particular went unnoticed with no
 * way to retry. This is the single inbox: every submission, its status,
 * what was extracted, and a retry for anything that errored.
 */
export default async function SubmissionsPage() {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;
  const canManage = member.role !== 'viewer';

  const { data: brands } = await supabase
    .from('brand_profiles')
    .select('brand_directory_id, name')
    .eq('distributor_org_id', member.distributor_org_id);
  const brandList = (brands ?? []) as Array<{ brand_directory_id: string; name: string }>;

  const nameByDirectory = new Map<string, string>();
  for (const b of brandList) {
    if (b.brand_directory_id && !nameByDirectory.has(b.brand_directory_id)) {
      nameByDirectory.set(b.brand_directory_id, b.name);
    }
  }
  const directoryIds = Array.from(nameByDirectory.keys());

  let rows: SubmissionRow[] = [];
  if (directoryIds.length > 0) {
    const { data: subs } = (await supabase
      .from('brand_document_submissions')
      .select(
        'id, brand_directory_id, file_name, document_type, file_size_bytes, vintage_year, batch_reference, submitter_name, submitter_email, notes, processing_status, extracted_data, created_at',
      )
      .in('brand_directory_id', directoryIds)
      .order('created_at', { ascending: false })) as {
      data: Array<{
        id: string;
        brand_directory_id: string;
        file_name: string;
        document_type: string;
        file_size_bytes: number | null;
        vintage_year: number | null;
        batch_reference: string | null;
        submitter_name: string | null;
        submitter_email: string | null;
        notes: string | null;
        processing_status: string;
        extracted_data: { extracted_count?: number } | null;
        created_at: string;
      }> | null;
    };
    const submissions = subs ?? [];

    // Latest processing job per submission → error message + counts.
    const submissionIds = submissions.map((s) => s.id);
    const latestJobBySubmission = new Map<
      string,
      { fields_extracted: number; fields_conflicted: number; error_message: string | null }
    >();
    if (submissionIds.length > 0) {
      const { data: jobs } = (await supabase
        .from('document_processing_jobs')
        .select('submission_id, fields_extracted, fields_conflicted, error_message, created_at')
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: false })) as {
        data: Array<{
          submission_id: string;
          fields_extracted: number;
          fields_conflicted: number;
          error_message: string | null;
          created_at: string;
        }> | null;
      };
      // Rows arrive newest-first, so the first seen per submission is latest.
      for (const j of jobs ?? []) {
        if (!latestJobBySubmission.has(j.submission_id)) {
          latestJobBySubmission.set(j.submission_id, {
            fields_extracted: j.fields_extracted,
            fields_conflicted: j.fields_conflicted,
            error_message: j.error_message,
          });
        }
      }
    }

    rows = submissions.map((s) => {
      const job = latestJobBySubmission.get(s.id);
      return {
        id: s.id,
        brand_name: nameByDirectory.get(s.brand_directory_id) ?? null,
        file_name: s.file_name,
        document_type: s.document_type,
        file_size_bytes: s.file_size_bytes,
        vintage_year: s.vintage_year,
        batch_reference: s.batch_reference,
        submitter_name: s.submitter_name,
        submitter_email: s.submitter_email,
        notes: s.notes,
        processing_status: s.processing_status,
        extracted_count: job?.fields_extracted ?? s.extracted_data?.extracted_count ?? null,
        conflicted_count: job?.fields_conflicted ?? null,
        error_message: job?.error_message ?? null,
        created_at: s.created_at,
      };
    });
  }

  const errorCount = rows.filter((r) => r.processing_status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-500/15 border border-sky-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <Inbox className="h-6 w-6 text-sky-300" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              {rows.length} document{rows.length === 1 ? '' : 's'}
              {errorCount > 0 ? ` · ${errorCount} need attention` : ''}
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Submissions</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Documents brands have uploaded via their outreach links, across your whole portfolio.
              Open any file to inspect the source, and retry anything whose processing failed.
            </p>
          </div>
        </div>
      </div>

      <SubmissionsList submissions={rows} canManage={canManage} />
    </div>
  );
}
