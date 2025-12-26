'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  Calculator,
  Flame,
  Zap,
  BarChart3,
  Globe,
  Calendar,
  FileText,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { BusinessTravelCard } from '@/components/reports/BusinessTravelCard';
import { ServicesOverheadCard } from '@/components/reports/ServicesOverheadCard';
import { TeamCommutingCard } from '@/components/reports/TeamCommutingCard';
import { CapitalGoodsCard } from '@/components/reports/CapitalGoodsCard';
import { LogisticsDistributionCard } from '@/components/reports/LogisticsDistributionCard';
import { OperationalWasteCard } from '@/components/reports/OperationalWasteCard';
import { MarketingMaterialsCard } from '@/components/reports/MarketingMaterialsCard';

const scope1Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  fuel_type: z.string().min(1, 'Fuel type is required'),
  amount: z.string().min(1, 'Amount is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.string().min(1, 'Unit is required'),
  activity_date: z.string().min(1, 'Activity date is required'),
});

const scope2Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  source_type: z.string().min(1, 'Source type is required'),
  amount: z.string().min(1, 'Amount consumed is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.string().min(1, 'Unit is required'),
  activity_date: z.string().min(1, 'Activity date is required'),
});

type Scope1FormValues = z.infer<typeof scope1Schema>;
type Scope2FormValues = z.infer<typeof scope2Schema>;

interface Facility {
  id: string;
  name: string;
  location: string | null;
}

interface ActivityDataRecord {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  activity_date: string;
  created_at: string;
}

interface CorporateReport {
  id: string;
  year: number;
  status: string;
  total_emissions: number;
  breakdown_json: any;
  created_at: string;
  updated_at: string;
}

interface OverheadEntry {
  id: string;
  category: string;
  description: string;
  spend_amount: number;
  currency: string;
  entry_date: string;
  computed_co2e: number;
  fte_count?: number;
  asset_type?: string;
  transport_mode?: string;
  distance_km?: number;
  weight_kg?: number;
  material_type?: string;
  disposal_method?: string;
}

interface EmissionSource {
  id: string;
  source_name: string;
  scope: string;
  category: string;
  default_unit: string;
  emission_factor_id: string | null;
}

const currentYear = new Date().getFullYear();
const availableYears = [currentYear, currentYear - 1, currentYear - 2];

