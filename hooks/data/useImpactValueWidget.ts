'use client';

import { useMemo } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { usePeopleCultureScore } from '@/hooks/data/usePeopleCultureScore';
import { useCommunityImpactScore } from '@/hooks/data/useCommunityImpactScore';
import { useGovernanceScore } from '@/hooks/data/useGovernanceScore';
import { useImpactValuation } from '@/hooks/data/useImpactValuation';

export type ImpactValueWidgetState = 'locked' | 'incomplete' | 'active';

export interface UseImpactValueWidgetResult {
  state: ImpactValueWidgetState;
  totalValue: number;
  currency: string;
  missingDataAreas: string[];
  isLoading: boolean;
}

export function useImpactValueWidget(): UseImpactValueWidgetResult {
  const { hasFeature } = useSubscription();
  const { score: peopleCultureScore, loading: pcLoading } = usePeopleCultureScore();
  const { score: communityImpactScore, loading: ciLoading } = useCommunityImpactScore();
  const { score: governanceScore, loading: govLoading } = useGovernanceScore();
  const { result: valuationResult, isLoading: ivLoading } = useImpactValuation();

  const isLoading = pcLoading || ciLoading || govLoading || ivLoading;
  const hasBetaAccess = hasFeature('impact_valuation_beta');

  const result = useMemo<Omit<UseImpactValueWidgetResult, 'isLoading'>>(() => {
    if (!hasBetaAccess) {
      return {
        state: 'locked',
        totalValue: 0,
        currency: 'GBP',
        missingDataAreas: [],
      };
    }

    // Check data completeness for informational purposes
    const missingDataAreas: string[] = [];

    const pcCompleteness = peopleCultureScore?.data_completeness;
    if (!pcCompleteness || pcCompleteness === 0) {
      missingDataAreas.push('People & Culture');
    }

    const ciCompleteness = communityImpactScore?.data_completeness;
    if (!ciCompleteness || ciCompleteness === 0) {
      missingDataAreas.push('Community Impact');
    }

    const govCompleteness = governanceScore?.data_completeness;
    if (!govCompleteness || govCompleteness === 0) {
      missingDataAreas.push('Governance');
    }

    // Show the calculated total even with partial data — the Impact Valuation
    // API handles missing inputs gracefully (they contribute £0).
    const grandTotal = valuationResult?.grand_total ?? 0;

    if (grandTotal > 0) {
      return {
        state: 'active',
        totalValue: grandTotal,
        currency: 'GBP',
        missingDataAreas,
      };
    }

    // Only show incomplete state when there's genuinely no result
    if (missingDataAreas.length > 0) {
      return {
        state: 'incomplete',
        totalValue: 0,
        currency: 'GBP',
        missingDataAreas,
      };
    }

    return {
      state: 'active',
      totalValue: 0,
      currency: 'GBP',
      missingDataAreas: [],
    };
  }, [hasBetaAccess, peopleCultureScore, communityImpactScore, governanceScore, valuationResult]);

  return {
    ...result,
    isLoading,
  };
}
