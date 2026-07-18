import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

/**
 * What the organisation's data can actually support, per report section.
 * The funnel uses this to preselect only sections with something to say,
 * and to annotate the rest honestly in the adjust panel.
 */
export interface ReportDataAvailability {
  loading: boolean;
  hasCorporate: boolean;
  corporateYearCount: number;
  productCount: number;
  supplierCount: number;
  facilityCount: number;
  hasTransitionPlan: boolean;
  hasMaterialityComplete: boolean;
  hasImpactValuation: boolean;
  hasPeopleData: boolean;
  hasGovernanceData: boolean;
  hasCommunityData: boolean;
}

const EMPTY: ReportDataAvailability = {
  loading: true,
  hasCorporate: false,
  corporateYearCount: 0,
  productCount: 0,
  supplierCount: 0,
  facilityCount: 0,
  hasTransitionPlan: false,
  hasMaterialityComplete: false,
  hasImpactValuation: false,
  hasPeopleData: false,
  hasGovernanceData: false,
  hasCommunityData: false,
};

/**
 * Section ids that depend on specific data being present. Sections not
 * listed here always have something to render (methodology, targets,
 * executive summary and so on).
 */
export function sectionHasData(sectionId: string, a: ReportDataAvailability): boolean {
  switch (sectionId) {
    case 'scope-1-2-3':
    case 'ghg-inventory':
      return a.hasCorporate;
    case 'trends':
    case 'key-findings':
      return a.corporateYearCount >= 2;
    case 'product-footprints':
    case 'carbon-origin':
    case 'multi-capital':
      return a.productCount > 0;
    case 'supply-chain':
      return a.supplierCount > 0;
    case 'facilities':
      return a.facilityCount > 0;
    case 'transition-roadmap':
    case 'risks-and-opportunities':
      return a.hasTransitionPlan;
    case 'impact-valuation':
      return a.hasImpactValuation;
    case 'people-culture':
      return a.hasPeopleData;
    case 'governance':
      return a.hasGovernanceData;
    case 'community-impact':
      return a.hasCommunityData;
    default:
      return true;
  }
}

export function useReportDataAvailability(
  organizationId: string | null | undefined,
  reportYear: number
): ReportDataAvailability {
  const [availability, setAvailability] = useState<ReportDataAvailability>(EMPTY);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    (async () => {
      setAvailability(prev => ({ ...prev, loading: true }));
      try {
        const [
          corporate,
          corporateYears,
          products,
          suppliers,
          facilities,
          transitionPlan,
          materiality,
          impactValuation,
          peopleScore,
          peopleComp,
          governanceMission,
          governancePolicies,
          communityScore,
          communityDonations,
        ] = await Promise.all([
          supabase.from('corporate_reports').select('id, total_emissions').eq('organization_id', organizationId).eq('year', reportYear).maybeSingle(),
          supabase.from('corporate_reports').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
          supabase.from('product_carbon_footprints').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'completed'),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
          supabase.from('facilities').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
          supabase.from('transition_plans').select('id').eq('organization_id', organizationId).eq('plan_year', reportYear).maybeSingle(),
          supabase.from('materiality_assessments').select('completed_at').eq('organization_id', organizationId).eq('assessment_year', reportYear).maybeSingle(),
          supabase.from('impact_valuation_results').select('id').eq('organization_id', organizationId).eq('reporting_year', reportYear).limit(1).maybeSingle(),
          supabase.from('people_culture_scores').select('id').eq('organization_id', organizationId).limit(1).maybeSingle(),
          supabase.from('people_employee_compensation').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true),
          supabase.from('governance_mission').select('id').eq('organization_id', organizationId).maybeSingle(),
          supabase.from('governance_policies').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
          supabase.from('community_impact_scores').select('id').eq('organization_id', organizationId).limit(1).maybeSingle(),
          supabase.from('community_donations').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        ]);

        if (cancelled) return;
        setAvailability({
          loading: false,
          hasCorporate: !!corporate.data,
          corporateYearCount: corporateYears.count ?? 0,
          productCount: products.count ?? 0,
          supplierCount: suppliers.count ?? 0,
          facilityCount: facilities.count ?? 0,
          hasTransitionPlan: !!transitionPlan.data,
          hasMaterialityComplete: !!materiality.data?.completed_at,
          hasImpactValuation: !!impactValuation.data,
          hasPeopleData: !!peopleScore.data || (peopleComp.count ?? 0) > 0,
          hasGovernanceData: !!governanceMission.data || (governancePolicies.count ?? 0) > 0,
          hasCommunityData: !!communityScore.data || (communityDonations.count ?? 0) > 0,
        });
      } catch {
        // Detection is advisory; fail open so the funnel still works.
        if (!cancelled) setAvailability(prev => ({ ...prev, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, reportYear]);

  return availability;
}
