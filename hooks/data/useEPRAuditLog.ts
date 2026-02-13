import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  organization_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
  user_email?: string;
}

interface AuditLogPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface AuditLogFilters {
  entity_type?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
}

interface UseEPRAuditLogResult {
  entries: AuditLogEntry[];
  pagination: AuditLogPagination;
  loading: boolean;
  error: string | null;
  filters: AuditLogFilters;
  setFilters: (filters: AuditLogFilters) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_PER_PAGE = 25;

export function useEPRAuditLog(): UseEPRAuditLogResult {
  const { currentOrganization } = useOrganization();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<AuditLogPagination>({
    page: 1,
    per_page: DEFAULT_PER_PAGE,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<AuditLogFilters>({});

  const fetchEntries = useCallback(
    async (page = 1, append = false) => {
      if (!currentOrganization?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          organizationId: currentOrganization.id,
          page: String(page),
          per_page: String(DEFAULT_PER_PAGE),
        });

        if (filters.entity_type) params.set('entity_type', filters.entity_type);
        if (filters.action) params.set('action', filters.action);
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);

        const response = await fetch(`/api/epr/audit-log?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch audit log');
        }

        const data = await response.json();
        const newEntries = (data.entries as AuditLogEntry[]) || [];

        if (append) {
          setEntries((prev) => [...prev, ...newEntries]);
        } else {
          setEntries(newEntries);
        }

        setPagination({
          page: data.page || page,
          per_page: data.per_page || DEFAULT_PER_PAGE,
          total: data.total || 0,
          total_pages: data.total_pages || 0,
        });
      } catch (err: any) {
        console.error('Error fetching EPR audit log:', err);
        const message = err.message || 'Failed to load audit log';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [currentOrganization?.id, filters]
  );

  useEffect(() => {
    fetchEntries(1, false);
  }, [fetchEntries]);

  const setFilters = useCallback((newFilters: AuditLogFilters) => {
    setFiltersState(newFilters);
    // fetchEntries will re-run via the useEffect dependency on filters
  }, []);

  const loadMore = useCallback(async () => {
    if (pagination.page < pagination.total_pages) {
      await fetchEntries(pagination.page + 1, true);
    }
  }, [pagination.page, pagination.total_pages, fetchEntries]);

  const refresh = useCallback(async () => {
    await fetchEntries(1, false);
  }, [fetchEntries]);

  return {
    entries,
    pagination,
    loading,
    error,
    filters,
    setFilters,
    loadMore,
    refresh,
  };
}
