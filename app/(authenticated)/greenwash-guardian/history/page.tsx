"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Trash2
} from "lucide-react";
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
  const color = getRiskLevelColor(level || "low");
  const Icon = level === "high" ? AlertTriangle : level === "medium" ? AlertCircle : CheckCircle;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium capitalize">{getRiskLevelLabel(level || "low")}</span>
    </div>
  );
}

export default function GreenwashHistoryPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<GreenwashAssessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<GreenwashAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadAssessments();
  }, []);

  useEffect(() => {
    filterAssessments();
  }, [assessments, searchQuery, riskFilter, typeFilter]);

  async function loadAssessments() {
    setIsLoading(true);
    try {
      const data = await fetchAssessments();
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-xl bg-white/5">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/greenwash-guardian">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Assessment History</h1>
              <p className="text-slate-400">View and manage past greenwash assessments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-6 py-6">
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search assessments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-white/5 border-white/10 text-white">
                  <Filter className="h-4 w-4 mr-2 text-slate-400" />
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
                <SelectTrigger className="w-full sm:w-48 bg-white/5 border-white/10 text-white">
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
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : filteredAssessments.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <h3 className="text-lg font-medium text-white mb-2">No assessments found</h3>
              <p className="text-slate-400 mb-6">
                {assessments.length === 0
                  ? "You haven't created any assessments yet."
                  : "No assessments match your filters."}
              </p>
              <Link href="/greenwash-guardian">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
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
                  className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                          <TypeIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-medium text-white truncate">
                              {assessment.title}
                            </h3>
                            <Badge variant="outline" className="text-slate-400 border-slate-600">
                              {inputTypeLabels[assessment.input_type]}
                            </Badge>
                            {assessment.status === "processing" && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Processing
                              </Badge>
                            )}
                            {assessment.status === "failed" && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                Failed
                              </Badge>
                            )}
                          </div>
                          {assessment.input_source && (
                            <p className="text-sm text-slate-500 truncate mb-2">
                              {assessment.input_source}
                            </p>
                          )}
                          {assessment.summary && assessment.status === "completed" && (
                            <p className="text-sm text-slate-400 line-clamp-2">
                              {assessment.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
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
                              <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/10">
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
                            className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
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
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white">{assessments.length}</div>
                <div className="text-sm text-slate-400">Total Assessments</div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-xl bg-red-500/10 border border-red-500/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {assessments.filter((a) => a.overall_risk_level === "high").length}
                </div>
                <div className="text-sm text-slate-400">High Risk</div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-xl bg-amber-500/10 border border-amber-500/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">
                  {assessments.filter((a) => a.overall_risk_level === "medium").length}
                </div>
                <div className="text-sm text-slate-400">Medium Risk</div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-xl bg-green-500/10 border border-green-500/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {assessments.filter((a) => a.overall_risk_level === "low").length}
                </div>
                <div className="text-sm text-slate-400">Low Risk</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
