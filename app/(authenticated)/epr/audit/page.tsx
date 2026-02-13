'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  History,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  RefreshCw,
  User,
  Clock,
  FileText,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldChange {
  old: unknown;
  new: unknown;
}

interface AuditEntry {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_changes: Record<string, FieldChange> | null;
  snapshot: Record<string, unknown> | null;
  notes: string | null;
  performed_by: string | null;
  performed_by_name: string;
  performed_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface AuditResponse {
  entries: AuditEntry[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'settings', label: 'Settings' },
  { value: 'submission', label: 'Submission' },
  { value: 'submission_line', label: 'Submission Line' },
  { value: 'prn_obligation', label: 'PRN Obligation' },
];

const ACTION_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'generate_csv', label: 'Generate CSV' },
  { value: 'submit', label: 'Submit' },
  { value: 'approve', label: 'Approve' },
  { value: 'amend', label: 'Amend' },
  { value: 'estimate_nations', label: 'Estimate Nations' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatTimestamp(iso);
  } catch {
    return iso;
  }
}

function actionBadge(action: string) {
  switch (action) {
    case 'create':
      return <Badge variant="success">Create</Badge>;
    case 'update':
      return <Badge variant="info">Update</Badge>;
    case 'delete':
      return <Badge variant="destructive">Delete</Badge>;
    case 'generate_csv':
      return <Badge className="bg-purple-500/10 text-purple-500 border-transparent">Generate CSV</Badge>;
    case 'submit':
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-transparent">Submit</Badge>;
    case 'approve':
      return <Badge className="bg-green-600/10 text-green-600 border-transparent">Approve</Badge>;
    case 'amend':
      return <Badge variant="warning">Amend</Badge>;
    case 'estimate_nations':
      return <Badge className="bg-cyan-500/10 text-cyan-500 border-transparent">Estimate Nations</Badge>;
    default:
      return <Badge variant="outline">{action}</Badge>;
  }
}

function entityTypeLabel(entityType: string): string {
  switch (entityType) {
    case 'settings':
      return 'Settings';
    case 'submission':
      return 'Submission';
    case 'submission_line':
      return 'Submission Line';
    case 'prn_obligation':
      return 'PRN Obligation';
    default:
      return entityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function generateCSVExport(entries: AuditEntry[]): string {
  const headers = [
    'Timestamp',
    'User',
    'Action',
    'Entity Type',
    'Entity ID',
    'Changed Fields',
    'Notes',
  ];
  const rows = entries.map((entry) => {
    const changes = entry.field_changes
      ? Object.entries(entry.field_changes)
          .map(([key, val]) => `${key}: ${formatFieldValue(val.old)} -> ${formatFieldValue(val.new)}`)
          .join('; ')
      : '';
    return [
      entry.performed_at,
      entry.performed_by_name,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      changes,
      entry.notes || '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Audit Entry Card
// ---------------------------------------------------------------------------

function AuditEntryCard({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const fieldChanges = entry.field_changes ? Object.entries(entry.field_changes) : [];

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-4">
          {/* Left: timestamp + user + action */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {actionBadge(entry.action)}
              <span className="text-sm font-medium">
                {entityTypeLabel(entry.entity_type)}
              </span>
              <span className="text-xs text-muted-foreground font-mono truncate">
                {entry.entity_id}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.performed_by_name}
              </span>
              <span className="flex items-center gap-1" title={formatTimestamp(entry.performed_at)}>
                <Clock className="h-3 w-3" />
                {formatRelativeTime(entry.performed_at)}
              </span>
            </div>

            {/* Field changes inline */}
            {fieldChanges.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {fieldChanges.map(([field, change]) => (
                  <div key={field} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{field}:</span>
                    <span className="font-mono text-red-400 line-through">
                      {formatFieldValue(change.old)}
                    </span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className="font-mono text-green-400">
                      {formatFieldValue(change.new)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {entry.notes && (
              <p className="mt-2 text-xs text-muted-foreground italic">
                Note: {entry.notes}
              </p>
            )}
          </div>

          {/* Right: expand button */}
          {entry.snapshot && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-shrink-0">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Expandable snapshot detail */}
        <CollapsibleContent>
          {entry.snapshot && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Full Snapshot</p>
              <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                {JSON.stringify(entry.snapshot, null, 2)}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AuditTrailPage() {
  const { currentOrganization } = useOrganization();

  // Filters
  const [entityType, setEntityType] = useState('all');
  const [actionType, setActionType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');

  // Data
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);

  // ---- Fetch ----
  const fetchAuditLog = useCallback(
    async (page = 1) => {
      if (!currentOrganization?.id) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          organizationId: currentOrganization.id,
          page: String(page),
          limit: '50',
        });
        if (entityType !== 'all') params.set('entity_type', entityType);
        if (actionType !== 'all') params.set('action', actionType);
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);

        const res = await fetch(`/api/epr/audit-log?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch audit log');
        }
        const data: AuditResponse = await res.json();

        // Client-side search filter on notes
        let filtered = data.entries;
        if (searchText.trim()) {
          const lower = searchText.toLowerCase();
          filtered = filtered.filter(
            (e) =>
              (e.notes && e.notes.toLowerCase().includes(lower)) ||
              e.performed_by_name.toLowerCase().includes(lower) ||
              e.entity_type.toLowerCase().includes(lower) ||
              e.action.toLowerCase().includes(lower)
          );
        }

        setEntries(filtered);
        setPagination(data.pagination);
      } catch (err) {
        console.error('Error fetching audit log:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    },
    [currentOrganization?.id, entityType, actionType, fromDate, toDate, searchText]
  );

  useEffect(() => {
    fetchAuditLog(1);
  }, [fetchAuditLog]);

  // ---- Pagination ----
  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.total_pages) return;
    fetchAuditLog(page);
  };

  // ---- Export ----
  const handleExport = () => {
    if (entries.length === 0) {
      toast.error('No entries to export');
      return;
    }
    const csv = generateCSVExport(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `epr-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Audit log exported');
  };

  // ---- Loading skeleton ----
  if (!currentOrganization?.id) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-neon-lime" />
            Audit Trail
          </h1>
          <p className="text-muted-foreground mt-1">
            Immutable audit log for all EPR compliance activity &mdash; submissions, fee calculations, PRN updates, and configuration changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAuditLog(pagination.page)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((at) => (
                    <SelectItem key={at.value} value={at.value}>
                      {at.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Filter by notes, user..."
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline / List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No audit entries found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adjust your filters or check back after making EPR changes.
              </p>
            </CardContent>
          </Card>
        ) : (
          entries.map((entry) => <AuditEntryCard key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Showing page {pagination.page} of {pagination.total_pages} ({pagination.total} total entries)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.total_pages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
