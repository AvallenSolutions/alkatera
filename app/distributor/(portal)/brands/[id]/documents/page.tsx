import type { SupabaseClient } from '@supabase/supabase-js';
import { FileText, Inbox } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

const DOC_LABELS: Record<string, string> = {
  lca_report: 'LCA report',
  carbon_report: 'Carbon footprint report',
  water_usage: 'Water usage data',
  sustainability_report: 'Sustainability report',
  packaging_data: 'Packaging data',
  certification: 'Certification',
  esg_report: 'ESG report',
  other: 'Other',
};

const STATUS_COLOURS: Record<string, string> = {
  pending: 'text-muted-foreground border-muted bg-muted/30',
  processing: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
  complete: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  error: 'text-destructive border-destructive/30 bg-destructive/10',
};

export default async function BrandDocumentsTabPage({ params }: PageProps) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, brand_directory_id')
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle();
  if (!brand) return null;
  const directoryId = (brand as { brand_directory_id: string }).brand_directory_id;

  const { data: documents } = (await supabase
    .from('brand_document_submissions')
    .select(
      'id, file_name, document_type, file_size_bytes, vintage_year, batch_reference, submitter_name, submitter_email, processing_status, extracted_data, created_at',
    )
    .eq('brand_directory_id', directoryId)
    .order('created_at', { ascending: false })) as {
    data: Array<{
      id: string;
      file_name: string;
      document_type: string;
      file_size_bytes: number | null;
      vintage_year: number | null;
      batch_reference: string | null;
      submitter_name: string | null;
      submitter_email: string | null;
      processing_status: string;
      extracted_data: { extracted_count?: number } | null;
      created_at: string;
    }> | null;
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-background/30 py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <div className="rounded-lg bg-sky-500/10 border border-sky-400/30 p-3">
          <FileText className="h-5 w-5 text-sky-300" />
        </div>
        <p className="max-w-xs text-center">
          Nothing submitted yet. Once the brand uploads documents via the outreach link they will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-400/30 px-2.5 py-1 text-sky-300">
          <FileText className="h-3 w-3" />
          {documents.length} document{documents.length === 1 ? '' : 's'}
        </span>
        <span className="normal-case tracking-normal text-muted-foreground">
          Latest first. Click to inspect extracted fields on the Data tab.
        </span>
      </div>

      <ul className="space-y-3">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-4 flex items-start gap-3 hover:from-sky-500/10 transition-colors"
          >
            <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-2 shrink-0">
              <FileText className="h-4 w-4 text-sky-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold truncate">{doc.file_name}</div>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wider font-semibold ${
                    STATUS_COLOURS[doc.processing_status] ?? 'text-muted-foreground'
                  }`}
                >
                  {doc.processing_status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-sky-300/90 font-medium">
                  {DOC_LABELS[doc.document_type] ?? doc.document_type}
                </span>
                {doc.vintage_year && <span>· {doc.vintage_year}</span>}
                {doc.batch_reference && <span>· {doc.batch_reference}</span>}
                {doc.file_size_bytes != null && <span>· {formatBytes(doc.file_size_bytes)}</span>}
                {doc.extracted_data?.extracted_count != null && (
                  <span className="text-emerald-300/90 font-medium">
                    · {doc.extracted_data.extracted_count} fields extracted
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">
                Submitted by{' '}
                <span className="text-foreground/80 font-medium">
                  {doc.submitter_name ?? 'unknown'}
                </span>
                {doc.submitter_email && <> ({doc.submitter_email})</>} ·{' '}
                {new Date(doc.created_at).toLocaleString()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