export default function CompanyEmissionsPage() {
  const { currentOrganization } = useOrganization();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [recentData, setRecentData] = useState<ActivityDataRecord[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('footprint');

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [report, setReport] = useState<CorporateReport | null>(null);
  const [overheads, setOverheads] = useState<OverheadEntry[]>([]);
  const [scope1CO2e, setScope1CO2e] = useState(0);
  const [scope2CO2e, setScope2CO2e] = useState(0);
  const [productsCO2e, setProductsCO2e] = useState(0);
  const [fleetCO2e, setFleetCO2e] = useState(0);
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [isLoadingFuelTypes, setIsLoadingFuelTypes] = useState(true);
  const [scope1Sources, setScope1Sources] = useState<EmissionSource[]>([]);
  const [scope2Sources, setScope2Sources] = useState<EmissionSource[]>([]);
  const [scope3Cat1CO2e, setScope3Cat1CO2e] = useState(0);
  const [scope3Cat1Breakdown, setScope3Cat1Breakdown] = useState<Array<{
    product_name: string;
    materials_tco2e: number;
    packaging_tco2e: number;
    production_volume: number; // Now in consumer units (bottles/cans) not hectolitres
  }>>([]);
  const [scope3Cat1DataQuality, setScope3Cat1DataQuality] = useState<string>('');
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scope3OverheadsCO2e, setScope3OverheadsCO2e] = useState(0);

  const scope1Form = useForm<Scope1FormValues>({
    resolver: zodResolver(scope1Schema),
    mode: 'onChange',
  });

  const scope2Form = useForm<Scope2FormValues>({
    resolver: zodResolver(scope2Schema),
    mode: 'onChange',
  });

  const fetchFacilities = async () => {
    if (!currentOrganization?.id) {
      setIsLoadingFacilities(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, location')
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching facilities:', error);
        toast.error('Failed to load facilities');
      } else {
        setFacilities(data || []);
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
      toast.error('Failed to load facilities');
    } finally {
      setIsLoadingFacilities(false);
    }
  };

  const fetchRecentData = async () => {
    if (!currentOrganization?.id) {
      setIsLoadingData(false);
      return;
    }

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const { data, error } = await browserSupabase
        .from('facility_activity_data')
        .select(`
          id,
          quantity,
          unit,
          reporting_period_start,
          created_at,
          scope_1_2_emission_sources!inner (
            source_name,
            scope,
            category
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching recent data:', error);
      } else {
        const mappedData: ActivityDataRecord[] = (data || []).map((item: any) => ({
          id: item.id,
          name: item.scope_1_2_emission_sources?.source_name || 'Unknown',
          category: item.scope_1_2_emission_sources?.scope || 'Unknown',
          quantity: item.quantity,
          unit: item.unit,
          activity_date: item.reporting_period_start,
          created_at: item.created_at,
        }));
        setRecentData(mappedData);
      }
    } catch (error) {
      console.error('Error fetching recent data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchScope3Cat1FromLCAs = async () => {
    if (!currentOrganization?.id) return;

    console.log('🔍 [SCOPE 3 CAT 1] Starting fetch', {
      orgId: currentOrganization.id,
      selectedYear,
      yearStart: `${selectedYear}-01-01`,
      yearEnd: `${selectedYear}-12-31`
    });

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data: productionLogs, error: productionError } = await browserSupabase
        .from('production_logs')
        .select('product_id, volume, unit, units_produced, date')
        .eq('organization_id', currentOrganization.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (productionError) throw productionError;

      console.log('🔍 [SCOPE 3 CAT 1] Production logs', {
        count: productionLogs?.length || 0,
        logs: productionLogs
      });

      if (!productionLogs || productionLogs.length === 0) {
        setScope3Cat1CO2e(0);
        setScope3Cat1Breakdown([]);
        setScope3Cat1DataQuality('No production data for selected year');
        return;
      }

      let totalEmissions = 0;
      const breakdown: Array<{
        product_name: string;
        materials_tco2e: number;
        packaging_tco2e: number;
        production_volume: number;
      }> = [];

      for (const log of productionLogs) {
        const { data: product } = await browserSupabase
          .from('products')
          .select('name')
          .eq('id', log.product_id)
          .maybeSingle();

        if (!product) continue;

        console.log('🔍 [SCOPE 3 CAT 1] Product found', {
          productId: log.product_id,
          product
        });

        const { data: lca, error: lcaError } = await browserSupabase
          .from('product_lcas')
          .select('id, total_ghg_emissions, status, per_unit_emissions_verified')
          .eq('product_id', log.product_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('🔍 [SCOPE 3 CAT 1] LCA data', {
          productId: log.product_id,
          hasLCA: !!lca,
          status: lca?.status,
          total_ghg_emissions: lca?.total_ghg_emissions,
          per_unit_verified: lca?.per_unit_emissions_verified,
          lcaError
        });

        if (lcaError || !lca || !lca.total_ghg_emissions || lca.total_ghg_emissions === 0) {
          console.warn('⚠️ [SCOPE 3 CAT 1] Skipping product - no valid LCA emissions', {
            productId: log.product_id,
            productName: product.name,
            reason: !lca ? 'No LCA found' : !lca.total_ghg_emissions ? 'total_ghg_emissions is null/0' : 'Unknown'
          });
          continue;
        }

        // CRITICAL: Use units_produced (number of bottles/cans) not bulk volume (hectolitres)
        // LCA emissions are per functional unit (per bottle/can)
        const unitsProduced = log.units_produced || 0;

        if (unitsProduced === 0) {
          console.warn('⚠️ [SCOPE 3 CAT 1] Skipping - units_produced is 0 or NULL', {
            productId: log.product_id,
            productName: product.name,
            log
          });
          continue;
        }

        // Fetch materials breakdown to separate materials vs packaging
        const { data: materials } = await browserSupabase
          .from('product_lca_materials')
          .select('material_type, impact_climate')
          .eq('product_lca_id', lca.id);

        let materialsPerUnit = 0;
        let packagingPerUnit = 0;

        if (materials) {
          materials.forEach((m: any) => {
            if (m.material_type === 'ingredient') {
              materialsPerUnit += m.impact_climate || 0;
            } else if (m.material_type === 'packaging') {
              packagingPerUnit += m.impact_climate || 0;
            }
          });
        }

        // Calculate total emissions: emissions per unit × number of units
        const totalMaterialsTonnes = (materialsPerUnit * unitsProduced) / 1000;
        const totalPackagingTonnes = (packagingPerUnit * unitsProduced) / 1000;
        const totalImpactTonnes = totalMaterialsTonnes + totalPackagingTonnes;

        totalEmissions += totalImpactTonnes;

        console.log('✅ [SCOPE 3 CAT 1] Calculated impact', {
          product: product.name,
          unitsProduced,
          materialsPerUnit,
          packagingPerUnit,
          totalPerUnit: materialsPerUnit + packagingPerUnit,
          totalMaterialsTonnes,
          totalPackagingTonnes,
          totalImpactTonnes,
          runningTotal: totalEmissions
        });

        breakdown.push({
          product_name: product.name,
          materials_tco2e: totalMaterialsTonnes,
          packaging_tco2e: totalPackagingTonnes,
          production_volume: unitsProduced,
        });
      }

      setScope3Cat1CO2e(totalEmissions);
      setScope3Cat1Breakdown(breakdown);
      setScope3Cat1DataQuality('Tier 1: Primary LCA data from ecoinvent 3.10');

      console.log('✅ [SCOPE 3 CAT 1] Final result', {
        totalEmissions,
        breakdownCount: breakdown.length,
        breakdown
      });
    } catch (error: any) {
      console.error('Error fetching Scope 3 Cat 1 from LCAs:', error);
      setScope3Cat1CO2e(0);
      setScope3Cat1Breakdown([]);
      setScope3Cat1DataQuality('Error loading data');
    }
  };

  const fetchReportData = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoadingReport(true);
      const browserSupabase = getSupabaseBrowserClient();

      const { data: reportData, error: reportError } = await browserSupabase
        .from('corporate_reports')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('year', selectedYear)
        .maybeSingle();

      if (reportError) throw reportError;

      console.log('Fetched Report Data:', reportData);

      if (!reportData) {
        const { data: newReport, error: createError } = await browserSupabase
          .from('corporate_reports')
          .insert({
            organization_id: currentOrganization.id,
            year: selectedYear,
            status: 'Draft',
            total_emissions: 0,
            breakdown_json: {},
          })
          .select()
          .single();

        if (createError) throw createError;
        setReport(newReport);
        setOverheads([]);
      } else {
        console.log('Report breakdown_json:', reportData.breakdown_json);
        setReport(reportData);

        const { data: overheadData, error: overheadError } = await browserSupabase
          .from('corporate_overheads')
          .select('*')
          .eq('report_id', reportData.id)
          .order('created_at', { ascending: false });

        if (overheadError) throw overheadError;
        setOverheads(overheadData || []);
      }

      await fetchScope1Emissions();
      await fetchScope2Emissions();
      await fetchProductsEmissions();
      await fetchFleetEmissions();
      await fetchScope3Cat1FromLCAs();
      await fetchScope3Overheads();
    } catch (error: any) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load footprint data');
    } finally {
      setIsLoadingReport(false);
    }
  };

  const fetchScope1Emissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data, error } = await browserSupabase
        .from('facility_activity_data')
        .select(`
          quantity,
          scope_1_2_emission_sources!inner (
            scope,
            emission_factor_id
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      if (error) throw error;

      const scope1Data = data?.filter((item: any) =>
        item.scope_1_2_emission_sources?.scope === 'Scope 1'
      ) || [];

      let total = 0;
      for (const item of scope1Data) {
        const factorId = (item as any).scope_1_2_emission_sources?.emission_factor_id;
        if (factorId) {
          const { data: factor } = await browserSupabase
            .from('emissions_factors')
            .select('value')
            .eq('factor_id', factorId)
            .maybeSingle();
          if (factor?.value) {
            total += item.quantity * parseFloat(factor.value);
          }
        }
      }

      setScope1CO2e(total);
    } catch (error: any) {
      console.error('Error fetching Scope 1 emissions:', error);
      setScope1CO2e(0);
    }
  };

  const fetchScope2Emissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data, error } = await browserSupabase
        .from('facility_activity_data')
        .select(`
          quantity,
          scope_1_2_emission_sources!inner (
            scope,
            emission_factor_id
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      if (error) throw error;

      const scope2Data = data?.filter((item: any) =>
        item.scope_1_2_emission_sources?.scope === 'Scope 2'
      ) || [];

      let total = 0;
      for (const item of scope2Data) {
        const factorId = (item as any).scope_1_2_emission_sources?.emission_factor_id;
        if (factorId) {
          const { data: factor } = await browserSupabase
            .from('emissions_factors')
            .select('value')
            .eq('factor_id', factorId)
            .maybeSingle();
          if (factor?.value) {
            total += item.quantity * parseFloat(factor.value);
          }
        }
      }

      setScope2CO2e(total);
    } catch (error: any) {
      console.error('Error fetching Scope 2 emissions:', error);
      setScope2CO2e(0);
    }
  };

  const fetchEmissionSources = async () => {
    setIsLoadingFuelTypes(true);
    try {
      const browserSupabase = getSupabaseBrowserClient();

      const { data: scope1Data, error: scope1Error } = await browserSupabase
        .from('scope_1_2_emission_sources')
        .select('id, source_name, scope, category, default_unit, emission_factor_id')
        .eq('scope', 'Scope 1')
        .order('category', { ascending: true })
        .order('source_name', { ascending: true });

      if (scope1Error) {
        console.error('Error fetching Scope 1 sources:', scope1Error);
      } else {
        setScope1Sources(scope1Data || []);
        const uniqueNames = Array.from(new Set(scope1Data?.map(s => s.source_name) || []));
        setFuelTypes(uniqueNames);
      }

      const { data: scope2Data, error: scope2Error } = await browserSupabase
        .from('scope_1_2_emission_sources')
        .select('id, source_name, scope, category, default_unit, emission_factor_id')
        .eq('scope', 'Scope 2')
        .order('source_name', { ascending: true });

      if (scope2Error) {
        console.error('Error fetching Scope 2 sources:', scope2Error);
      } else {
        setScope2Sources(scope2Data || []);
      }
    } catch (error) {
      console.error('Error fetching emission sources:', error);
    } finally {
      setIsLoadingFuelTypes(false);
    }
  };

  const handleScope1FuelTypeChange = (fuelTypeName: string) => {
    scope1Form.setValue('fuel_type', fuelTypeName, { shouldValidate: true });
    const source = scope1Sources.find(s => s.source_name === fuelTypeName);
    if (source?.default_unit) {
      scope1Form.setValue('unit', source.default_unit, { shouldValidate: true });
    }
  };

  const handleScope2SourceChange = (sourceName: string) => {
    scope2Form.setValue('source_type', sourceName, { shouldValidate: true });
    const source = scope2Sources.find(s => s.source_name === sourceName);
    if (source?.default_unit) {
      scope2Form.setValue('unit', source.default_unit, { shouldValidate: true });
    }
  };

  const fetchProductsEmissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data: productionData, error } = await browserSupabase
        .from('production_logs')
        .select('product_id, volume, unit, date')
        .eq('organization_id', currentOrganization.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (error) throw error;

      let total = 0;

      if (productionData) {
        for (const log of productionData) {
          const { data: product } = await browserSupabase
            .from('products')
            .select('unit_size_value, unit_size_unit')
            .eq('id', log.product_id)
            .maybeSingle();

          if (!product) continue;

          const { data: lca } = await browserSupabase
            .from('product_lcas')
            .select('total_ghg_emissions')
            .eq('product_id', log.product_id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lca && lca.total_ghg_emissions) {
            const volumeInLitres = log.unit === 'Hectolitre' ? log.volume * 100 : log.volume;

            let productSizeInLitres = product.unit_size_value || 1;
            if (product.unit_size_unit === 'ml') {
              productSizeInLitres = productSizeInLitres / 1000;
            }

            const numberOfUnits = volumeInLitres / productSizeInLitres;
            const totalImpact = lca.total_ghg_emissions * numberOfUnits;
            total += totalImpact;
          }
        }
      }

      setProductsCO2e(total);
    } catch (error: any) {
      console.error('Error fetching products emissions:', error);
      setProductsCO2e(0);
    }
  };

  const fetchFleetEmissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data, error } = await browserSupabase
        .from('fleet_activities')
        .select('emissions_tco2e')
        .eq('organization_id', currentOrganization.id)
        .gte('activity_date', yearStart)
        .lte('activity_date', yearEnd);

      if (error) throw error;

      const total = data?.reduce((sum, item) => sum + (item.emissions_tco2e || 0), 0) || 0;
      setFleetCO2e(total);
    } catch (error: any) {
      console.error('Error fetching fleet emissions:', error);
    }
  };

  const fetchScope3Overheads = async () => {
    if (!currentOrganization?.id || !report?.id) return;

    try {
      const browserSupabase = getSupabaseBrowserClient();

      const { data, error } = await browserSupabase
        .from('corporate_overheads')
        .select('category, computed_co2e')
        .eq('report_id', report.id);

      if (error) throw error;

      const scope3Categories = [
        'business_travel',
        'purchased_services',
        'employee_commuting',
        'capital_goods',
        'operational_waste',
        'downstream_logistics',
      ];

      const total = data
        ?.filter(item => scope3Categories.includes(item.category))
        .reduce((sum, item) => sum + (item.computed_co2e || 0), 0) || 0;

      setScope3OverheadsCO2e(total);
    } catch (error: any) {
      console.error('Error fetching Scope 3 overheads:', error);
      setScope3OverheadsCO2e(0);
    }
  };

  useEffect(() => {
    fetchFacilities();
    fetchRecentData();
    fetchEmissionSources();
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id && selectedYear) {
      fetchReportData();
    }
  }, [currentOrganization?.id, selectedYear]);

  const onSubmitScope1 = async (data: Scope1FormValues) => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsSubmitting(true);

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const selectedSource = scope1Sources.find(s => s.source_name === data.fuel_type);

      if (!selectedSource) {
        toast.error('Invalid fuel type selected');
        return;
      }

      const { error } = await browserSupabase
        .from('facility_activity_data')
        .insert({
          facility_id: data.facility_id,
          emission_source_id: selectedSource.id,
          quantity: parseFloat(data.amount),
          unit: data.unit,
          reporting_period_start: data.activity_date,
          reporting_period_end: data.activity_date,
          organization_id: currentOrganization.id,
        });

      if (error) {
        console.error('Insert error:', error);
        throw new Error(error.message || 'Failed to save Scope 1 data');
      }

      toast.success('Scope 1 activity data submitted successfully');
      scope1Form.reset({
        facility_id: '',
        fuel_type: '',
        amount: '',
        unit: '',
        activity_date: '',
      });
      await fetchRecentData();
      await fetchScope1Emissions();
    } catch (error) {
      console.error('Error submitting Scope 1 data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit Scope 1 data'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitScope2 = async (data: Scope2FormValues) => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsSubmitting(true);

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const selectedSource = scope2Sources.find(s => s.source_name === data.source_type);

      if (!selectedSource) {
        toast.error('Invalid source type selected');
        return;
      }

      let quantity = parseFloat(data.amount);
      if (data.unit === 'MWh') {
        quantity = quantity * 1000;
      }

      const { error } = await browserSupabase
        .from('facility_activity_data')
        .insert({
          facility_id: data.facility_id,
          emission_source_id: selectedSource.id,
          quantity: quantity,
          unit: 'kWh',
          reporting_period_start: data.activity_date,
          reporting_period_end: data.activity_date,
          organization_id: currentOrganization.id,
        });

      if (error) {
        console.error('Insert error:', error);
        throw new Error(error.message || 'Failed to save Scope 2 data');
      }

      toast.success('Scope 2 activity data submitted successfully');
      scope2Form.reset({
        facility_id: '',
        source_type: '',
        amount: '',
        unit: '',
        activity_date: '',
      });
      await fetchRecentData();
      await fetchScope2Emissions();
    } catch (error) {
      console.error('Error submitting Scope 2 data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit Scope 2 data'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!report || !currentOrganization?.id) return;

    setIsGenerating(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-ccf-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          year: selectedYear,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      const result = await response.json();
      console.log('CCF Report Generated:', result);

      toast.success('Footprint calculated successfully!');
      await fetchReportData();
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunCalculations = async () => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsCalculating(true);

    try {
      const browserSupabase = getSupabaseBrowserClient();
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data: activityData, error: activityError } = await browserSupabase
        .from('facility_activity_data')
        .select(`
          id,
          quantity,
          unit,
          scope_1_2_emission_sources!inner (
            source_name,
            scope,
            category,
            emission_factor_id
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      if (activityError) throw activityError;

      let scope1Total = 0;
      let scope2Total = 0;

      for (const activity of activityData || []) {
        const source = (activity as any).scope_1_2_emission_sources;
        const factorId = source?.emission_factor_id;

        if (factorId) {
          const { data: factor } = await browserSupabase
            .from('emissions_factors')
            .select('value')
            .eq('factor_id', factorId)
            .maybeSingle();

          if (factor?.value) {
            const emissions = activity.quantity * parseFloat(factor.value);
            if (source.scope === 'Scope 1') {
              scope1Total += emissions;
            } else if (source.scope === 'Scope 2') {
              scope2Total += emissions;
            }
          }
        }
      }

      toast.success(`Calculations complete: Scope 1: ${scope1Total.toFixed(2)} kgCO2e, Scope 2: ${scope2Total.toFixed(2)} kgCO2e`);
      await fetchScope1Emissions();
      await fetchScope2Emissions();
    } catch (error) {
      console.error('Error running calculations:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to run calculations'
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const travelEntries = overheads.filter((o) => o.category === 'business_travel');
  const serviceEntries = overheads.filter((o) => o.category === 'purchased_services' && !o.material_type);
  const marketingEntries = overheads.filter((o) => o.category === 'purchased_services' && o.material_type);
  const commutingEntry = overheads.find((o) => o.category === 'employee_commuting');
  const fteCount = commutingEntry?.fte_count || 0;
  const capitalGoodsEntries = overheads.filter((o) => o.category === 'capital_goods') as any[];
  const logisticsEntries = overheads.filter((o) => o.category === 'downstream_logistics') as any[];
  const wasteEntries = overheads.filter((o) => o.category === 'operational_waste') as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Company Emissions
          </h1>
          <p className="text-muted-foreground mt-2">
            Build and track your organisation's annual carbon footprint
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {report?.status === 'Finalized' ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200">
              <Lock className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
      </div>

      {facilities.length === 0 && !isLoadingFacilities && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No facilities found. Please add facilities to your organisation before entering activity data.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="footprint" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Annual Footprint
          </TabsTrigger>
          <TabsTrigger value="scope1" className="gap-2">
            <Flame className="h-4 w-4" />
            Scope 1
          </TabsTrigger>
          <TabsTrigger value="scope2" className="gap-2">
            <Zap className="h-4 w-4" />
            Scope 2
          </TabsTrigger>
          <TabsTrigger value="scope3" className="gap-2">
            <Globe className="h-4 w-4" />
            Scope 3
          </TabsTrigger>
        </TabsList>

        <TabsContent value="footprint">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedYear} Company Footprint</CardTitle>
                    <CardDescription>
                      Overview of your organisation's greenhouse gas inventory for {selectedYear}
                    </CardDescription>
                  </div>
                  <Button onClick={handleGenerateReport} disabled={isGenerating || isLoadingReport}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate Footprint
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingReport ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {report?.total_emissions && report.total_emissions > 0 ? (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-2">Total Footprint</div>
                        <div className="text-5xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                          {report.total_emissions >= 1000
                            ? `${(report.total_emissions / 1000).toFixed(3)} tCO2e`
                            : `${report.total_emissions.toFixed(3)} kgCO2e`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Last calculated: {new Date(report.updated_at).toLocaleString('en-GB')}
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No emissions calculated yet for {selectedYear}. Add your Scope 1, 2, and 3 data, then click "Calculate Footprint".
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="border-orange-200 dark:border-orange-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Flame className="h-5 w-5 text-orange-500" />
                            <span className="font-medium">Scope 1</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {scope1CO2e > 0
                              ? `${(scope1CO2e / 1000).toFixed(3)} tCO₂e`
                              : 'No data'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Direct emissions (fuel combustion, process, fugitive)</p>
                        </CardContent>
                      </Card>

                      <Card className="border-blue-200 dark:border-blue-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-5 w-5 text-blue-500" />
                            <span className="font-medium">Scope 2</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {scope2CO2e > 0
                              ? `${(scope2CO2e / 1000).toFixed(3)} tCO₂e`
                              : 'No data'}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Indirect emissions (purchased electricity, heat, steam)</p>
                        </CardContent>
                      </Card>

                      <Card className="border-green-200 dark:border-green-900">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="h-5 w-5 text-green-500" />
                            <span className="font-medium">Scope 3</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {(() => {
                              const scope3Total = report?.breakdown_json?.scope3?.total;
                              console.log('Scope 3 Display - breakdown_json:', report?.breakdown_json);
                              console.log('Scope 3 Display - total:', scope3Total);

                              if (scope3Total && scope3Total > 0) {
                                return `${(scope3Total / 1000).toFixed(3)} tCO₂e`;
                              }
                              return 'No data';
                            })()}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Value chain emissions</p>
                          {report?.breakdown_json?.scope3?.products && report.breakdown_json.scope3.products > 0 && (
                            <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Includes Cat 1 from LCAs (Tier 1 data)
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">How to build your footprint</h4>
                        <p className="text-sm text-muted-foreground">
                          1. Select the reporting year above. 2. Add Scope 1 data (fuels, refrigerants).
                          3. Add Scope 2 data (electricity). 4. Add Scope 3 data (travel, services, waste).
                          5. Click Calculate Footprint.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scope1">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Scope 1: Direct Emissions</CardTitle>
                    <CardDescription>
                      Enter data for direct emissions from fuel combustion, mobile sources, and fugitive emissions
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleRunCalculations}
                    disabled={isCalculating || recentData.length === 0}
                    variant="outline"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Run Calculations
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={scope1Form.handleSubmit(onSubmitScope1)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scope1-facility">Facility</Label>
                      <Select
                        value={scope1Form.watch('facility_id')}
                        onValueChange={(value) =>
                          scope1Form.setValue('facility_id', value, {
                            shouldValidate: true,
                          })
                        }
                        disabled={isLoadingFacilities || facilities.length === 0}
                      >
                        <SelectTrigger id="scope1-facility">
                          <SelectValue placeholder="Select facility" />
                        </SelectTrigger>
                        <SelectContent>
                          {facilities.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              {facility.name}
                              {facility.location && ` (${facility.location})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {scope1Form.formState.errors.facility_id && (
                        <p className="text-sm text-red-600">
                          {scope1Form.formState.errors.facility_id.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scope1-fuel-type">Emission Source</Label>
                      <Select
                        value={scope1Form.watch('fuel_type')}
                        onValueChange={handleScope1FuelTypeChange}
                        disabled={isLoadingFuelTypes || scope1Sources.length === 0}
                      >
                        <SelectTrigger id="scope1-fuel-type">
                          <SelectValue placeholder="Select emission source" />
                        </SelectTrigger>
                        <SelectContent>
                          {scope1Sources.filter(s => s.category === 'Stationary Combustion').length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Stationary Combustion</SelectLabel>
                              {scope1Sources
                                .filter(s => s.category === 'Stationary Combustion')
                                .map((source) => (
                                  <SelectItem key={source.id} value={source.source_name}>
                                    {source.source_name} ({source.default_unit})
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                          {scope1Sources.filter(s => s.category === 'Mobile Combustion').length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Mobile Combustion</SelectLabel>
                              {scope1Sources
                                .filter(s => s.category === 'Mobile Combustion')
                                .map((source) => (
                                  <SelectItem key={source.id} value={source.source_name}>
                                    {source.source_name} ({source.default_unit})
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                          {scope1Sources.filter(s => s.category === 'Fugitive Emissions').length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Fugitive Emissions</SelectLabel>
                              {scope1Sources
                                .filter(s => s.category === 'Fugitive Emissions')
                                .map((source) => (
                                  <SelectItem key={source.id} value={source.source_name}>
                                    {source.source_name} ({source.default_unit})
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                      {scope1Form.formState.errors.fuel_type && (
                        <p className="text-sm text-red-600">
                          {scope1Form.formState.errors.fuel_type.message}
                        </p>
                      )}
                      {!isLoadingFuelTypes && scope1Sources.length === 0 && (
                        <p className="text-sm text-amber-600">
                          No emission sources available. Please contact support.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scope1-amount">Amount Consumed</Label>
                      <Input
                        id="scope1-amount"
                        type="number"
                        step="0.01"
                        placeholder="e.g., 1500"
                        {...scope1Form.register('amount')}
                      />
                      {scope1Form.formState.errors.amount && (
                        <p className="text-sm text-red-600">
                          {scope1Form.formState.errors.amount.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scope1-unit">Unit</Label>
                      <Select
                        value={scope1Form.watch('unit')}
                        onValueChange={(value) =>
                          scope1Form.setValue('unit', value as any, {
                            shouldValidate: true,
                          })
                        }
                      >
                        <SelectTrigger id="scope1-unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="litres">Litres</SelectItem>
                          <SelectItem value="kWh">kWh</SelectItem>
                          <SelectItem value="cubic meters">Cubic Metres</SelectItem>
                          <SelectItem value="kg">Kilograms</SelectItem>
                          <SelectItem value="tonnes">Tonnes</SelectItem>
                        </SelectContent>
                      </Select>
                      {scope1Form.formState.errors.unit && (
                        <p className="text-sm text-red-600">
                          {scope1Form.formState.errors.unit.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scope1-date">Activity Date</Label>
                      <Input
                        id="scope1-date"
                        type="date"
                        {...scope1Form.register('activity_date')}
                      />
                      {scope1Form.formState.errors.activity_date && (
                        <p className="text-sm text-red-600">
                          {scope1Form.formState.errors.activity_date.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!scope1Form.formState.isValid || isSubmitting || facilities.length === 0}
                    className="w-full md:w-auto"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Scope 1 Data'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Scope 1 Activity</CardTitle>
                <CardDescription>
                  Recently submitted Scope 1 activity records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : recentData.filter(r => r.category === 'Scope 1').length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No Scope 1 data recorded yet.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Activity</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentData.filter(r => r.category === 'Scope 1').slice(0, 5).map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{formatDate(record.activity_date)}</TableCell>
                            <TableCell className="font-medium">{record.name}</TableCell>
                            <TableCell className="text-right">
                              {record.quantity.toLocaleString()} {record.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scope2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Scope 2: Purchased Energy</CardTitle>
                    <CardDescription>
                      Enter data for indirect emissions from purchased electricity, heating, cooling, and steam
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleRunCalculations}
                    disabled={isCalculating || recentData.length === 0}
                    variant="outline"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Run Calculations
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={scope2Form.handleSubmit(onSubmitScope2)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scope2-facility">Facility</Label>
                      <Select
                        value={scope2Form.watch('facility_id')}
                        onValueChange={(value) =>
                          scope2Form.setValue('facility_id', value, {
                            shouldValidate: true,
                          })
                        }
                        disabled={isLoadingFacilities || facilities.length === 0}
                      >
                        <SelectTrigger id="scope2-facility">
                          <SelectValue placeholder="Select facility" />
                        </SelectTrigger>
                        <SelectContent>
                          {facilities.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              {facility.name}
                              {facility.location && ` (${facility.location})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {scope2Form.formState.errors.facility_id && (
                        <p className="text-sm text-red-600">
                          {scope2Form.formState.errors.facility_id.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scope2-source-type">Energy Source</Label>
                      <Select
                        value={scope2Form.watch('source_type')}
                        onValueChange={handleScope2SourceChange}
                        disabled={isLoadingFuelTypes || scope2Sources.length === 0}
                      >
                        <SelectTrigger id="scope2-source-type">
                          <SelectValue placeholder="Select energy source" />
                        </SelectTrigger>
                        <SelectContent>
                          {scope2Sources.map((source) => (
                            <SelectItem key={source.id} value={source.source_name}>
                              {source.source_name} ({source.default_unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {scope2Form.formState.errors.source_type && (
                        <p className="text-sm text-red-600">
                          {scope2Form.formState.errors.source_type.message}
                        </p>
                      )}
                      {!isLoadingFuelTypes && scope2Sources.length === 0 && (
                        <p className="text-sm text-amber-600">
                          No energy sources available. Please contact support.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scope2-amount">Amount Consumed</Label>
                      <Input
                        id="scope2-amount"
                        type="number"
                        step="0.01"
                        placeholder="e.g., 25000"
                        {...scope2Form.register('amount')}
                      />
                      {scope2Form.formState.errors.amount && (
                        <p className="text-sm text-red-600">
                          {scope2Form.formState.errors.amount.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scope2-unit">Unit</Label>
                      <Select
                        value={scope2Form.watch('unit')}
                        onValueChange={(value) =>
                          scope2Form.setValue('unit', value as any, {
                            shouldValidate: true,
                          })
                        }
                      >
                        <SelectTrigger id="scope2-unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kWh">kWh (kilowatt-hours)</SelectItem>
                          <SelectItem value="MWh">MWh (megawatt-hours)</SelectItem>
                        </SelectContent>
                      </Select>
                      {scope2Form.formState.errors.unit && (
                        <p className="text-sm text-red-600">
                          {scope2Form.formState.errors.unit.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scope2-date">Activity Date</Label>
                      <Input
                        id="scope2-date"
                        type="date"
                        {...scope2Form.register('activity_date')}
                      />
                      {scope2Form.formState.errors.activity_date && (
                        <p className="text-sm text-red-600">
                          {scope2Form.formState.errors.activity_date.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!scope2Form.formState.isValid || isSubmitting || facilities.length === 0}
                    className="w-full md:w-auto"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Scope 2 Data'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Scope 2 Activity</CardTitle>
                <CardDescription>
                  Recently submitted Scope 2 activity records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : recentData.filter(r => r.category === 'Scope 2').length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No Scope 2 data recorded yet.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Activity</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentData.filter(r => r.category === 'Scope 2').slice(0, 5).map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{formatDate(record.activity_date)}</TableCell>
                            <TableCell className="font-medium">{record.name}</TableCell>
                            <TableCell className="text-right">
                              {record.quantity.toLocaleString()} {record.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scope3">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scope 3: Value Chain Emissions</CardTitle>
                <CardDescription>
                  Track indirect emissions from your organisation's value chain for {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Scope 3 emissions typically represent the largest portion of a company's carbon footprint.
                    Add data for business travel, purchased services, employee commuting, and more.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card className="border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Category 1: Purchased Goods & Services
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Auto-calculated from Product LCAs
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Emissions from raw materials and packaging calculated from your product LCAs using ecoinvent database
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingReport ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : scope3Cat1CO2e > 0 ? (
                  <div className="space-y-6">
                    <div className="text-center py-6 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="text-sm text-muted-foreground mb-2">Total Category 1 Emissions</div>
                      <div className="text-4xl font-bold text-green-900 dark:text-green-100 mb-2">
                        {scope3Cat1CO2e.toFixed(3)} tCO2e
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {scope3Cat1DataQuality}
                      </div>
                    </div>

                    <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-sm">
                        <div className="font-semibold text-green-900 dark:text-green-100 mb-1">
                          Tier 1 Primary Data Quality
                        </div>
                        <div className="text-green-800 dark:text-green-200">
                          This data is calculated from your product LCAs using ecoinvent factors -
                          <strong> far more accurate than spend-based estimates</strong> (plus/minus 12% vs plus/minus 50% uncertainty).
                        </div>
                      </AlertDescription>
                    </Alert>

                    {scope3Cat1Breakdown.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">Breakdown by Product:</h4>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                          {scope3Cat1Breakdown.map((product, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-green-100 dark:border-green-900/50"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">{product.product_name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Production: {product.production_volume.toLocaleString()} units
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-semibold text-sm">
                                  {(product.materials_tco2e + product.packaging_tco2e).toFixed(3)} tCO2e
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Materials: {product.materials_tco2e.toFixed(2)} | Packaging: {product.packaging_tco2e.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground mb-4">
                      <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No Category 1 data available</p>
                      <p className="text-sm mt-2">
                        Complete product LCAs and record production volumes to automatically calculate
                        Category 1 emissions from your raw materials and packaging.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => window.location.href = '/products'}
                    >
                      Go to Product LCAs
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {isLoadingReport ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : report ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <BusinessTravelCard
                  reportId={report.id}
                  entries={travelEntries}
                  onUpdate={fetchReportData}
                />

                <MarketingMaterialsCard
                  reportId={report.id}
                  entries={marketingEntries}
                  onUpdate={fetchReportData}
                />

                <ServicesOverheadCard
                  reportId={report.id}
                  entries={serviceEntries}
                  onUpdate={fetchReportData}
                />

                <TeamCommutingCard
                  reportId={report.id}
                  initialFteCount={fteCount}
                  onUpdate={fetchReportData}
                />

                <CapitalGoodsCard
                  reportId={report.id}
                  entries={capitalGoodsEntries}
                  onUpdate={fetchReportData}
                />

                {currentOrganization && (
                  <LogisticsDistributionCard
                    reportId={report.id}
                    organizationId={currentOrganization.id}
                    year={selectedYear}
                    entries={logisticsEntries}
                    onUpdate={fetchReportData}
                  />
                )}

                <OperationalWasteCard
                  reportId={report.id}
                  entries={wasteEntries}
                  onUpdate={fetchReportData}
                />
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Unable to load Scope 3 data collection cards. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
