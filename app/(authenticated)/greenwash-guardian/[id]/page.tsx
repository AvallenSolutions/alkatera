"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ExternalLink,
  Loader2,
  Scale,
  Lightbulb,
  FileText,
} from "lucide-react";
import { fetchAssessmentWithClaims, deleteAssessment, getRiskLevelColor, getJurisdictionLabel } from "@/lib/greenwash";
import type { GreenwashAssessmentWithClaims, GreenwashAssessmentClaim } from "@/lib/types/greenwash";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";
import jsPDF from "jspdf";

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

  const handleExportPDF = () => {
    if (!assessment) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("Greenwash Risk Assessment Report", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Assessment title
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "normal");
    pdf.text(assessment.title, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Date
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Disclaimer
    pdf.setFillColor(255, 243, 205);
    pdf.rect(15, yPos, pageWidth - 30, 20, "F");
    pdf.setFontSize(9);
    pdf.text(
      "DISCLAIMER: This report provides guidance only and is not legal advice.",
      pageWidth / 2,
      yPos + 8,
      { align: "center" }
    );
    pdf.text(
      "Consult qualified legal counsel for compliance decisions.",
      pageWidth / 2,
      yPos + 14,
      { align: "center" }
    );
    yPos += 30;

    // Overall Risk
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Overall Risk Assessment", 15, yPos);
    yPos += 8;

    const riskColor = assessment.overall_risk_level === "high" ? [220, 38, 38] :
                      assessment.overall_risk_level === "medium" ? [217, 119, 6] :
                      [34, 197, 94];
    pdf.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
    pdf.circle(20, yPos + 3, 4, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(
      `${assessment.overall_risk_level?.toUpperCase()} RISK (Score: ${assessment.overall_risk_score}/100)`,
      30,
      yPos + 5
    );
    yPos += 15;

    // Summary
    if (assessment.summary) {
      pdf.setFontSize(11);
      const summaryLines = pdf.splitTextToSize(assessment.summary, pageWidth - 30);
      pdf.text(summaryLines, 15, yPos);
      yPos += summaryLines.length * 5 + 10;
    }

    // Claims
    if (assessment.claims && assessment.claims.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Identified Claims (${assessment.claims.length})`, 15, yPos);
      yPos += 10;

      for (const claim of assessment.claims) {
        // Check if we need a new page
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }

        const claimRiskColor = claim.risk_level === "high" ? [220, 38, 38] :
                               claim.risk_level === "medium" ? [217, 119, 6] :
                               [34, 197, 94];
        pdf.setFillColor(claimRiskColor[0], claimRiskColor[1], claimRiskColor[2]);
        pdf.circle(18, yPos + 3, 3, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        const claimText = pdf.splitTextToSize(`"${claim.claim_text}"`, pageWidth - 40);
        pdf.text(claimText, 25, yPos + 4);
        yPos += claimText.length * 5 + 5;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const issueText = pdf.splitTextToSize(`Issue: ${claim.issue_description}`, pageWidth - 40);
        pdf.text(issueText, 25, yPos);
        yPos += issueText.length * 4 + 3;

        pdf.text(`Legislation: ${claim.legislation_name}`, 25, yPos);
        yPos += 5;

        const suggestionText = pdf.splitTextToSize(`Suggestion: ${claim.suggestion}`, pageWidth - 40);
        pdf.text(suggestionText, 25, yPos);
        yPos += suggestionText.length * 4 + 10;
      }
    }

    // Recommendations
    if (assessment.recommendations && assessment.recommendations.length > 0) {
      if (yPos > 230) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Recommendations", 15, yPos);
      yPos += 10;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      for (const rec of assessment.recommendations) {
        const recText = pdf.splitTextToSize(`• ${rec}`, pageWidth - 35);
        pdf.text(recText, 20, yPos);
        yPos += recText.length * 5 + 3;
      }
    }

    // Save
    pdf.save(`greenwash-assessment-${assessmentId.substring(0, 8)}.pdf`);
    toast.success("PDF exported successfully");
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

  const RiskIndicator = ({ level }: { level: string }) => {
    const color = getRiskLevelColor(level);
    const Icon = level === "high" ? AlertTriangle :
                 level === "medium" ? AlertCircle :
                 CheckCircle2;

    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-${color}-500/20 border border-${color}-500/30`}>
        <Icon className={`h-5 w-5 text-${color}-400`} />
        <span className={`font-semibold text-${color}-400 uppercase`}>
          {level} Risk
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto p-6 max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/greenwash-guardian")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Greenwash Guardian
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={isProcessing || isFailed}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Disclaimer */}
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <Info className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            <strong>Disclaimer:</strong> This report provides guidance only and is not legal advice.
            Consult qualified legal counsel for compliance decisions.
          </AlertDescription>
        </Alert>

        {/* Processing State */}
        {isProcessing && (
          <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Analyzing Content</h3>
              <p className="text-slate-400">
                Our AI is reviewing your content against UK and EU anti-greenwashing legislation...
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
            <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white text-2xl flex items-center gap-3">
                      <Shield className="h-6 w-6 text-emerald-400" />
                      {assessment.title}
                    </CardTitle>
                    <CardDescription className="text-slate-400 mt-2">
                      Analyzed on {new Date(assessment.created_at).toLocaleDateString()} •{" "}
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
                  <div className={`flex items-center gap-3 px-6 py-4 rounded-xl ${
                    assessment.overall_risk_level === "high" ? "bg-red-500/20 border border-red-500/30" :
                    assessment.overall_risk_level === "medium" ? "bg-amber-500/20 border border-amber-500/30" :
                    "bg-green-500/20 border border-green-500/30"
                  }`}>
                    {assessment.overall_risk_level === "high" ? (
                      <AlertTriangle className="h-8 w-8 text-red-400" />
                    ) : assessment.overall_risk_level === "medium" ? (
                      <AlertCircle className="h-8 w-8 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    )}
                    <div>
                      <p className={`text-2xl font-bold ${
                        assessment.overall_risk_level === "high" ? "text-red-400" :
                        assessment.overall_risk_level === "medium" ? "text-amber-400" :
                        "text-green-400"
                      }`}>
                        {assessment.overall_risk_level?.toUpperCase()} RISK
                      </p>
                      <p className="text-slate-400 text-sm">
                        Score: {assessment.overall_risk_score}/100
                      </p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-300">{assessment.summary}</p>
                  </div>
                </div>

                {/* Legislation Applied */}
                {assessment.legislation_applied && assessment.legislation_applied.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Legislation Applied
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {assessment.legislation_applied.map((leg, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="bg-white/5 border-white/20 text-slate-300"
                        >
                          {getJurisdictionLabel(leg.jurisdiction)} • {leg.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Claims Section */}
            {assessment.claims && assessment.claims.length > 0 && (
              <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-400" />
                    Identified Claims ({assessment.claims.length})
                  </CardTitle>
                  <CardDescription className="text-slate-400">
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
              <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-400" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {assessment.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-slate-300">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">
                          {idx + 1}
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
              <Card className="backdrop-blur-xl bg-green-500/10 border border-green-500/30">
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Issues Found</h3>
                  <p className="text-slate-400">
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
  const riskColor = claim.risk_level === "high" ? "red" :
                    claim.risk_level === "medium" ? "amber" :
                    "green";

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={`rounded-lg border ${
        claim.risk_level === "high" ? "bg-red-500/10 border-red-500/30" :
        claim.risk_level === "medium" ? "bg-amber-500/10 border-amber-500/30" :
        "bg-green-500/10 border-green-500/30"
      }`}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-start gap-4 text-left hover:bg-white/5 transition-colors rounded-lg">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              claim.risk_level === "high" ? "bg-red-500/20" :
              claim.risk_level === "medium" ? "bg-amber-500/20" :
              "bg-green-500/20"
            }`}>
              {claim.risk_level === "high" ? (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              ) : claim.risk_level === "medium" ? (
                <AlertCircle className="h-4 w-4 text-amber-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">&quot;{claim.claim_text}&quot;</p>
              <p className="text-slate-400 text-sm mt-1 truncate">
                {claim.issue_description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${
                claim.risk_level === "high" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                claim.risk_level === "medium" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                "bg-green-500/20 text-green-400 border-green-500/30"
              }`}>
                {claim.risk_level.toUpperCase()}
              </Badge>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-4">
            <Separator className="bg-white/10" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-slate-400 mb-1">Issue Type</h5>
                <p className="text-white">{claim.issue_type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
              </div>
              <div>
                <h5 className="text-sm font-medium text-slate-400 mb-1">Risk Score</h5>
                <p className="text-white">{claim.risk_score}/100</p>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-1">Issue Description</h5>
              <p className="text-slate-300">{claim.issue_description}</p>
            </div>

            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-400">Legislation:</span>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {getJurisdictionLabel(claim.legislation_jurisdiction)} • {claim.legislation_name}
                {claim.legislation_article && ` (${claim.legislation_article})`}
              </Badge>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <h5 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Suggestion
              </h5>
              <p className="text-slate-300">{claim.suggestion}</p>
              {claim.suggested_revision && (
                <div className="mt-3 p-3 bg-white/5 rounded-lg">
                  <h6 className="text-xs font-medium text-slate-400 mb-1">Suggested Revision:</h6>
                  <p className="text-white italic">&quot;{claim.suggested_revision}&quot;</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
