"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { VerificationCard } from '@/components/partners/VerificationCard';
import { HOSPITALITY_KINDS } from '@/lib/hospitality/constants';
import { Eyebrow, StateChip, Statement, BigNumber, Panel, PillButton } from '@/components/studio';
import type { WorkingTone } from '@/components/studio';

interface LCAReport {
  id: string;
  product_id: number | null;
  product_name: string;
  title: string;
  version: string;
  status: 'completed' | 'draft' | 'in_progress';
  dqi_score: number;
  system_boundary: string;
  functional_unit: string;
  assessment_period: string;
  published_at: string | null;
  total_co2e: number;
}

export default function LcasPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<LCAReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchLCAReports();
    }
  }, [currentOrganization]);

  const fetchLCAReports = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      // Fetch product LCAs for the organisation, excluding superseded/failed records.
      // Only show 'completed' and 'draft' (in-progress wizard) records.
      // 'pending' records are mid-calculation and not meaningful to display.
      // 'superseded' records are old calculations replaced by newer ones.
      const { data: lcas, error: lcaError } = await supabase
        .from('product_carbon_footprints')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .in('status', ['completed', 'draft'])
        .order('created_at', { ascending: false });

      if (lcaError) {
        console.error('Error fetching LCAs:', lcaError);
        setReports([]);
        return;
      }

      if (!lcas || lcas.length === 0) {
        setReports([]);
        return;
      }

      // Hospitality meals/drinks/rooms are `product_carbon_footprints` rows too,
      // but they belong on the hospitality surfaces, not the product-LCA list —
      // exclude them so they don't pollute the drinks LCA reports.
      const { data: hospProducts } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', currentOrganization!.id)
        .in('product_kind', HOSPITALITY_KINDS as unknown as string[]);
      const hospitalityProductIds = new Set((hospProducts ?? []).map((p: any) => Number(p.id)));
      const visibleLcas = lcas.filter(
        (lca: any) => lca.product_id == null || !hospitalityProductIds.has(Number(lca.product_id)),
      );

      if (visibleLcas.length === 0) {
        setReports([]);
        return;
      }

      // Transform the data - single source of truth: aggregated_impacts.climate_change_gwp100
      const transformedReports: LCAReport[] = visibleLcas.map((lca: any) => {
        // Get total GHG emissions from aggregated_impacts JSONB field (single source of truth)
        const totalCO2e = lca.aggregated_impacts?.climate_change_gwp100 || 0;

        // Use the real DQI score from the database when available (set by the aggregator).
        // Only fall back to heuristic if the DB value is missing.
        const dqiScore = typeof lca.dqi_score === 'number' && lca.dqi_score > 0
          ? lca.dqi_score
          : lca.status === 'completed' ? 85 : 50;

        const productName = lca.product_name || 'Unknown Product';
        const functionalUnit = lca.functional_unit || 'per unit';

        return {
          id: lca.id,
          product_id: lca.product_id,
          product_name: productName,
          title: `${new Date(lca.created_at).getFullYear()} LCA Study`,
          version: '1.0',
          status: lca.status as 'completed' | 'draft' | 'in_progress',
          dqi_score: dqiScore,
          system_boundary: lca.system_boundary || 'cradle-to-gate',
          functional_unit: functionalUnit,
          assessment_period: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
          published_at: lca.status === 'completed' ? lca.updated_at : null,
          total_co2e: totalCO2e,
        };
      });

      setReports(transformedReports);
    } catch (error) {
      console.error('Failed to fetch LCA reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch PDF from the generate-pdf API with the user's auth token.
   * Returns the blob on success, or null on failure.
   */
  const fetchPdfBlob = useCallback(async (pcfId: string): Promise<Blob | null> => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('Not authenticated');
      return null;
    }

    const response = await fetch(`/api/lca/${pcfId}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ includeNarratives: false, inline: true }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('PDF generation failed:', err);
      return null;
    }

    return response.blob();
  }, []);

  /** Open the PDF in a new browser tab for viewing. */
  const handleViewReport = useCallback(async (pcfId: string) => {
    setLoadingPdf(pcfId);
    try {
      const blob = await fetchPdfBlob(pcfId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Revoke after a short delay so the new tab has time to load
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } finally {
      setLoadingPdf(null);
    }
  }, [fetchPdfBlob]);

  /** Download the PDF to the user's device. */
  const handleDownloadReport = useCallback(async (pcfId: string, productName: string) => {
    setDownloadingPdf(pcfId);
    try {
      const blob = await fetchPdfBlob(pcfId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LCA_Report_${productName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloadingPdf(null);
    }
  }, [fetchPdfBlob]);

  const filteredReports = reports.filter(report =>
    report.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedCount = reports.filter(r => r.status === 'completed').length;
  const avgDqi = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + r.dqi_score, 0) / reports.length)
    : 0;

  const getStatusChip = (status: string): { tone: WorkingTone; label: string } => {
    const config: Record<string, { tone: WorkingTone; label: string }> = {
      completed: { tone: 'good', label: 'Completed' },
      published: { tone: 'good', label: 'Published' },
      verified: { tone: 'good', label: 'Verified' },
      draft: { tone: 'quiet', label: 'Draft' },
      in_progress: { tone: 'attention', label: 'In progress' },
    };
    return config[status] || config.draft;
  };

  const getDQIChip = (score: number): { tone: WorkingTone; label: string } => {
    if (score >= 80) return { tone: 'good', label: 'High confidence' };
    if (score >= 50) return { tone: 'attention', label: 'Medium confidence' };
    return { tone: 'stale', label: 'Modelled' };
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      {/* The statement */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Statement eyebrow="THE CELLAR · LCAS" headline="The life cycle assessments." />
        <PillButton href="/products">Create new LCA</PillButton>
      </div>

      {loading ? (
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Loading
        </p>
      ) : reports.length === 0 ? (
        <section className="border-t border-studio-hairline pt-6">
          <p className="text-sm text-muted-foreground">
            No life cycle assessments yet. Complete a product footprint to generate your first
            report.
          </p>
          <PillButton href="/products" variant="outline" size="sm" className="mt-4">
            Go to products
          </PillButton>
        </section>
      ) : (
        <>
          {/* The figures, one hairline row */}
          <div className="flex flex-wrap items-end gap-x-12 gap-y-4 border-t border-studio-hairline pt-5">
            <BigNumber size="display" value={reports.length} label="Reports" />
            <BigNumber size="display" value={avgDqi} label="Average DQI" />
            <BigNumber size="display" value={completedCount} label="ISO 14044 complete" />
          </div>

          {/* Search over the loaded reports */}
          <div className="max-w-sm">
            <Input
              placeholder="Search by product or report..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Reports */}
          {filteredReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports match your search.</p>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const statusChip = getStatusChip(report.status);
                const dqiChip = getDQIChip(report.dqi_score);

                return (
                  <Panel key={report.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="font-display text-lg font-semibold text-foreground">
                            {report.product_name}
                          </h2>
                          <StateChip tone={statusChip.tone}>{statusChip.label}</StateChip>
                          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-dim">
                            v{report.version}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{report.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {report.functional_unit} · {report.assessment_period}
                          {report.published_at && (
                            <> · Published {new Date(report.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
                          DQI
                        </span>
                        <span className="font-display text-sm font-semibold text-foreground">
                          {report.dqi_score}/100
                        </span>
                        <StateChip tone={dqiChip.tone}>{dqiChip.label}</StateChip>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-4 border-t border-studio-hairline pt-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                        <BigNumber
                          size="panel"
                          value={report.total_co2e.toFixed(3)}
                          label="kg CO₂e"
                        />
                        <div>
                          <p className="font-display text-sm font-medium text-foreground">
                            {report.system_boundary}
                          </p>
                          <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
                            System boundary
                          </p>
                        </div>
                        <div>
                          <p className="font-display text-sm font-medium text-foreground">
                            ISO 14044
                          </p>
                          <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
                            Standard
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {report.status === 'completed' ? (
                          <>
                            <PillButton
                              size="sm"
                              disabled={loadingPdf === report.id}
                              onClick={() => handleViewReport(report.id)}
                            >
                              {loadingPdf === report.id ? 'Preparing...' : 'View report'}
                            </PillButton>
                            <PillButton
                              variant="outline"
                              size="sm"
                              disabled={downloadingPdf === report.id}
                              onClick={() => handleDownloadReport(report.id, report.product_name)}
                            >
                              {downloadingPdf === report.id ? 'Preparing...' : 'Download'}
                            </PillButton>
                          </>
                        ) : (
                          <PillButton
                            href={`/products/${report.product_id}/compliance-wizard`}
                            variant="room"
                            size="sm"
                          >
                            Continue wizard
                          </PillButton>
                        )}
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Expert Verification */}
      <VerificationCard variant="lca" />

      {/* About these reports */}
      <section className="max-w-3xl border-t border-studio-hairline pt-4">
        <Eyebrow tone="dim" className="mb-2">About these reports</Eyebrow>
        <p className="text-sm text-muted-foreground">
          Life cycle assessments give a full environmental profile of your products, following
          ISO 14044:2006. Each report covers cradle-to-gate impacts across climate change, water
          use, land use and resource depletion.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          A data quality indicator above 80 means a report is strong enough for external disclosure
          under CSRD and the GHG Protocol Product Standard.
        </p>
      </section>
    </div>
  );
}
