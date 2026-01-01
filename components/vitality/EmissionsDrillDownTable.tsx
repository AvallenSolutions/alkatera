'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DrillDownEntry {
  id: string;
  date: string;
  description: string;
  emissions: number;
  unit?: string;
  quantity?: number;
  source: string;
  dataQuality: 'primary' | 'secondary' | 'estimated';
  category?: string;
  expandedContent?: React.ReactNode;
  metadata?: Record<string, any>;
}

interface EmissionsDrillDownTableProps {
  entries: DrillDownEntry[];
  title?: string;
  showSearch?: boolean;
  showExport?: boolean;
  showDataQuality?: boolean;
  showCategory?: boolean;
  maxHeight?: string;
  onEntryClick?: (entry: DrillDownEntry) => void;
  emptyMessage?: string;
  className?: string;
}

type SortKey = 'date' | 'description' | 'emissions' | 'source' | 'dataQuality';
type SortDirection = 'asc' | 'desc';

export function EmissionsDrillDownTable({
  entries,
  title,
  showSearch = true,
  showExport = true,
  showDataQuality = true,
  showCategory = false,
  maxHeight = '400px',
  onEntryClick,
  emptyMessage = 'No entries found',
  className,
}: EmissionsDrillDownTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('emissions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [qualityFilter, setQualityFilter] = useState<string>('all');

  const filteredAndSortedEntries = useMemo(() => {
    let filtered = entries;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        entry =>
          entry.description.toLowerCase().includes(term) ||
          entry.source.toLowerCase().includes(term) ||
          entry.category?.toLowerCase().includes(term)
      );
    }

    if (qualityFilter !== 'all') {
      filtered = filtered.filter(entry => entry.dataQuality === qualityFilter);
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'emissions':
          comparison = a.emissions - b.emissions;
          break;
        case 'source':
          comparison = a.source.localeCompare(b.source);
          break;
        case 'dataQuality':
          comparison = a.dataQuality.localeCompare(b.dataQuality);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [entries, searchTerm, sortKey, sortDirection, qualityFilter]);

  const totalEmissions = useMemo(
    () => filteredAndSortedEntries.reduce((sum, entry) => sum + entry.emissions, 0),
    [filteredAndSortedEntries]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExport = () => {
    const headers = ['Date', 'Description', 'Emissions (kg CO₂e)', 'Source', 'Data Quality'];
    if (showCategory) headers.splice(2, 0, 'Category');

    const rows = filteredAndSortedEntries.map(entry => {
      const row = [
        entry.date,
        entry.description,
        entry.emissions.toFixed(3),
        entry.source,
        entry.dataQuality,
      ];
      if (showCategory) row.splice(2, 0, entry.category || '');
      return row;
    });

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emissions-breakdown-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600" />
    );
  };

  const getDataQualityBadge = (quality: string) => {
    const config: Record<string, { label: string; className: string }> = {
      primary: { label: 'Primary', className: 'bg-green-100 text-green-800 border-green-300' },
      secondary: { label: 'Secondary', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      estimated: { label: 'Estimated', className: 'bg-amber-100 text-amber-800 border-amber-300' },
    };
    const conf = config[quality] || config.estimated;
    return (
      <Badge variant="outline" className={cn('text-xs', conf.className)}>
        {conf.label}
      </Badge>
    );
  };

  const formatEmissions = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} t`;
    }
    return `${value.toFixed(3)} kg`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {(title || showSearch || showExport) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
          <div className="flex items-center gap-2 flex-wrap">
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 w-48"
                />
              </div>
            )}
            {showDataQuality && (
              <Select value={qualityFilter} onValueChange={setQualityFilter}>
                <SelectTrigger className="h-9 w-32">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quality</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="estimated">Estimated</SelectItem>
                </SelectContent>
              </Select>
            )}
            {showExport && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        className="border rounded-lg overflow-hidden"
        style={{ maxHeight }}
      >
        <div className="overflow-auto" style={{ maxHeight }}>
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    <SortIcon columnKey="date" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-1">
                    Description
                    <SortIcon columnKey="description" />
                  </div>
                </TableHead>
                {showCategory && <TableHead>Category</TableHead>}
                <TableHead
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 text-right"
                  onClick={() => handleSort('emissions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Emissions
                    <SortIcon columnKey="emissions" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort('source')}
                >
                  <div className="flex items-center gap-1">
                    Method
                    <SortIcon columnKey="source" />
                  </div>
                </TableHead>
                {showDataQuality && (
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => handleSort('dataQuality')}
                  >
                    <div className="flex items-center gap-1">
                      Quality
                      <SortIcon columnKey="dataQuality" />
                    </div>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedEntries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showCategory ? 7 : 6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedEntries.map(entry => (
                  <React.Fragment key={entry.id}>
                    <TableRow
                      className={cn(
                        'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50',
                        expandedRows.has(entry.id) && 'bg-slate-50 dark:bg-slate-800/50'
                      )}
                      onClick={() => {
                        if (entry.expandedContent || entry.metadata) {
                          toggleRow(entry.id);
                        }
                        onEntryClick?.(entry);
                      }}
                    >
                      <TableCell className="w-8 p-2">
                        {(entry.expandedContent || entry.metadata) && (
                          expandedRows.has(entry.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-xs truncate">
                        {entry.description}
                      </TableCell>
                      {showCategory && (
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.category || '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono text-sm">
                        {formatEmissions(entry.emissions)} CO₂e
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.source}
                      </TableCell>
                      {showDataQuality && (
                        <TableCell>{getDataQualityBadge(entry.dataQuality)}</TableCell>
                      )}
                    </TableRow>
                    {expandedRows.has(entry.id) && (entry.expandedContent || entry.metadata) && (
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/25">
                        <TableCell colSpan={showCategory ? 7 : 6} className="p-4">
                          {entry.expandedContent || (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {entry.metadata &&
                                Object.entries(entry.metadata).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="text-muted-foreground capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                                    </span>
                                    <span className="ml-2 font-medium">
                                      {typeof value === 'number' ? value.toLocaleString() : String(value || '-')}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          {filteredAndSortedEntries.length} {filteredAndSortedEntries.length === 1 ? 'entry' : 'entries'}
          {searchTerm || qualityFilter !== 'all' ? ' (filtered)' : ''}
        </span>
        <span className="font-medium text-slate-900 dark:text-slate-100">
          Total: {formatEmissions(totalEmissions)} CO₂e
        </span>
      </div>
    </div>
  );
}
