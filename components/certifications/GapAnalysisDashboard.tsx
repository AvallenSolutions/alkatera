'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  HelpCircle,
  Search,
  Filter,
  Target,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { StateChip } from '@/components/studio';
import type { WorkingTone } from '@/components/studio/theme';
import { evidenceVerificationTone } from '@/lib/certifications/status-tones';

interface GapAnalysis {
  id: string;
  requirement_id: string;
  compliance_status: 'not_assessed' | 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  current_score: number | null;
  gap_description: string | null;
  action_required: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  requirement?: {
    requirement_code: string;
    requirement_name: string;
    category: string;
    sub_category: string;
    points_available: number;
  };
}

interface GapSummary {
  total: number;
  compliant: number;
  partial: number;
  non_compliant: number;
  not_assessed: number;
  not_applicable: number;
  compliance_rate: number;
  total_points_available: number;
  total_points_achieved: number;
}

interface EvidenceItem {
  id: string;
  evidence_type: string;
  evidence_description: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  document_url?: string | null;
}

interface GapAnalysisDashboardProps {
  analyses: GapAnalysis[];
  analysesByCategory: Record<string, GapAnalysis[]>;
  summary: GapSummary | null;
  onUpdateStatus: (requirementId: string, status: GapAnalysis['compliance_status']) => void;
  loading?: boolean;
  evidenceByRequirement?: Record<string, EvidenceItem[]>;
}

const statusConfig = {
  not_assessed: {
    label: 'Not Assessed',
    color: 'text-studio-dim',
    icon: HelpCircle,
  },
  compliant: {
    label: 'Compliant',
    color: 'text-studio-good',
    icon: CheckCircle2,
  },
  partial: {
    label: 'Partial',
    color: 'text-studio-attention',
    icon: MinusCircle,
  },
  non_compliant: {
    label: 'Non-Compliant',
    color: 'text-studio-stale',
    icon: AlertCircle,
  },
  not_applicable: {
    label: 'N/A',
    color: 'text-studio-dim',
    icon: MinusCircle,
  },
};

const priorityTones: Record<string, WorkingTone> = {
  low: 'quiet',
  medium: 'hold',
  high: 'attention',
  critical: 'stale',
};

export function GapAnalysisDashboard({
  analyses,
  analysesByCategory,
  summary,
  onUpdateStatus,
  loading,
  evidenceByRequirement,
}: GapAnalysisDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());

  const toggleEvidence = (reqId: string) => {
    setExpandedEvidence(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reqId)) {
        newSet.delete(reqId);
      } else {
        newSet.add(reqId);
      }
      return newSet;
    });
  };

  const filteredCategories = Object.entries(analysesByCategory).reduce(
    (acc: Record<string, GapAnalysis[]>, [category, items]) => {
      const filtered = items.filter(item => {
        const matchesSearch =
          !searchTerm ||
          item.requirement?.requirement_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.requirement?.requirement_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || item.compliance_status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
      });
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <StatCard
            label="Compliance Rate"
            value={`${summary.compliance_rate}%`}
            icon={<Target className="h-4 w-4 text-room-accent" />}
          />
          <StatCard
            label="Compliant"
            value={summary.compliant}
            icon={<CheckCircle2 className="h-4 w-4 text-studio-good" />}
          />
          <StatCard
            label="Partial"
            value={summary.partial}
            icon={<MinusCircle className="h-4 w-4 text-studio-attention" />}
          />
          <StatCard
            label="Non-Compliant"
            value={summary.non_compliant}
            icon={<AlertCircle className="h-4 w-4 text-studio-stale" />}
          />
          <StatCard
            label="Not Assessed"
            value={summary.not_assessed}
            icon={<HelpCircle className="h-4 w-4 text-studio-dim" />}
          />
          <StatCard
            label="Points"
            value={`${summary.total_points_achieved}/${summary.total_points_available}`}
            icon={<Target className="h-4 w-4 text-room-accent" />}
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requirements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="compliant">Compliant</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                <SelectItem value="not_assessed">Not Assessed</SelectItem>
                <SelectItem value="not_applicable">N/A</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requirements by Category */}
      <Accordion type="multiple" className="space-y-4">
        {Object.entries(filteredCategories).map(([category, items]) => {
          const categoryCompliance = items.filter(i => i.compliance_status === 'compliant').length;
          const categoryTotal = items.length;
          const categoryPercent = Math.round((categoryCompliance / categoryTotal) * 100);

          return (
            <AccordionItem key={category} value={category} className="rounded-[6px] border border-studio-hairline">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-display text-sm font-semibold">{category}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <Progress value={categoryPercent} className="h-2" />
                    </div>
                    <span className="font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                      {categoryCompliance}/{categoryTotal}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {items.map((item) => {
                    const config = statusConfig[item.compliance_status];
                    const StatusIcon = config.icon;

                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-3 rounded-[6px] border border-studio-hairline bg-studio-cream"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                              {item.requirement?.requirement_code}
                            </code>
                            <span className="font-display text-sm font-semibold">
                              {item.requirement?.requirement_name}
                            </span>
                          </div>
                          {item.gap_description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.gap_description}
                            </p>
                          )}
                          {item.action_required && (
                            <p className="text-sm text-studio-attention mt-1">
                              Action: {item.action_required}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {item.requirement?.points_available && (
                              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                                {item.compliance_status === 'compliant'
                                  ? item.requirement.points_available
                                  : item.compliance_status === 'partial'
                                    ? Math.round(item.requirement.points_available * 0.5)
                                    : 0}/{item.requirement.points_available} pts
                              </span>
                            )}
                            {item.priority && (
                              <StateChip tone={priorityTones[item.priority]}>
                                {item.priority}
                              </StateChip>
                            )}
                            {evidenceByRequirement && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEvidence(item.requirement_id);
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <FileText className="h-3 w-3" />
                                {(evidenceByRequirement[item.requirement_id] || []).length} evidence
                                {expandedEvidence.has(item.requirement_id)
                                  ? <ChevronDown className="h-3 w-3" />
                                  : <ChevronRight className="h-3 w-3" />
                                }
                              </button>
                            )}
                          </div>
                          {/* Inline evidence list */}
                          {evidenceByRequirement && expandedEvidence.has(item.requirement_id) && (
                            <div className="mt-2 pl-2 border-l-2 border-studio-hairline space-y-1">
                              {(evidenceByRequirement[item.requirement_id] || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No evidence linked</p>
                              ) : (
                                (evidenceByRequirement[item.requirement_id] || []).map(ev => (
                                  <div key={ev.id} className="flex items-center gap-2 text-xs">
                                    <StateChip tone={evidenceVerificationTone(ev.verification_status)}>
                                      {ev.verification_status}
                                    </StateChip>
                                    <span className="truncate">{ev.evidence_description}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <Select
                            value={item.compliance_status}
                            onValueChange={(value) =>
                              onUpdateStatus(item.requirement_id, value as GapAnalysis['compliance_status'])
                            }
                          >
                            <SelectTrigger className={`w-[140px] ${config.color}`}>
                              <StatusIcon className="h-4 w-4 mr-1" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compliant">Compliant</SelectItem>
                              <SelectItem value="partial">Partial</SelectItem>
                              <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                              <SelectItem value="not_assessed">Not Assessed</SelectItem>
                              <SelectItem value="not_applicable">N/A</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {Object.keys(filteredCategories).length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No requirements match your filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
          {label}
        </span>
      </div>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
