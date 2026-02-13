import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import { REPORTING_DEADLINES, type ReportingDeadline } from '@/lib/epr/constants';
import { assessDataCompleteness } from '@/lib/epr/validation';
import type {
  ObligationResult,
  EPRFeeCalculationResult,
  EPRDataCompletenessResult,
} from '@/lib/epr/types';

interface UpcomingDeadline extends ReportingDeadline {
  days_until: number;
  is_overdue: boolean;
}

interface UseEPRDashboardResult {
  obligation: ObligationResult | null;
  feeEstimate: EPRFeeCalculationResult | null;
  completeness: EPRDataCompletenessResult | null;
  deadlines: UpcomingDeadline[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function computeUpcomingDeadlines(obligationSize: string | undefined): UpcomingDeadline[] {
  const now = new Date();

  return REPORTING_DEADLINES
    .filter((d) => {
      if (!obligationSize) return true;
      if (d.who === 'both') return true;
      if (d.who === 'large' && obligationSize === 'large') return true;
      if (d.who === 'small' && obligationSize === 'small') return true;
      return false;
    })
    .map((d) => {
      const due = new Date(d.due_date);
      const diffMs = due.getTime() - now.getTime();
      const days_until = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return { ...d, days_until, is_overdue: days_until < 0 };
    })
    .sort((a, b) => a.days_until - b.days_until);
}

export function useEPRDashboard(feeYear?: string): UseEPRDashboardResult {
  const { currentOrganization } = useOrganization();
  const [obligation, setObligation] = useState<ObligationResult | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<EPRFeeCalculationResult | null>(null);
  const [completeness, setCompleteness] = useState<EPRDataCompletenessResult | null>(null);
  const [deadlines, setDeadlines] = useState<UpcomingDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch obligation, fee estimate, and packaging data in parallel
      const [obligationRes, feeRes, packagingResult] = await Promise.all([
        fetch(`/api/epr/obligation?organizationId=${currentOrganization.id}`),
        fetch('/api/epr/calculate-fees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            fee_year: feeYear || '2025-26',
          }),
        }),
        supabase
          .from('product_materials')
          .select(`
            id,
            product_id,
            material_name,
            packaging_category,
            net_weight_g,
            epr_packaging_activity,
            epr_packaging_level,
            epr_uk_nation,
            epr_ram_rating,
            epr_is_household,
            epr_is_drinks_container,
            epr_material_type,
            products!inner(id, name, organization_id)
          `)
          .eq('products.organization_id', currentOrganization.id),
      ]);

      // Process obligation
      if (obligationRes.ok) {
        const obligationData = await obligationRes.json();
        setObligation(obligationData.obligation || null);
        setDeadlines(computeUpcomingDeadlines(obligationData.obligation?.size));
      } else {
        console.error('Failed to fetch obligation');
        setDeadlines(computeUpcomingDeadlines(undefined));
      }

      // Process fee estimate
      if (feeRes.ok) {
        const feeData = await feeRes.json();
        setFeeEstimate(feeData.calculation || null);
      } else {
        console.error('Failed to fetch fee estimate');
      }

      // Process packaging completeness
      if (!packagingResult.error && packagingResult.data) {
        const items = packagingResult.data.map((row: any) => ({
          id: row.id,
          product_id: row.product_id,
          product_name: row.products?.name || `Product #${row.product_id}`,
          material_name: row.material_name,
          packaging_category: row.packaging_category,
          net_weight_g: row.net_weight_g,
          epr_packaging_activity: row.epr_packaging_activity,
          epr_packaging_level: row.epr_packaging_level,
          epr_uk_nation: row.epr_uk_nation,
          epr_ram_rating: row.epr_ram_rating,
          epr_is_household: row.epr_is_household,
          epr_is_drinks_container: row.epr_is_drinks_container,
          epr_material_type: row.epr_material_type,
        }));
        setCompleteness(assessDataCompleteness(items));
      } else {
        console.error('Failed to fetch packaging data:', packagingResult.error);
      }
    } catch (err: any) {
      console.error('Error fetching EPR dashboard:', err);
      const message = err.message || 'Failed to load EPR dashboard';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, feeYear]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    obligation,
    feeEstimate,
    completeness,
    deadlines,
    loading,
    error,
    refresh: fetchDashboard,
  };
}
