import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface CompensationRecord {
  id: string;
  organization_id: string;
  employee_reference: string | null;
  role_title: string | null;
  role_level: string | null;
  department: string | null;
  employment_type: string;
  contract_type: string | null;
  work_location: string | null;
  work_country: string;
  work_region: string | null;
  is_remote: boolean;
  annual_salary: number | null;
  hourly_rate: number | null;
  currency: string;
  hours_per_week: number;
  bonus_amount: number;
  bonus_received: boolean;
  gender: string | null;
  reporting_year: number;
  effective_date: string;
  data_source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LivingWageBenchmark {
  id: string;
  country: string;
  region: string | null;
  city: string | null;
  hourly_rate: number;
  annual_rate: number | null;
  currency: string;
  source: string;
  methodology: string | null;
  effective_from: string;
  is_current: boolean;
}

export interface PayGapAnalysis {
  mean_pay_gap: number;
  median_pay_gap: number;
  mean_male_salary: number;
  mean_female_salary: number;
  median_male_salary: number;
  median_female_salary: number;
  male_count: number;
  female_count: number;
  mean_bonus_gap: number | null;
  male_bonus_percentage: number | null;
  female_bonus_percentage: number | null;
  quartiles: {
    lower: { male: number; female: number };
    lower_middle: { male: number; female: number };
    upper_middle: { male: number; female: number };
    upper: { male: number; female: number };
  } | null;
}

export interface PayRatioAnalysis {
  ceo_to_median_ratio: number | null;
  highest_to_lowest_ratio: number | null;
  ceo_to_average_ratio: number | null;
  highest_salary: number;
  lowest_salary: number;
  median_salary: number;
  average_salary: number;
  b_corp_compliant: boolean; // B Corp recommends 5:1 to 10:1
}

export interface LivingWageAnalysis {
  total_employees: number;
  employees_above_living_wage: number;
  employees_below_living_wage: number;
  percentage_compliant: number;
  gap_to_compliance: number;
  by_location: {
    location: string;
    benchmark: number;
    compliant: number;
    non_compliant: number;
    benchmark_source: string;
  }[];
}

export interface FairWorkMetrics {
  compensation_records: CompensationRecord[];
  total_records: number;
  living_wage_benchmarks: LivingWageBenchmark[];
  living_wage_analysis: LivingWageAnalysis | null;
  pay_gap_analysis: PayGapAnalysis | null;
  pay_ratio_analysis: PayRatioAnalysis | null;
  departments: string[];
  by_department: Record<string, {
    count: number;
    avg_salary: number;
    gender_breakdown: Record<string, number>;
  }>;
  by_employment_type: Record<string, number>;
}

export function useFairWorkMetrics(year?: number) {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<FairWorkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFairWorkData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentYear = year || new Date().getFullYear();

      // Fetch compensation records
      const { data: compensationData, error: compensationError } = await supabase
        .from('people_employee_compensation')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('reporting_year', currentYear)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (compensationError) throw compensationError;

      // Fetch living wage benchmarks
      const { data: benchmarkData, error: benchmarkError } = await supabase
        .from('people_living_wage_benchmarks')
        .select('*')
        .eq('is_current', true)
        .order('country')
        .order('region');

      if (benchmarkError && benchmarkError.code !== 'PGRST116') {
        console.warn('Error fetching benchmarks:', benchmarkError);
      }

      const records = compensationData || [];
      const benchmarks = benchmarkData || [];

      // Calculate pay gap analysis
      const maleRecords = records.filter(r => r.gender === 'male' && r.annual_salary);
      const femaleRecords = records.filter(r => r.gender === 'female' && r.annual_salary);

      let payGapAnalysis: PayGapAnalysis | null = null;
      if (maleRecords.length > 0 && femaleRecords.length > 0) {
        const maleSalaries = maleRecords.map(r => r.annual_salary!).sort((a, b) => a - b);
        const femaleSalaries = femaleRecords.map(r => r.annual_salary!).sort((a, b) => a - b);

        const meanMale = maleSalaries.reduce((a, b) => a + b, 0) / maleSalaries.length;
        const meanFemale = femaleSalaries.reduce((a, b) => a + b, 0) / femaleSalaries.length;
        const medianMale = maleSalaries[Math.floor(maleSalaries.length / 2)];
        const medianFemale = femaleSalaries[Math.floor(femaleSalaries.length / 2)];

        payGapAnalysis = {
          mean_pay_gap: ((meanMale - meanFemale) / meanMale) * 100,
          median_pay_gap: ((medianMale - medianFemale) / medianMale) * 100,
          mean_male_salary: meanMale,
          mean_female_salary: meanFemale,
          median_male_salary: medianMale,
          median_female_salary: medianFemale,
          male_count: maleRecords.length,
          female_count: femaleRecords.length,
          mean_bonus_gap: null,
          male_bonus_percentage: null,
          female_bonus_percentage: null,
          quartiles: null,
        };
      }

      // Calculate pay ratio analysis
      const allSalaries = records.filter(r => r.annual_salary).map(r => r.annual_salary!).sort((a, b) => a - b);
      let payRatioAnalysis: PayRatioAnalysis | null = null;
      if (allSalaries.length > 0) {
        const highest = allSalaries[allSalaries.length - 1];
        const lowest = allSalaries[0];
        const median = allSalaries[Math.floor(allSalaries.length / 2)];
        const average = allSalaries.reduce((a, b) => a + b, 0) / allSalaries.length;

        payRatioAnalysis = {
          ceo_to_median_ratio: median > 0 ? highest / median : null,
          highest_to_lowest_ratio: lowest > 0 ? highest / lowest : null,
          ceo_to_average_ratio: average > 0 ? highest / average : null,
          highest_salary: highest,
          lowest_salary: lowest,
          median_salary: median,
          average_salary: average,
          b_corp_compliant: (highest / median) <= 10, // B Corp recommends ratio <= 10:1
        };
      }

      // Calculate living wage analysis
      let livingWageAnalysis: LivingWageAnalysis | null = null;
      if (records.length > 0 && benchmarks.length > 0) {
        const byLocation: Record<string, { benchmark: LivingWageBenchmark; employees: CompensationRecord[] }> = {};

        records.forEach(record => {
          const locationKey = `${record.work_country}|${record.work_region || ''}`;
          if (!byLocation[locationKey]) {
            // Find matching benchmark
            const benchmark = benchmarks.find(b =>
              b.country === record.work_country &&
              (b.region === record.work_region || !b.region)
            ) || benchmarks.find(b => b.country === record.work_country && !b.region);

            if (benchmark) {
              byLocation[locationKey] = { benchmark, employees: [] };
            }
          }
          if (byLocation[locationKey]) {
            byLocation[locationKey].employees.push(record);
          }
        });

        let totalAbove = 0;
        let totalBelow = 0;
        let totalGap = 0;

        const locationAnalysis = Object.entries(byLocation).map(([key, { benchmark, employees }]) => {
          const [country, region] = key.split('|');
          let compliant = 0;
          let nonCompliant = 0;

          employees.forEach(emp => {
            const hourlyRate = emp.hourly_rate || (emp.annual_salary ? emp.annual_salary / (emp.hours_per_week * 52) : 0);
            if (hourlyRate >= benchmark.hourly_rate) {
              compliant++;
              totalAbove++;
            } else {
              nonCompliant++;
              totalBelow++;
              totalGap += (benchmark.hourly_rate - hourlyRate) * emp.hours_per_week * 52;
            }
          });

          return {
            location: region ? `${region}, ${country}` : country,
            benchmark: benchmark.hourly_rate,
            compliant,
            non_compliant: nonCompliant,
            benchmark_source: benchmark.source,
          };
        });

        livingWageAnalysis = {
          total_employees: records.length,
          employees_above_living_wage: totalAbove,
          employees_below_living_wage: totalBelow,
          percentage_compliant: records.length > 0 ? (totalAbove / records.length) * 100 : 0,
          gap_to_compliance: totalGap,
          by_location: locationAnalysis,
        };
      }

      // Calculate department breakdown
      const departments = [...new Set(records.map(r => r.department).filter(Boolean))] as string[];
      const byDepartment: Record<string, { count: number; avg_salary: number; gender_breakdown: Record<string, number> }> = {};

      departments.forEach(dept => {
        const deptRecords = records.filter(r => r.department === dept);
        const salaries = deptRecords.filter(r => r.annual_salary).map(r => r.annual_salary!);
        const genderBreakdown: Record<string, number> = {};
        deptRecords.forEach(r => {
          const gender = r.gender || 'not_disclosed';
          genderBreakdown[gender] = (genderBreakdown[gender] || 0) + 1;
        });

        byDepartment[dept] = {
          count: deptRecords.length,
          avg_salary: salaries.length > 0 ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 0,
          gender_breakdown: genderBreakdown,
        };
      });

      // Calculate employment type breakdown
      const byEmploymentType: Record<string, number> = {};
      records.forEach(r => {
        byEmploymentType[r.employment_type] = (byEmploymentType[r.employment_type] || 0) + 1;
      });

      setMetrics({
        compensation_records: records,
        total_records: records.length,
        living_wage_benchmarks: benchmarks,
        living_wage_analysis: livingWageAnalysis,
        pay_gap_analysis: payGapAnalysis,
        pay_ratio_analysis: payRatioAnalysis,
        departments,
        by_department: byDepartment,
        by_employment_type: byEmploymentType,
      });

    } catch (err) {
      console.error('Error fetching fair work metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch fair work metrics');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    fetchFairWorkData();
  }, [fetchFairWorkData]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchFairWorkData,
  };
}
