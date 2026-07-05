"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOrganization } from "@/lib/organizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield,
  ArrowLeft,
  Search,
  Filter,
  ExternalLink,
  FileText,
  Globe,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Eyebrow } from "@/components/studio/eyebrow";
import { StateChip } from "@/components/studio/state-chip";
import { BigNumber } from "@/components/studio/big-number";
import type { WorkingTone } from "@/components/studio/theme";
import { fetchAssessments, deleteAssessment, getRiskLevelColor, getRiskLevelLabel } from "@/lib/greenwash";
import type { GreenwashAssessment } from "@/lib/types/greenwash";
import { format } from "date-fns";

const inputTypeIcons: Record<string, any> = {
  url: Globe,
  document: FileText,
  text: FileText,
  social_media: MessageSquare,
};

const inputTypeLabels: Record<string, string> = {
  url: "Website",
  document: "Document",
  text: "Text",
  social_media: "Social Media",
};

function RiskIndicator({ level }: { level: string | null }) {
  const colorName = getRiskLevelColor(level || "low");
  const Icon = level === "high" ? AlertTriangle : level === "medium" ? AlertCircle : CheckCircle;

  // Map colour names to working tones
  const tones: Record<string, WorkingTone> = {
    red: "stale",
    amber: "attention",
    green: "good",
    gray: "quiet",
  };
  const toneText: Record<WorkingTone, string> = {
    good: "text-studio-good",
    attention: "text-studio-attention",
    stale: "text-studio-stale",
    hold: "text-studio-hold",
    quiet: "text-studio-dim",
  };

  const tone = tones[colorName] || "quiet";

  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${toneText[tone]}`} />
      <StateChip tone={tone}>{getRiskLevelLabel(level || "low")}</StateChip>
    </div>
  );
}

function TrendVisualization({ assessments }: { assessments: GreenwashAssessment[] }) {
  // Sort by date ascending
  const sorted = [...assessments]
    .filter((a) => a.status === "completed" && a.overall_risk_score !== null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (sorted.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">Need at least 2 completed assessments to show trends.</p>
    );
  }

  // Calculate average risk score
  const avgRiskScore = sorted.reduce((sum, a) => sum + (a.overall_risk_score || 0), 0) / sorted.length;

  // Calculate trend (comparing first half to second half)
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstHalfAvg = firstHalf.reduce((sum, a) => sum + (a.overall_risk_score || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, a) => sum + (a.overall_risk_score || 0), 0) / secondHalf.length;

  const trendDirection = secondHalfAvg < firstHalfAvg ? "improving" : secondHalfAvg > firstHalfAvg ? "worsening" : "stable";
  const trendPercent = Math.abs(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100).toFixed(1);

  // Get recent assessments for the timeline
  const recentAssessments = sorted.slice(-10);
  const maxScore = 100;

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${
          trendDirection === "improving" ? "text-studio-good" :
          trendDirection === "worsening" ? "text-studio-stale" :
          "text-studio-dim"
        }`}>
          {trendDirection === "improving" ? (
            <TrendingDown className="h-5 w-5" />
          ) : trendDirection === "worsening" ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <Minus className="h-5 w-5" />
          )}
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
            {trendDirection === "improving" ? "Risk Improving" :
             trendDirection === "worsening" ? "Risk Increasing" : "Risk Stable"}
          </span>
          {trendDirection !== "stable" && (
            <span className="font-mono text-[10px] tabular-nums">({trendPercent}%)</span>
          )}
        </div>
        <div className="text-muted-foreground text-sm">
          Average Risk Score: <span className="text-foreground font-medium tabular-nums">{avgRiskScore.toFixed(0)}/100</span>
        </div>
      </div>

      {/* Simple Visual Timeline */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Recent Assessment Risk Scores</p>
        <div className="flex items-end gap-1 h-32">
          {recentAssessments.map((assessment, idx) => {
            const score = assessment.overall_risk_score || 0;
            const height = (score / maxScore) * 100;
            const color = assessment.overall_risk_level === "high" ? "bg-studio-stale" :
                          assessment.overall_risk_level === "medium" ? "bg-studio-attention" :
                          "bg-studio-good";

            return (
              <div key={assessment.id} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full ${color} rounded-t transition-all hover:opacity-80`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${assessment.title}: ${score}/100`}
                />
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-full">
                  {format(new Date(assessment.created_at), "MMM d")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function GreenwashHistoryPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [assessments, setAssessments] = useState<GreenwashAssessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<GreenwashAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadAssessments();
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    filterAssessments();
  }, [assessments, searchQuery, riskFilter, typeFilter]);

  async function loadAssessments() {
    if (!currentOrganization?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchAssessments(currentOrganization.id);
      setAssessments(data);
    } catch (error) {
      console.error("Error loading assessments:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function filterAssessments() {
    let filtered = [...assessments];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.input_source?.toLowerCase().includes(query) ||
          a.summary?.toLowerCase().includes(query)
      );
    }

    // Risk level filter
    if (riskFilter !== "all") {
      filtered = filtered.filter((a) => a.overall_risk_level === riskFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((a) => a.input_type === typeFilter);
    }

    setFilteredAssessments(filtered);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this assessment?")) return;

    setDeletingId(id);
    try {
      await deleteAssessment(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Error deleting assessment:", error);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/greenwash-guardian">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <div>
            <Eyebrow className="mb-3">THE EVIDENCE · GUARDIAN</Eyebrow>
            <h1 className="font-display text-2xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
              Assessment history.
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">View and manage past greenwash assessments</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-6 py-6">
        <Card className="rounded-[6px] mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assessments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Input Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="url">Website</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">Loading</p>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <Card className="rounded-[6px]">
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-medium text-foreground mb-2">No assessments found.</h3>
              <p className="text-muted-foreground mb-6">
                {assessments.length === 0
                  ? "You haven't created any assessments yet."
                  : "No assessments match your filters."}
              </p>
              <Link href="/greenwash-guardian">
                <Button className="bg-primary text-primary-foreground">
                  Create New Assessment
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAssessments.map((assessment) => {
              const TypeIcon = inputTypeIcons[assessment.input_type] || FileText;
              const isDeleting = deletingId === assessment.id;

              return (
                <Card
                  key={assessment.id}
                  className="rounded-[6px] hover:bg-secondary transition-colors"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <TypeIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-medium text-foreground truncate">
                              {assessment.title}
                            </h3>
                            <StateChip>{inputTypeLabels[assessment.input_type]}</StateChip>
                            {assessment.status === "processing" && (
                              <StateChip tone="hold">Processing</StateChip>
                            )}
                            {assessment.status === "failed" && (
                              <StateChip tone="stale">Failed</StateChip>
                            )}
                          </div>
                          {assessment.input_source && (
                            <p className="text-sm text-muted-foreground truncate mb-2">
                              {assessment.input_source}
                            </p>
                          )}
                          {assessment.summary && assessment.status === "completed" && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {assessment.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs font-mono text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(assessment.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {assessment.status === "completed" && assessment.overall_risk_level && (
                          <RiskIndicator level={assessment.overall_risk_level} />
                        )}
                        <div className="flex items-center gap-2">
                          {assessment.status === "completed" && (
                            <Link href={`/greenwash-guardian/${assessment.id}`}>
                              <Button variant="outline" size="sm">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Report
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(assessment.id)}
                            disabled={isDeleting}
                            className="text-muted-foreground hover:text-studio-stale"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Summary Stats */}
        {assessments.length > 0 && (
          <>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="rounded-[6px]">
                <CardContent className="p-4 text-center">
                  <BigNumber value={assessments.length} label="TOTAL ASSESSMENTS" className="text-center" />
                </CardContent>
              </Card>
              <Card className="rounded-[6px]">
                <CardContent className="p-4 text-center">
                  <BigNumber
                    value={assessments.filter((a) => a.overall_risk_level === "high").length}
                    label="HIGH RISK"
                    tone="stale"
                    className="text-center"
                  />
                </CardContent>
              </Card>
              <Card className="rounded-[6px]">
                <CardContent className="p-4 text-center">
                  <BigNumber
                    value={assessments.filter((a) => a.overall_risk_level === "medium").length}
                    label="MEDIUM RISK"
                    tone="attention"
                    className="text-center"
                  />
                </CardContent>
              </Card>
              <Card className="rounded-[6px]">
                <CardContent className="p-4 text-center">
                  <BigNumber
                    value={assessments.filter((a) => a.overall_risk_level === "low").length}
                    label="LOW RISK"
                    tone="good"
                    className="text-center"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Risk Trend Analysis */}
            {assessments.length >= 2 && (
              <Card className="mt-6 rounded-[6px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Risk Trend Analysis</CardTitle>
                  <CardDescription>
                    How your risk profile has changed over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendVisualization assessments={assessments} />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
