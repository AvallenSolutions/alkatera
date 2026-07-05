"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Scale,
  Lightbulb,
  FileText,
} from "lucide-react";
import { StateChip } from "@/components/studio/state-chip";
import { BigNumber } from "@/components/studio/big-number";
import { fetchAssessmentWithClaims, deleteAssessment, getJurisdictionLabel } from "@/lib/greenwash";
import type { GreenwashAssessmentWithClaims, GreenwashAssessmentClaim } from "@/lib/types/greenwash";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";
// jsPDF is dynamically imported in handleExportPDF() to avoid loading
// the ~100KB library in the initial bundle. It's only needed when the
// user clicks "Export PDF".

export default function AssessmentReportPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<GreenwashAssessmentWithClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadAssessment() {
      try {
        const data = await fetchAssessmentWithClaims(assessmentId);
        setAssessment(data);

        // If still processing, poll for updates
        if (data?.status === 'processing' || data?.status === 'pending') {
          const interval = setInterval(async () => {
            const updated = await fetchAssessmentWithClaims(assessmentId);
            setAssessment(updated);
            if (updated?.status === 'completed' || updated?.status === 'failed') {
              clearInterval(interval);
            }
          }, 3000);
          return () => clearInterval(interval);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAssessment();
  }, [assessmentId]);

  const toggleClaimExpanded = (claimId: string) => {
    setExpandedClaims((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this assessment?")) return;

    try {
      await deleteAssessment(assessmentId);
      toast.success("Assessment deleted");
      router.push("/greenwash-guardian/history");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete assessment");
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!assessment || isExporting) return;
    setIsExporting(true);

    try {
      // Map assessment data to the format expected by the PDF API
      const pdfData = {
        url: assessment.input_source || assessment.title,
        overall_risk_level: assessment.overall_risk_level || 'medium',
        overall_risk_score: assessment.overall_risk_score || 0,
        summary: assessment.summary || '',
        recommendations: assessment.recommendations || [],
        legislation_applied: assessment.legislation_applied || [],
        claims: (assessment.claims || []).map(c => ({
          claim_text: c.claim_text,
          claim_context: c.claim_context,
          risk_level: c.risk_level,
          risk_score: c.risk_score || 0,
          issue_type: c.issue_type || 'unsubstantiated',
          issue_description: c.issue_description,
          legislation_name: c.legislation_name,
          legislation_article: c.legislation_article,
          legislation_jurisdiction: c.legislation_jurisdiction,
          suggestion: c.suggestion,
          suggested_revision: c.suggested_revision,
        })),
      };

      const response = await fetch('/api/greenwash/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData),
      });

      if (!response.ok) throw new Error('PDF generation failed');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `greenwash-assessment-${assessmentId.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("PDF exported successfully");
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return <PageLoader message="Loading assessment..." />;
  }

  if (error || !assessment) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Assessment not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isProcessing = assessment.status === "processing" || assessment.status === "pending";
  const isFailed = assessment.status === "failed";

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/greenwash-guardian")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Greenwash Guardian
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={isProcessing || isFailed || isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Generating...' : 'Export PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-studio-stale hover:text-studio-stale"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Disclaimer */}
        <Alert className="rounded-[6px] border-border bg-card">
          <Info className="h-4 w-4 text-studio-attention" />
          <AlertDescription className="text-muted-foreground">
            <strong className="text-foreground">Disclaimer:</strong> This report provides guidance only and is not legal advice.
            Consult qualified legal counsel for compliance decisions.
          </AlertDescription>
        </Alert>

        {/* Processing State */}
        {isProcessing && (
          <Card className="rounded-[6px]">
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 text-studio-brick mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">Analysing content.</h3>
              <p className="text-muted-foreground">
                We're reviewing your content against UK and EU anti-greenwashing legislation. Results appear here shortly.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Failed State */}
        {isFailed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Analysis failed: {assessment.error_message || "Unknown error"}
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {assessment.status === "completed" && (
          <>
            {/* Title & Overview Card */}
            <Card className="rounded-[6px]">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <Shield className="h-6 w-6 text-studio-brick" />
                      {assessment.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Analysed on {new Date(assessment.created_at).toLocaleDateString()} ·{" "}
                      {assessment.input_type === "url" ? "Website" :
                       assessment.input_type === "document" ? "Document" :
                       assessment.input_type === "social_media" ? "Social Media" : "Text"} Analysis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Risk Overview */}
                <div className="flex items-center gap-6 mb-6">
                  <div className="flex items-end gap-6 rounded-[6px] border border-border bg-secondary px-6 py-4">
                    <BigNumber
                      value={`${assessment.overall_risk_score}`}
                      label="RISK / 100"
                      tone={
                        assessment.overall_risk_level === "high" ? "stale" :
                        assessment.overall_risk_level === "medium" ? "attention" :
                        "good"
                      }
                    />
                    <StateChip
                      tone={
                        assessment.overall_risk_level === "high" ? "stale" :
                        assessment.overall_risk_level === "medium" ? "attention" :
                        "good"
                      }
                      className="pb-1"
                    >
                      {assessment.overall_risk_level} risk
                    </StateChip>
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground">{assessment.summary}</p>
                  </div>
                </div>

                {/* Legislation Applied */}
                {assessment.legislation_applied && assessment.legislation_applied.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Legislation Applied
                    </h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {assessment.legislation_applied.map((leg, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-studio-dim"
                        >
                          {getJurisdictionLabel(leg.jurisdiction)} · {leg.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Claims Section */}
            {assessment.claims && assessment.claims.length > 0 && (
              <Card className="rounded-[6px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-studio-brick" />
                    Identified Claims ({assessment.claims.length})
                  </CardTitle>
                  <CardDescription>
                    Environmental claims found in your content with risk assessments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assessment.claims.map((claim) => (
                    <ClaimCard
                      key={claim.id}
                      claim={claim}
                      isExpanded={expandedClaims.has(claim.id)}
                      onToggle={() => toggleClaimExpanded(claim.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {assessment.recommendations && assessment.recommendations.length > 0 && (
              <Card className="rounded-[6px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-studio-brick" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {assessment.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-foreground">
                        <span className="flex-shrink-0 font-mono text-[11px] font-bold text-studio-brick tabular-nums pt-0.5">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* No Claims Found */}
            {(!assessment.claims || assessment.claims.length === 0) && (
              <Card className="rounded-[6px]">
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-studio-good mx-auto mb-4" />
                  <h3 className="font-display text-xl font-semibold text-foreground mb-2">No issues found.</h3>
                  <p className="text-muted-foreground">
                    We didn&apos;t identify any significant greenwashing risks in your content.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClaimCard({
  claim,
  isExpanded,
  onToggle,
}: {
  claim: GreenwashAssessmentClaim;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const riskTone =
    claim.risk_level === "high" ? "stale" :
    claim.risk_level === "medium" ? "attention" :
    "good";
  const riskTextClass =
    claim.risk_level === "high" ? "text-studio-stale" :
    claim.risk_level === "medium" ? "text-studio-attention" :
    "text-studio-good";

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-[6px] border border-border bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-start gap-4 text-left hover:bg-secondary transition-colors rounded-[6px]">
            <div className="flex-shrink-0 pt-0.5">
              {claim.risk_level === "high" ? (
                <AlertTriangle className={`h-4 w-4 ${riskTextClass}`} />
              ) : claim.risk_level === "medium" ? (
                <AlertCircle className={`h-4 w-4 ${riskTextClass}`} />
              ) : (
                <CheckCircle2 className={`h-4 w-4 ${riskTextClass}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium">&quot;{claim.claim_text}&quot;</p>
              <p className="text-muted-foreground text-sm mt-1 truncate">
                {claim.issue_description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StateChip tone={riskTone}>{claim.risk_level}</StateChip>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-4">
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-muted-foreground mb-1">Issue Type</h5>
                <p className="text-foreground">{claim.issue_type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
              </div>
              <div>
                <h5 className="text-sm font-medium text-muted-foreground mb-1">Risk Score</h5>
                <p className="text-foreground tabular-nums">{claim.risk_score}/100</p>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-medium text-muted-foreground mb-1">Issue Description</h5>
              <p className="text-foreground">{claim.issue_description}</p>
            </div>

            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Legislation:</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-studio-dim">
                {getJurisdictionLabel(claim.legislation_jurisdiction)} · {claim.legislation_name}
                {claim.legislation_article && ` (${claim.legislation_article})`}
              </span>
            </div>

            <div className="bg-secondary border border-border rounded-[6px] p-4">
              <h5 className="text-sm font-medium text-studio-good mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Suggestion
              </h5>
              <p className="text-foreground">{claim.suggestion}</p>
              {claim.suggested_revision && (
                <div className="mt-3 p-3 bg-card border border-border rounded-[6px]">
                  <h6 className="text-xs font-medium text-muted-foreground mb-1">Suggested Revision:</h6>
                  <p className="text-foreground italic">&quot;{claim.suggested_revision}&quot;</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
