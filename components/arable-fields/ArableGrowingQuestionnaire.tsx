'use client';

import { useState, useEffect, useRef } from 'react';
import { useAwareFactor } from '@/hooks/data/useAwareFactor';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Wheat,
  Droplets,
  Fuel,
  Sprout,
  ChevronRight,
  ChevronLeft,
  Check,
  Info,
  Loader2,
  Upload,
  FileText,
  AlertTriangle,
  Trash2,
  Download,
  Save,
  Truck,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateArableImpacts } from '@/lib/arable-calculator';
import {
  ARABLE_PESTICIDE_TYPE_LABELS,
  STRAW_MANAGEMENT_LABELS,
  GRAIN_DRYING_FUEL_LABELS,
  LIME_TYPE_LABELS,
} from '@/lib/arable-utils';
import type {
  ArableGrowingProfile,
  ArableSoilCarbonEvidence,
  ArablePesticideType,
  ArableSprayChemicalDraft,
  ArableChemicalType,
  CropType,
  ArableCertification,
  StrawManagement,
  GrainDryingFuel,
  PreviousLandUseType,
} from '@/lib/types/arable';
import type {
  SoilManagement,
  SoilCarbonMethodology,
  FertiliserType,
  IrrigationEnergySource,
} from '@/lib/types/viticulture';
import type { TransportMode } from '@/lib/types/orchard';
import { SOIL_CARBON_REMOVAL_DEFAULTS } from '@/lib/ghg-constants';

interface QuestionnaireProps {
  fieldId: string;
  fieldName: string;
  fieldHectares: number;
  cropType: CropType;
  fieldClimateZone: 'wet' | 'dry' | 'temperate';
  fieldCertification: ArableCertification;
  fieldCountryCode: string | null;
  fieldPreviousLandUse?: PreviousLandUseType | null;
  fieldLandConversionYear?: number | null;
  existingProfile?: ArableGrowingProfile | null;
  harvestYear?: number;
  copyFromData?: Record<string, any>;
  onComplete: (profile: ArableGrowingProfile) => void;
  onCancel: () => void;
}

const PREVIOUS_LAND_USE_OPTIONS: { value: PreviousLandUseType; label: string }[] = [
  { value: 'permanent_arable', label: 'Already arable (no land use change)' },
  { value: 'grassland', label: 'Grassland / pasture' },
  { value: 'forest', label: 'Forest / woodland' },
  { value: 'wetland', label: 'Wetland' },
  { value: 'settlement', label: 'Settlement / urban land' },
  { value: 'other_land', label: 'Other land' },
];

const PESTICIDE_TYPES: { value: ArablePesticideType; label: string }[] = [
  { value: 'generic', label: 'Generic / mixed products' },
  { value: 'sulfur', label: 'Sulfur-based' },
  { value: 'synthetic_fungicide', label: 'Synthetic fungicide' },
];

const HERBICIDE_TYPES: { value: ArablePesticideType; label: string }[] = [
  { value: 'generic', label: 'Generic herbicide' },
  { value: 'herbicide_glyphosate', label: 'Glyphosate-based' },
];

const STEPS = [
  { id: 'soil', label: 'Soil & Land', icon: Sprout },
  { id: 'inputs', label: 'Inputs', icon: Wheat },
  { id: 'machinery', label: 'Machinery & Fuel', icon: Fuel },
  { id: 'irrigation', label: 'Irrigation', icon: Droplets },
  { id: 'transport', label: 'Transport & Yield', icon: Truck },
] as const;

const SOIL_PRACTICES: { value: SoilManagement; label: string; description: string }[] = [
  { value: 'conventional_tillage', label: 'Conventional tillage', description: 'Regular ploughing and mechanical soil disturbance' },
  { value: 'minimum_tillage', label: 'Minimum tillage', description: 'Reduced soil disturbance, shallow cultivation only' },
  { value: 'no_till', label: 'No-till / direct drill', description: 'No mechanical soil disturbance, direct seeding' },
  { value: 'cover_cropping', label: 'Cover cropping (active)', description: 'Living ground cover between cash crops' },
  { value: 'composting', label: 'Composting (active)', description: 'Regular compost application to arable soils' },
  { value: 'biochar_compost', label: 'Biochar + compost', description: 'Biochar-amended compost for enhanced carbon storage' },
  { value: 'regenerative_integrated', label: 'Regenerative integrated', description: 'Holistic approach combining cover crops, no-till, and organic inputs' },
];

const SOIL_CARBON_METHODOLOGIES: { value: SoilCarbonMethodology; label: string; description: string }[] = [
  { value: 'soc_0_30cm_fixed', label: 'SOC sampling 0-30 cm, fixed depth', description: 'IPCC minimum depth. Single composite sample per point.' },
  { value: 'soc_0_30cm_multi_increment', label: 'SOC sampling 0-30 cm, multi-increment', description: 'IPCC recommended: 0-10, 10-20, 20-30 cm increments.' },
  { value: 'soc_0_60cm_fixed', label: 'SOC sampling 0-60 cm, fixed depth', description: 'Verra best practice depth. Single composite per point.' },
  { value: 'soc_0_60cm_multi_increment', label: 'SOC sampling 0-60 cm, multi-increment', description: 'Gold standard: 0-15, 15-30, 30-45, 45-60 cm increments with ESM accounting.' },
  { value: 'full_soil_profile', label: 'Full soil profile (> 60 cm)', description: 'Deep profile analysis, typically for research or baseline studies.' },
  { value: 'other', label: 'Other methodology', description: 'Modelling, remote sensing, or other approach.' },
];

const FERTILISER_TYPES: { value: FertiliserType; label: string }[] = [
  { value: 'none', label: 'None (no fertiliser applied)' },
  { value: 'synthetic_n', label: 'Synthetic nitrogen (e.g. ammonium nitrate)' },
  { value: 'organic_manure', label: 'Organic (manure)' },
  { value: 'organic_compost', label: 'Organic (compost)' },
  { value: 'mixed', label: 'Mixed (synthetic + organic)' },
];

export function ArableGrowingQuestionnaire({
  fieldId,
  fieldName,
  fieldHectares,
  cropType,
  fieldClimateZone,
  fieldCertification,
  fieldCountryCode,
  fieldPreviousLandUse,
  fieldLandConversionYear,
  existingProfile,
  harvestYear,
  copyFromData,
  onComplete,
  onCancel,
}: QuestionnaireProps) {
  const { awareFactor: fieldAwareFactor } = useAwareFactor(fieldCountryCode);
  const currentYear = new Date().getFullYear();
  const [selectedHarvestYear, setSelectedHarvestYear] = useState<number>(
    existingProfile?.harvest_year ?? harvestYear ?? currentYear
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Determine initial values: existingProfile > copyFromData > defaults
  const initSource = existingProfile ?? copyFromData;

  // Form state
  const [form, setForm] = useState({
    // Step 1: Soil & Land
    area_ha: initSource?.area_ha ?? fieldHectares,
    soil_management: (initSource?.soil_management ?? 'conventional_tillage') as SoilManagement,
    straw_management: (initSource?.straw_management ?? 'incorporated') as StrawManagement,
    straw_yield_tonnes_per_ha: initSource?.straw_yield_tonnes_per_ha ?? 2.5,
    lime_applied_kg_per_ha: initSource?.lime_applied_kg_per_ha ?? 0,
    lime_type: (initSource?.lime_type ?? 'none') as 'ite' | 'dolomite' | 'none',

    // Step 2: Inputs
    fertiliser_type: (initSource?.fertiliser_type ?? 'none') as FertiliserType,
    fertiliser_quantity_kg: initSource?.fertiliser_quantity_kg ?? 0,
    fertiliser_n_content_percent: initSource?.fertiliser_n_content_percent ?? 0,
    uses_pesticides: initSource?.uses_pesticides ?? false,
    pesticide_applications_per_year: initSource?.pesticide_applications_per_year ?? 0,
    pesticide_type: (initSource?.pesticide_type ?? 'generic') as ArablePesticideType,
    uses_herbicides: initSource?.uses_herbicides ?? false,
    herbicide_applications_per_year: initSource?.herbicide_applications_per_year ?? 0,
    herbicide_type: (initSource?.herbicide_type ?? 'generic') as ArablePesticideType,
    uses_growth_regulators: initSource?.uses_growth_regulators ?? false,
    growth_regulator_applications: initSource?.growth_regulator_applications ?? 0,
    seed_rate_kg_per_ha: initSource?.seed_rate_kg_per_ha ?? 160,

    // Step 3: Machinery & Fuel
    diesel_litres_per_year: initSource?.diesel_litres_per_year ?? 0,
    petrol_litres_per_year: initSource?.petrol_litres_per_year ?? 0,
    grain_drying_fuel: (initSource?.grain_drying_fuel ?? 'none') as GrainDryingFuel,
    grain_drying_energy_kwh_per_tonne: initSource?.grain_drying_energy_kwh_per_tonne ?? 0,

    // Step 4: Irrigation
    is_irrigated: initSource?.is_irrigated ?? false,
    water_m3_per_ha: initSource?.water_m3_per_ha ?? 0,
    irrigation_energy_source: (initSource?.irrigation_energy_source ?? 'none') as IrrigationEnergySource,

    // Step 5: Transport & Yield
    transport_distance_km: initSource?.transport_distance_km ?? null as number | null,
    transport_mode: (initSource?.transport_mode ?? 'road') as TransportMode,
    grain_yield_tonnes: initSource?.grain_yield_tonnes ?? 0,
    grain_moisture_percent: initSource?.grain_moisture_percent ?? 14.5,

    // Land use change (FLAG-C3) - stored on field, not growing profile
    previous_land_use_type: (fieldPreviousLandUse ?? 'permanent_arable') as PreviousLandUseType,
    land_conversion_year: fieldLandConversionYear ?? null as number | null,

    // Soil carbon measured data
    has_measured_soil_carbon: !!(initSource?.soil_carbon_override_kg_co2e_per_ha),
    soil_carbon_override_kg_co2e_per_ha: initSource?.soil_carbon_override_kg_co2e_per_ha ?? null as number | null,
    soil_carbon_measurement_date: initSource?.soil_carbon_measurement_date ?? '',
    soil_carbon_methodology: (initSource?.soil_carbon_methodology ?? '') as string,
    soil_carbon_lab_name: initSource?.soil_carbon_lab_name ?? '',
    soil_carbon_sampling_points: initSource?.soil_carbon_sampling_points ?? null as number | null,

    // Removal verification (SBTi FLAG / GHG Protocol LSR v1.0)
    removal_verification_status: initSource?.removal_verification_status ?? 'unverified' as string,
    removal_verifier_body: initSource?.removal_verifier_body ?? '' as string,
    removal_verifier_standard: initSource?.removal_verifier_standard ?? '' as string,
    removal_verification_date: initSource?.removal_verification_date ?? '' as string,
    removal_verification_expiry: initSource?.removal_verification_expiry ?? '' as string,

    // TNFD location sensitivity
    ecosystem_type: initSource?.ecosystem_type ?? '' as string,
    in_biodiversity_sensitive_area: initSource?.in_biodiversity_sensitive_area ?? false,
    sensitive_area_details: initSource?.sensitive_area_details ?? '' as string,
    water_stress_index: initSource?.water_stress_index ?? '' as string,

    // Land ownership boundary (GHG Protocol LSR v1.0)
    land_ownership_type: initSource?.land_ownership_type ?? '' as string,
    lease_expiry_date: initSource?.lease_expiry_date ?? '' as string,
    is_boundary_controlled: initSource?.is_boundary_controlled ?? true,
  });

  // Soil carbon evidence state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [existingEvidence, setExistingEvidence] = useState<ArableSoilCarbonEvidence[]>([]);

  // Spray chemicals state
  const [sprayChemicals, setSprayChemicals] = useState<ArableSprayChemicalDraft[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const sprayFileInputRef = useRef<HTMLInputElement>(null);

  // Load existing evidence when editing a profile
  useEffect(() => {
    if (!existingProfile?.id) return;
    fetch(`/api/arable-fields/${fieldId}/growing-profile/evidence?profile_id=${existingProfile.id}`)
      .then((res) => res.json())
      .then(({ data }) => { if (data) setExistingEvidence(data); })
      .catch(() => { /* silently fail - evidence is optional */ });
  }, [existingProfile?.id, fieldId]);

  // Load existing spray chemicals when editing a profile
  useEffect(() => {
    if (!existingProfile?.id) return;
    fetch(`/api/arable-fields/${fieldId}/spray-chemicals?growing_profile_id=${existingProfile.id}`)
      .then((res) => res.json())
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSprayChemicals(data.map((row: any) => ({
            chemical_name: row.chemical_name,
            chemical_type: row.chemical_type,
            unit: row.unit,
            rate_per_ha: row.rate_per_ha,
            water_rate_l_per_ha: row.water_rate_l_per_ha,
            total_ha_sprayed: row.total_ha_sprayed,
            total_amount_used: row.total_amount_used,
            applications_count: row.applications_count,
            n_content_percent: row.n_content_percent,
            fertiliser_subtype: row.fertiliser_subtype,
            library_matched: row.library_matched,
          })));
        }
      })
      .catch(() => { /* silently fail */ });
  }, [existingProfile?.id, fieldId]);

  /**
   * Derive simplified form fields from detailed spray chemical data.
   * Aggregates chemical records by type to populate the calculator inputs.
   */
  function deriveSimplifiedFields(chemicals: ArableSprayChemicalDraft[]) {
    const fertilisers = chemicals.filter((c) => c.chemical_type === 'fertiliser');
    const fungicides = chemicals.filter((c) => c.chemical_type === 'fungicide');
    const insecticides = chemicals.filter((c) => c.chemical_type === 'insecticide');
    const herbicides = chemicals.filter((c) => c.chemical_type === 'herbicide');
    const growthRegs = chemicals.filter((c) => c.chemical_type === 'growth_regulator');

    // Fertiliser: total quantity + weighted-average N%
    const totalFertKg = fertilisers.reduce((sum, c) => sum + (c.total_amount_used || 0), 0);
    const weightedN = totalFertKg > 0
      ? fertilisers.reduce((sum, c) => sum + (c.total_amount_used || 0) * (c.n_content_percent || 0), 0) / totalFertKg
      : 0;

    // Determine dominant fertiliser subtype
    let fertType: FertiliserType = 'none';
    if (totalFertKg > 0) {
      const syntheticKg = fertilisers.filter((c) => c.fertiliser_subtype === 'synthetic_n').reduce((s, c) => s + (c.total_amount_used || 0), 0);
      const organicKg = totalFertKg - syntheticKg;
      if (syntheticKg > 0 && organicKg > 0) fertType = 'mixed';
      else if (syntheticKg > 0) fertType = 'synthetic_n';
      else {
        const manureKg = fertilisers.filter((c) => c.fertiliser_subtype === 'organic_manure').reduce((s, c) => s + (c.total_amount_used || 0), 0);
        fertType = manureKg > organicKg / 2 ? 'organic_manure' : 'organic_compost';
      }
    }

    // Pesticides = fungicides + insecticides
    const pesticideApps = fungicides.reduce((s, c) => s + (c.applications_count || 0), 0)
      + insecticides.reduce((s, c) => s + (c.applications_count || 0), 0);
    const herbicideApps = herbicides.reduce((s, c) => s + (c.applications_count || 0), 0);
    const growthRegApps = growthRegs.reduce((s, c) => s + (c.applications_count || 0), 0);

    // Determine herbicide type based on presence of glyphosate
    const hasGlyphosate = herbicides.some((c) =>
      c.chemical_name.toLowerCase().includes('glyphosate') ||
      c.chemical_name.toLowerCase().includes('roundup')
    );

    return {
      fertiliser_type: fertType,
      fertiliser_quantity_kg: Math.round(totalFertKg),
      fertiliser_n_content_percent: Math.round(weightedN * 10) / 10,
      uses_pesticides: pesticideApps > 0,
      pesticide_applications_per_year: pesticideApps,
      pesticide_type: 'generic' as ArablePesticideType,
      uses_herbicides: herbicideApps > 0,
      herbicide_applications_per_year: herbicideApps,
      herbicide_type: (hasGlyphosate ? 'herbicide_glyphosate' : 'generic') as ArablePesticideType,
      uses_growth_regulators: growthRegApps > 0,
      growth_regulator_applications: growthRegApps,
    };
  }

  async function handleSprayImport(file: File) {
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/arable-fields/${fieldId}/spray-import`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to parse spray diary');
      }
      const { chemicals } = await res.json();
      setSprayChemicals(chemicals);
      updateForm(deriveSimplifiedFields(chemicals));
      toast.success(`Imported ${chemicals.length} chemical records`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to import spray diary');
    } finally {
      setIsImporting(false);
    }
  }

  // Build harvest year options (current year down to current-10)
  const harvestYearOptions = Array.from({ length: 11 }, (_, i) => currentYear - i);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  function updateForm(updates: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  async function handleSave(asDraft: boolean) {
    // Full validation only when finalising
    if (!asDraft) {
      if (form.grain_yield_tonnes <= 0) {
        toast.error('Please enter the grain yield (tonnes) to finalise');
        return;
      }

      if (form.has_measured_soil_carbon) {
        if (!form.soil_carbon_override_kg_co2e_per_ha || form.soil_carbon_override_kg_co2e_per_ha <= 0) {
          toast.error('Please enter a measured soil carbon removal value');
          return;
        }
        if (!form.soil_carbon_measurement_date) {
          toast.error('Please enter the soil carbon measurement date');
          return;
        }
        if (!form.soil_carbon_methodology) {
          toast.error('Please select a sampling methodology');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const url = `/api/arable-fields/${fieldId}/growing-profile`;
      const method = existingProfile ? 'PATCH' : 'POST';

      const body = {
        ...(existingProfile ? { id: existingProfile.id } : {}),
        harvest_year: selectedHarvestYear,
        area_ha: form.area_ha,
        soil_management: form.soil_management,

        // Arable-specific: straw & lime
        straw_management: form.straw_management,
        straw_yield_tonnes_per_ha: form.straw_yield_tonnes_per_ha,
        lime_applied_kg_per_ha: form.lime_type !== 'none' ? form.lime_applied_kg_per_ha : 0,
        lime_type: form.lime_type,

        // Inputs
        fertiliser_type: form.fertiliser_type,
        fertiliser_quantity_kg: form.fertiliser_quantity_kg,
        fertiliser_n_content_percent: form.fertiliser_n_content_percent,
        uses_pesticides: form.uses_pesticides,
        pesticide_applications_per_year: form.pesticide_applications_per_year,
        pesticide_type: form.pesticide_type,
        uses_herbicides: form.uses_herbicides,
        herbicide_applications_per_year: form.herbicide_applications_per_year,
        herbicide_type: form.herbicide_type,
        uses_growth_regulators: form.uses_growth_regulators,
        growth_regulator_applications: form.growth_regulator_applications,
        seed_rate_kg_per_ha: form.seed_rate_kg_per_ha,

        // Machinery & Fuel
        diesel_litres_per_year: form.diesel_litres_per_year,
        petrol_litres_per_year: form.petrol_litres_per_year,
        grain_drying_fuel: form.grain_drying_fuel,
        grain_drying_energy_kwh_per_tonne: form.grain_drying_fuel !== 'none' ? form.grain_drying_energy_kwh_per_tonne : 0,

        // Irrigation
        is_irrigated: form.is_irrigated,
        water_m3_per_ha: form.water_m3_per_ha,
        irrigation_energy_source: form.irrigation_energy_source,

        // Yield
        grain_yield_tonnes: form.grain_yield_tonnes,
        grain_moisture_percent: form.grain_moisture_percent,

        // Transport
        transport_distance_km: form.transport_distance_km,
        transport_mode: form.transport_mode,

        // Soil carbon measured data
        soil_carbon_override_kg_co2e_per_ha: form.has_measured_soil_carbon
          ? form.soil_carbon_override_kg_co2e_per_ha
          : null,
        soil_carbon_measurement_date: form.has_measured_soil_carbon
          ? form.soil_carbon_measurement_date || null
          : null,
        soil_carbon_methodology: form.has_measured_soil_carbon
          ? form.soil_carbon_methodology || null
          : null,
        soil_carbon_lab_name: form.has_measured_soil_carbon
          ? form.soil_carbon_lab_name || null
          : null,
        soil_carbon_sampling_points: form.has_measured_soil_carbon
          ? form.soil_carbon_sampling_points
          : null,

        // Removal verification
        removal_verification_status: form.has_measured_soil_carbon
          ? form.removal_verification_status || 'unverified'
          : 'unverified',
        removal_verifier_body: form.has_measured_soil_carbon
          ? form.removal_verifier_body || null
          : null,
        removal_verifier_standard: form.has_measured_soil_carbon
          ? form.removal_verifier_standard || null
          : null,
        removal_verification_date: form.has_measured_soil_carbon
          ? form.removal_verification_date || null
          : null,
        removal_verification_expiry: form.has_measured_soil_carbon
          ? form.removal_verification_expiry || null
          : null,

        // TNFD location sensitivity
        ecosystem_type: form.ecosystem_type || null,
        in_biodiversity_sensitive_area: form.in_biodiversity_sensitive_area,
        sensitive_area_details: form.in_biodiversity_sensitive_area
          ? form.sensitive_area_details || null
          : null,
        water_stress_index: form.water_stress_index || null,

        // Land ownership boundary
        land_ownership_type: form.land_ownership_type || null,
        lease_expiry_date: (form.land_ownership_type === 'leased' || form.land_ownership_type === 'rental')
          ? form.lease_expiry_date || null
          : null,
        is_boundary_controlled: form.is_boundary_controlled,
        is_draft: asDraft,
      };

      // Save LUC fields to the arable field record (not the growing profile)
      const lucChanged =
        form.previous_land_use_type !== (fieldPreviousLandUse ?? 'permanent_arable') ||
        form.land_conversion_year !== fieldLandConversionYear;
      if (lucChanged) {
        await fetch(`/api/arable-fields/${fieldId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            previous_land_use_type: form.previous_land_use_type === 'permanent_arable'
              ? null
              : form.previous_land_use_type,
            land_conversion_year: form.previous_land_use_type === 'permanent_arable'
              ? null
              : form.land_conversion_year,
          }),
        });
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save growing profile');
      }

      const { data } = await res.json();

      // Upload evidence file if pending
      if (evidenceFile && data?.id) {
        setEvidenceUploading(true);
        try {
          const evidenceFormData = new FormData();
          evidenceFormData.append('file', evidenceFile);
          evidenceFormData.append('profile_id', data.id);

          const evidenceRes = await fetch(
            `/api/arable-fields/${fieldId}/growing-profile/evidence`,
            { method: 'POST', body: evidenceFormData }
          );
          if (!evidenceRes.ok) {
            toast.error('Profile saved but evidence upload failed. You can re-upload later.');
          }
        } catch {
          toast.error('Profile saved but evidence upload failed. You can re-upload later.');
        } finally {
          setEvidenceUploading(false);
        }
      }

      // Save spray chemicals if any
      if (sprayChemicals.length > 0 && data?.id) {
        await fetch(`/api/arable-fields/${fieldId}/spray-chemicals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ growing_profile_id: data.id, chemicals: sprayChemicals }),
        });
      }

      toast.success(asDraft ? 'Draft saved' : 'Growing profile saved');
      onComplete(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Preview calculation
  const previewResult = calculateArableImpacts({
    crop_type: cropType,
    climate_zone: fieldClimateZone,
    certification: fieldCertification,
    location_country_code: fieldCountryCode,
    aware_factor: fieldAwareFactor,
    area_ha: form.area_ha,
    soil_management: form.soil_management,
    straw_management: form.straw_management,
    straw_yield_tonnes_per_ha: form.straw_yield_tonnes_per_ha,
    lime_applied_kg_per_ha: form.lime_type !== 'none' ? form.lime_applied_kg_per_ha : 0,
    lime_type: form.lime_type,
    fertiliser_type: form.fertiliser_type,
    fertiliser_quantity_kg: form.fertiliser_quantity_kg,
    fertiliser_n_content_percent: form.fertiliser_n_content_percent,
    uses_pesticides: form.uses_pesticides,
    pesticide_applications_per_year: form.pesticide_applications_per_year,
    pesticide_type: form.pesticide_type,
    uses_herbicides: form.uses_herbicides,
    herbicide_applications_per_year: form.herbicide_applications_per_year,
    herbicide_type: form.herbicide_type,
    uses_growth_regulators: form.uses_growth_regulators,
    growth_regulator_applications: form.growth_regulator_applications,
    seed_rate_kg_per_ha: form.seed_rate_kg_per_ha,
    diesel_litres_per_year: form.diesel_litres_per_year,
    petrol_litres_per_year: form.petrol_litres_per_year,
    grain_drying_fuel: form.grain_drying_fuel,
    grain_drying_energy_kwh_per_tonne: form.grain_drying_fuel !== 'none' ? form.grain_drying_energy_kwh_per_tonne : 0,
    is_irrigated: form.is_irrigated,
    water_m3_per_ha: form.water_m3_per_ha,
    irrigation_energy_source: form.irrigation_energy_source,
    grain_yield_tonnes: form.grain_yield_tonnes,
    grain_moisture_percent: form.grain_moisture_percent,
    transport_distance_km: form.transport_distance_km,
    transport_mode: form.transport_mode,
    soil_carbon_override_kg_co2e_per_ha: form.has_measured_soil_carbon
      ? form.soil_carbon_override_kg_co2e_per_ha
      : null,
    previous_land_use_type: form.previous_land_use_type,
    land_conversion_year: form.land_conversion_year,
    harvest_year: selectedHarvestYear,
    land_ownership_type: (form.land_ownership_type || undefined) as 'owned' | 'leased' | 'rental' | 'contract_growing' | undefined,
    lease_expiry_date: form.lease_expiry_date || null,
    is_boundary_controlled: form.is_boundary_controlled,
    removal_verification_status: (form.removal_verification_status || 'unverified') as 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired',
    removal_verifier_body: form.removal_verifier_body || undefined,
    removal_verifier_standard: form.removal_verifier_standard || undefined,
    removal_verification_date: form.removal_verification_date || undefined,
    removal_verification_expiry: form.removal_verification_expiry || undefined,
    ecosystem_type: (form.ecosystem_type || undefined) as any,
    in_biodiversity_sensitive_area: form.in_biodiversity_sensitive_area,
    sensitive_area_details: form.sensitive_area_details || undefined,
    water_stress_index: (form.water_stress_index || undefined) as any,
  });

  return (
    <div className="space-y-4">
      {/* Harvest Year Selector */}
      <div className="flex items-center gap-3">
        <Label htmlFor="harvest-year" className="text-sm font-medium whitespace-nowrap">Harvest Year</Label>
        <Select
          value={String(selectedHarvestYear)}
          onValueChange={(v) => setSelectedHarvestYear(parseInt(v))}
        >
          <SelectTrigger id="harvest-year" className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {harvestYearOptions.map((yr) => (
              <SelectItem key={yr} value={String(yr)}>
                {yr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Arable growing questionnaire for <span className="text-foreground font-medium">{fieldName}</span>
          </span>
          <span className="text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex gap-1">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(i)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  i === currentStep
                    ? 'bg-[#ccff00]/20 text-[#ccff00]'
                    : i < currentStep
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {i < currentStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Soil & Land */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Soil & Land Management</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  How you manage your arable soils affects carbon sequestration and N2O emissions.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="area">Area for this product (ha)</Label>
                    <Input
                      id="area"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.area_ha || ''}
                      onChange={(e) => updateForm({ area_ha: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Field total: {fieldHectares} ha. Enter the area used for this product.
                    </p>
                    {form.area_ha > fieldHectares && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Area exceeds field total ({fieldHectares} ha)
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Straw management</Label>
                    <Select
                      value={form.straw_management}
                      onValueChange={(v) => updateForm({ straw_management: v as StrawManagement })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STRAW_MANAGEMENT_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="straw-yield">Straw yield (t/ha)</Label>
                    <Input
                      id="straw-yield"
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.straw_yield_tonnes_per_ha || ''}
                      onChange={(e) => updateForm({ straw_yield_tonnes_per_ha: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 2.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for crop residue N2O calculation. UK average: 2-3.5 t/ha.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Lime type</Label>
                    <Select
                      value={form.lime_type}
                      onValueChange={(v) => updateForm({ lime_type: v as 'ite' | 'dolomite' | 'none' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LIME_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.lime_type !== 'none' && (
                  <div className="grid gap-2 max-w-[300px]">
                    <Label htmlFor="lime-qty">Lime applied (kg/ha)</Label>
                    <Input
                      id="lime-qty"
                      type="number"
                      min="0"
                      value={form.lime_applied_kg_per_ha || ''}
                      onChange={(e) => updateForm({ lime_applied_kg_per_ha: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 2000"
                    />
                    <p className="text-xs text-muted-foreground">
                      IPCC Tier 1: CO2 emissions calculated from lime dissolution in soil.
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Soil management practice</Label>
                  <div className="grid gap-2">
                    {SOIL_PRACTICES.map((practice) => (
                      <button
                        key={practice.value}
                        onClick={() => updateForm({ soil_management: practice.value })}
                        className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                          form.soil_management === practice.value
                            ? 'border-[#ccff00] bg-[#ccff00]/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          form.soil_management === practice.value
                            ? 'border-[#ccff00]'
                            : 'border-muted-foreground/30'
                        }`}>
                          {form.soil_management === practice.value && (
                            <div className="h-2 w-2 rounded-full bg-[#ccff00]" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{practice.label}</div>
                          <div className="text-xs text-muted-foreground">{practice.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Land & Tenure (GHG Protocol LSR v1.0) */}
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Land ownership type</Label>
                    <p className="text-xs text-muted-foreground">
                      GHG Protocol Land Sector and Removals Standard requires the operational boundary for land to be defined.
                    </p>
                    <Select
                      value={form.land_ownership_type}
                      onValueChange={(v) => updateForm({ land_ownership_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ownership type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owned">Owned</SelectItem>
                        <SelectItem value="leased">Leased</SelectItem>
                        <SelectItem value="rental">Rental</SelectItem>
                        <SelectItem value="contract_growing">Contract growing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(form.land_ownership_type === 'leased' || form.land_ownership_type === 'rental') && (
                    <div className="grid gap-2 max-w-[200px]">
                      <Label htmlFor="lease-expiry">Lease expiry date</Label>
                      <Input
                        id="lease-expiry"
                        type="date"
                        value={form.lease_expiry_date}
                        onChange={(e) => updateForm({ lease_expiry_date: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Organisation controls land management</Label>
                      <p className="text-xs text-muted-foreground">
                        Whether your organisation makes land management decisions (e.g. soil practices, inputs)
                      </p>
                    </div>
                    <Switch
                      checked={form.is_boundary_controlled}
                      onCheckedChange={(v) => updateForm({ is_boundary_controlled: v })}
                    />
                  </div>
                </div>

                {/* TNFD Location & Nature */}
                <Separator className="my-4" />
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Location & Nature (TNFD)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ecosystem and biodiversity data for nature-related disclosure.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Ecosystem type</Label>
                      <p className="text-xs text-muted-foreground">
                        Select the dominant ecosystem type at your field's location. This is used for TNFD nature impact disclosure.
                      </p>
                      <Select
                        value={form.ecosystem_type}
                        onValueChange={(v) => updateForm({ ecosystem_type: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select ecosystem type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="temperate_forest">Temperate Forest</SelectItem>
                          <SelectItem value="mediterranean">Mediterranean</SelectItem>
                          <SelectItem value="grassland">Grassland</SelectItem>
                          <SelectItem value="wetland">Wetland</SelectItem>
                          <SelectItem value="shrubland">Shrubland</SelectItem>
                          <SelectItem value="tropical_forest">Tropical Forest</SelectItem>
                          <SelectItem value="boreal_forest">Boreal Forest</SelectItem>
                          <SelectItem value="semi_arid">Semi-Arid</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Within or adjacent to a biodiversity-sensitive area?</Label>
                        <p className="text-xs text-muted-foreground">
                          This includes Key Biodiversity Areas, UNESCO World Heritage Sites, Ramsar wetlands, national parks, and other protected designations.
                        </p>
                      </div>
                      <Switch
                        checked={form.in_biodiversity_sensitive_area}
                        onCheckedChange={(v) => updateForm({ in_biodiversity_sensitive_area: v })}
                      />
                    </div>

                    {form.in_biodiversity_sensitive_area && (
                      <>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Sensitive area name and designation</Label>
                          <Input
                            value={form.sensitive_area_details}
                            onChange={(e) => updateForm({ sensitive_area_details: e.target.value })}
                            placeholder="e.g. Breckland SPA"
                            className="h-9"
                          />
                        </div>

                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                          <p className="text-xs text-amber-400">
                            Operations within or adjacent to sensitive areas require enhanced disclosure under TNFD and CSRD ESRS E4. Consider commissioning a biodiversity impact assessment.
                          </p>
                        </div>
                      </>
                    )}

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Water stress index</Label>
                      <p className="text-xs text-muted-foreground">
                        Based on WRI Aqueduct or equivalent water risk atlas. If unsure, check aqueduct.wri.org for your postcode.
                      </p>
                      <Select
                        value={form.water_stress_index}
                        onValueChange={(v) => updateForm({ water_stress_index: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select water stress level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="very_high">Very High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Land Use Change (FLAG-C3) */}
                <div className="grid gap-4">
                  <div>
                    <Label>Previous land use</Label>
                    <p className="text-xs text-muted-foreground">
                      What was this land used for before it became arable?
                      Required for FLAG-compliant land use change (dLUC) calculations.
                    </p>
                  </div>
                  <Select
                    value={form.previous_land_use_type}
                    onValueChange={(v) => updateForm({ previous_land_use_type: v as PreviousLandUseType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREVIOUS_LAND_USE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {form.previous_land_use_type !== 'permanent_arable' && (
                    <div className="grid gap-2 max-w-[200px]">
                      <Label htmlFor="conversion-year">Year of conversion to arable</Label>
                      <Input
                        id="conversion-year"
                        type="number"
                        min="1900"
                        max={currentYear}
                        value={form.land_conversion_year ?? ''}
                        onChange={(e) =>
                          updateForm({
                            land_conversion_year: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        placeholder={`e.g. ${currentYear - 5}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Emissions from land use change are amortised over 20 years.
                        {form.land_conversion_year && currentYear - form.land_conversion_year >= 20 && (
                          <span className="block mt-1 text-green-600 dark:text-green-400">
                            Conversion was 20+ years ago, so dLUC emissions are fully amortised (zero).
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Measured Soil Carbon Section */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Measured soil carbon data</Label>
                      <p className="text-xs text-muted-foreground">
                        If you have laboratory soil carbon measurements, enter them here for higher accuracy
                      </p>
                    </div>
                    <Switch
                      checked={form.has_measured_soil_carbon}
                      onCheckedChange={(v) => updateForm({ has_measured_soil_carbon: v })}
                    />
                  </div>

                  {!form.has_measured_soil_carbon && (
                    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        Using practice-based default for <span className="font-medium text-foreground">
                          {SOIL_PRACTICES.find((p) => p.value === form.soil_management)?.label ?? form.soil_management}
                        </span>:{' '}
                        <span className="font-medium text-foreground">
                          {SOIL_CARBON_REMOVAL_DEFAULTS[form.soil_management] ?? 0} kg CO2e/ha/yr
                        </span>{' '}
                        removal (conservative estimate).
                      </p>
                    </div>
                  )}

                  {form.has_measured_soil_carbon && (
                    <div className="space-y-4 mt-4">
                      {/* Row 1: Value + Date */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="soil-carbon-value">
                            Measured removal (kg CO2e/ha/yr) *
                          </Label>
                          <Input
                            id="soil-carbon-value"
                            type="number"
                            min="0"
                            max="2000"
                            step="1"
                            value={form.soil_carbon_override_kg_co2e_per_ha ?? ''}
                            onChange={(e) =>
                              updateForm({
                                soil_carbon_override_kg_co2e_per_ha:
                                  e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            placeholder="e.g. 480"
                          />
                          {form.soil_carbon_override_kg_co2e_per_ha != null && form.soil_carbon_override_kg_co2e_per_ha > 1500 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Unusually high. Please verify your measurement.
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="soil-carbon-date">Measurement date *</Label>
                          <Input
                            id="soil-carbon-date"
                            type="date"
                            value={form.soil_carbon_measurement_date || ''}
                            onChange={(e) =>
                              updateForm({ soil_carbon_measurement_date: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Row 2: Methodology + Lab */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Sampling methodology *</Label>
                          <Select
                            value={form.soil_carbon_methodology}
                            onValueChange={(v) => updateForm({ soil_carbon_methodology: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select methodology" />
                            </SelectTrigger>
                            <SelectContent>
                              {SOIL_CARBON_METHODOLOGIES.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  <div>
                                    <div>{m.label}</div>
                                    <div className="text-xs text-muted-foreground">{m.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="soil-carbon-lab">Lab / verifier name</Label>
                          <Input
                            id="soil-carbon-lab"
                            value={form.soil_carbon_lab_name || ''}
                            onChange={(e) => updateForm({ soil_carbon_lab_name: e.target.value })}
                            placeholder="e.g. NRM Laboratories"
                          />
                        </div>
                      </div>

                      {/* Row 3: Sampling points */}
                      <div className="grid gap-2 max-w-[200px]">
                        <Label htmlFor="sampling-points">Sampling points (optional)</Label>
                        <Input
                          id="sampling-points"
                          type="number"
                          min="1"
                          value={form.soil_carbon_sampling_points ?? ''}
                          onChange={(e) =>
                            updateForm({
                              soil_carbon_sampling_points:
                                e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          placeholder="e.g. 12"
                        />
                      </div>

                      {/* Comparison card */}
                      {form.soil_carbon_override_kg_co2e_per_ha != null && form.soil_carbon_override_kg_co2e_per_ha > 0 && (
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Practice default</div>
                              <div className="font-medium text-foreground">
                                {SOIL_CARBON_REMOVAL_DEFAULTS[form.soil_management] ?? 0} kg CO2e/ha/yr
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Your measurement</div>
                              <div className="font-medium text-foreground">
                                {form.soil_carbon_override_kg_co2e_per_ha} kg CO2e/ha/yr
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Difference</div>
                              <div className="font-medium text-foreground">
                                {(() => {
                                  const defaultVal = SOIL_CARBON_REMOVAL_DEFAULTS[form.soil_management] ?? 0;
                                  if (defaultVal === 0) return 'N/A (no default)';
                                  const diff = ((form.soil_carbon_override_kg_co2e_per_ha! - defaultVal) / defaultVal) * 100;
                                  return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Evidence upload */}
                      <div className="space-y-2">
                        <Label>Lab report (PDF)</Label>
                        <p className="text-xs text-muted-foreground">
                          Upload the laboratory report as supporting evidence. Optional but recommended for credibility.
                        </p>

                        {existingEvidence.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-lg border border-border p-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{doc.document_name}</span>
                              {doc.file_size_bytes && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({(doc.file_size_bytes / 1024).toFixed(0)} KB)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {doc.signed_url && (
                                <a
                                  href={doc.signed_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-muted-foreground hover:text-foreground"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await fetch(
                                    `/api/arable-fields/${fieldId}/growing-profile/evidence?evidence_id=${doc.id}`,
                                    { method: 'DELETE' }
                                  );
                                  if (res.ok) {
                                    setExistingEvidence((prev) => prev.filter((d) => d.id !== doc.id));
                                    toast.success('Evidence removed');
                                  } else {
                                    toast.error('Failed to remove evidence');
                                  }
                                }}
                                className="p-1 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {evidenceFile && (
                          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#ccff00]/50 bg-[#ccff00]/5 p-2">
                            <Upload className="h-4 w-4 text-[#ccff00]" />
                            <span className="text-sm">{evidenceFile.name}</span>
                            <span className="text-xs text-muted-foreground">
                              (will upload on save)
                            </span>
                            <button
                              type="button"
                              onClick={() => setEvidenceFile(null)}
                              className="ml-auto p-1 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {!evidenceFile && (
                          <label className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Choose PDF file (max 20 MB)
                            </span>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.type !== 'application/pdf') {
                                  toast.error('Only PDF files are accepted');
                                  return;
                                }
                                if (file.size > 20 * 1024 * 1024) {
                                  toast.error('File must be under 20 MB');
                                  return;
                                }
                                setEvidenceFile(file);
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Removal verification */}
                      <div className="space-y-3 pt-3 border-t border-border">
                        <div>
                          <Label className="text-sm font-medium">Removal verification</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Third-party verification is required for SBTi FLAG submission and GHG Protocol LSR v1.0 compliance.
                          </p>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Verification status</Label>
                            <Select
                              value={form.removal_verification_status}
                              onValueChange={(v) => updateForm({ removal_verification_status: v })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unverified">Unverified</SelectItem>
                                <SelectItem value="pending">Pending verification</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {form.removal_verification_status !== 'unverified' && (
                            <>
                              <div className="grid gap-1.5">
                                <Label className="text-xs">Verification body</Label>
                                <Input
                                  value={form.removal_verifier_body}
                                  onChange={(e) => updateForm({ removal_verifier_body: e.target.value })}
                                  placeholder="e.g. SCS Global Services, Verra"
                                  className="h-9"
                                />
                              </div>

                              <div className="grid gap-1.5">
                                <Label className="text-xs">Verification standard</Label>
                                <Select
                                  value={form.removal_verifier_standard}
                                  onValueChange={(v) => updateForm({ removal_verifier_standard: v })}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select standard" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ISO 14064-3">ISO 14064-3</SelectItem>
                                    <SelectItem value="Verra VCS">Verra VCS</SelectItem>
                                    <SelectItem value="Gold Standard">Gold Standard</SelectItem>
                                    <SelectItem value="Plan Vivo">Plan Vivo</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">Verification date</Label>
                                  <Input
                                    type="date"
                                    value={form.removal_verification_date}
                                    onChange={(e) => updateForm({ removal_verification_date: e.target.value })}
                                    className="h-9"
                                  />
                                </div>
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">Expiry date</Label>
                                  <Input
                                    type="date"
                                    value={form.removal_verification_expiry}
                                    onChange={(e) => updateForm({ removal_verification_expiry: e.target.value })}
                                    className="h-9"
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {form.removal_verification_status === 'unverified' && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                              <p className="text-xs text-amber-400">
                                Third-party verification to ISO 14064-3 or equivalent is required for SBTi FLAG submission. Unverified removals will be flagged in reports.
                              </p>
                            </div>
                          )}

                          {form.removal_verification_status === 'expired' && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                              <p className="text-xs text-amber-400">
                                Removal verification has expired. Removals will not meet LSR standard until re-verification is completed.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Inputs */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Fertiliser, Crop Protection & Seed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Synthetic nitrogen fertiliser is typically the largest single emission source in arable cropping.
                </p>
              </div>

              {/* Spray diary import */}
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Upload className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Import spray diary</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload your spray schedule spreadsheet (.xlsx) and we will automatically extract and classify all chemical applications.
                      You can review and edit the data before saving.
                    </p>
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sprayFileInputRef.current?.click()}
                        disabled={isImporting}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analysing...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Choose file
                          </>
                        )}
                      </Button>
                      <input
                        ref={sprayFileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleSprayImport(f);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Imported chemicals table */}
              {sprayChemicals.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Imported chemicals ({sprayChemicals.length})</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSprayChemicals([]);
                        toast.info('Spray data cleared');
                      }}
                      className="text-xs text-muted-foreground"
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="rounded-lg border overflow-x-auto">
                    <div className="min-w-[700px]">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_100px_60px_80px_80px_80px_68px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                        <span>Chemical</span>
                        <span>Type</span>
                        <span>N%</span>
                        <span>Rate/ha</span>
                        <span>Total ha</span>
                        <span>Total used</span>
                        <span></span>
                      </div>
                      {/* Rows */}
                      {sprayChemicals.map((chem, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr_100px_60px_80px_80px_80px_68px] gap-2 px-3 py-1.5 items-center border-t text-sm"
                        >
                          <Input
                            value={chem.chemical_name}
                            onChange={(e) => {
                              const updated = [...sprayChemicals];
                              updated[idx] = { ...chem, chemical_name: e.target.value };
                              setSprayChemicals(updated);
                            }}
                            className="h-7 text-xs"
                          />
                          <Badge
                            variant="secondary"
                            className={`text-[10px] justify-center ${
                              chem.chemical_type === 'fertiliser' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                              chem.chemical_type === 'fungicide' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                              chem.chemical_type === 'herbicide' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                              chem.chemical_type === 'insecticide' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                              chem.chemical_type === 'growth_regulator' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                              chem.chemical_type === 'seed_treatment' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                              ''
                            }`}
                          >
                            {chem.chemical_type === 'growth_regulator' ? 'PGR' :
                             chem.chemical_type === 'seed_treatment' ? 'Seed Tx' :
                             chem.chemical_type}
                          </Badge>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={chem.n_content_percent || ''}
                            disabled={chem.chemical_type !== 'fertiliser'}
                            onChange={(e) => {
                              const updated = [...sprayChemicals];
                              updated[idx] = { ...chem, n_content_percent: parseFloat(e.target.value) || 0 };
                              setSprayChemicals(updated);
                              updateForm(deriveSimplifiedFields(updated));
                            }}
                            className="h-7 text-xs"
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={chem.rate_per_ha || ''}
                              onChange={(e) => {
                                const newRate = parseFloat(e.target.value) || 0;
                                const updated = [...sprayChemicals];
                                updated[idx] = {
                                  ...chem,
                                  rate_per_ha: newRate,
                                  total_amount_used: newRate * (chem.total_ha_sprayed || 0),
                                };
                                setSprayChemicals(updated);
                                updateForm(deriveSimplifiedFields(updated));
                              }}
                              className="h-7 text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground">{chem.unit}</span>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={chem.total_ha_sprayed || ''}
                            onChange={(e) => {
                              const newHa = parseFloat(e.target.value) || 0;
                              const updated = [...sprayChemicals];
                              updated[idx] = {
                                ...chem,
                                total_ha_sprayed: newHa,
                                total_amount_used: (chem.rate_per_ha || 0) * newHa,
                              };
                              setSprayChemicals(updated);
                              updateForm(deriveSimplifiedFields(updated));
                            }}
                            className="h-7 text-xs"
                          />
                          <span className="text-xs text-muted-foreground text-right tabular-nums">
                            {(chem.total_amount_used || 0).toFixed(1)} {chem.unit}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {!chem.library_matched && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-green-600"
                                title="Add to chemical library"
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/chemical-library', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        chemical_name: chem.chemical_name,
                                        chemical_type: chem.chemical_type,
                                        n_content_percent: chem.n_content_percent ?? 0,
                                        fertiliser_subtype: chem.fertiliser_subtype ?? null,
                                        active_ingredient: null,
                                        applicable_to: ['vineyard', 'arable', 'orchard'],
                                      }),
                                    });
                                    if (res.status === 409) {
                                      toast.info(`${chem.chemical_name} is already in the library`);
                                    } else if (!res.ok) {
                                      throw new Error('Failed to add chemical');
                                    } else {
                                      toast.success(`${chem.chemical_name} added to the chemical library`);
                                    }
                                    const updated = [...sprayChemicals];
                                    updated[idx] = { ...chem, library_matched: true };
                                    setSprayChemicals(updated);
                                  } catch {
                                    toast.error('Failed to add chemical to library');
                                  }
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                const updated = sprayChemicals.filter((_, i) => i !== idx);
                                setSprayChemicals(updated);
                                if (updated.length > 0) {
                                  updateForm(deriveSimplifiedFields(updated));
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {sprayChemicals.some((c) => !c.library_matched) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Some chemicals were not found in our library. Verify their classification and click <Plus className="h-3 w-3 inline" /> to save them for future use.
                    </p>
                  )}
                </div>
              )}

              <Separator />

              <p className="text-xs text-muted-foreground">
                {sprayChemicals.length > 0
                  ? 'The values below have been auto-populated from your spray diary. You can still adjust them manually.'
                  : 'Or enter your input data manually below.'}
              </p>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Fertiliser type</Label>
                  <Select
                    value={form.fertiliser_type}
                    onValueChange={(v) => updateForm({ fertiliser_type: v as FertiliserType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FERTILISER_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.fertiliser_type !== 'none' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="fert-qty">
                        Total quantity applied (kg/year)
                      </Label>
                      <Input
                        id="fert-qty"
                        type="number"
                        min="0"
                        value={form.fertiliser_quantity_kg || ''}
                        onChange={(e) =>
                          updateForm({ fertiliser_quantity_kg: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="e.g. 2000"
                      />
                      {form.fertiliser_quantity_kg > 0 && form.area_ha > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {(form.fertiliser_quantity_kg / form.area_ha).toFixed(0)} kg/ha
                          {form.fertiliser_type === 'synthetic_n' && form.fertiliser_quantity_kg / form.area_ha > 400 && (
                            <span className="text-amber-600 dark:text-amber-400 ml-1">
                              High for arable (typical: 100-250 kg N/ha)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="n-content" className="flex items-center gap-1">
                              Nitrogen content (%)
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs text-xs">
                              Ammonium nitrate: 34.5%. Urea: 46%. CAN: 27%. Manure: 0.5-1%. Compost: 1-2%.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Input
                        id="n-content"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={form.fertiliser_n_content_percent || ''}
                        onChange={(e) =>
                          updateForm({ fertiliser_n_content_percent: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="e.g. 34.5"
                      />
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Pesticides (fungicides, insecticides)</Label>
                      <p className="text-xs text-muted-foreground">
                        Includes fungicide treatments and insecticide applications
                      </p>
                    </div>
                    <Switch
                      checked={form.uses_pesticides}
                      onCheckedChange={(v) => updateForm({ uses_pesticides: v })}
                    />
                  </div>
                  {form.uses_pesticides && (
                    <div className="grid gap-3 pl-4">
                      <div className="grid gap-2">
                        <Label htmlFor="pest-apps">Applications per year</Label>
                        <Input
                          id="pest-apps"
                          type="number"
                          min="0"
                          max="30"
                          value={form.pesticide_applications_per_year || ''}
                          onChange={(e) =>
                            updateForm({ pesticide_applications_per_year: parseInt(e.target.value) || 0 })
                          }
                          placeholder="e.g. 4"
                          className="w-32"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Pesticide type</Label>
                        <Select
                          value={form.pesticide_type}
                          onValueChange={(v) => updateForm({ pesticide_type: v as ArablePesticideType })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PESTICIDE_TYPES.map((pt) => (
                              <SelectItem key={pt.value} value={pt.value}>
                                {pt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Herbicides</Label>
                      <p className="text-xs text-muted-foreground">
                        Chemical weed control (not applicable for organic)
                      </p>
                    </div>
                    <Switch
                      checked={form.uses_herbicides}
                      onCheckedChange={(v) => updateForm({ uses_herbicides: v })}
                    />
                  </div>
                  {form.uses_herbicides && (
                    <div className="grid gap-3 pl-4">
                      <div className="grid gap-2">
                        <Label htmlFor="herb-apps">Applications per year</Label>
                        <Input
                          id="herb-apps"
                          type="number"
                          min="0"
                          max="10"
                          value={form.herbicide_applications_per_year || ''}
                          onChange={(e) =>
                            updateForm({ herbicide_applications_per_year: parseInt(e.target.value) || 0 })
                          }
                          placeholder="e.g. 2"
                          className="w-32"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Herbicide type</Label>
                        <Select
                          value={form.herbicide_type}
                          onValueChange={(v) => updateForm({ herbicide_type: v as ArablePesticideType })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HERBICIDE_TYPES.map((ht) => (
                              <SelectItem key={ht.value} value={ht.value}>
                                {ht.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Growth regulators</Label>
                      <p className="text-xs text-muted-foreground">
                        Plant growth regulators (e.g. chlormequat) to reduce lodging
                      </p>
                    </div>
                    <Switch
                      checked={form.uses_growth_regulators}
                      onCheckedChange={(v) => updateForm({ uses_growth_regulators: v })}
                    />
                  </div>
                  {form.uses_growth_regulators && (
                    <div className="grid gap-3 pl-4">
                      <div className="grid gap-2">
                        <Label htmlFor="gr-apps">Applications per year</Label>
                        <Input
                          id="gr-apps"
                          type="number"
                          min="0"
                          max="10"
                          value={form.growth_regulator_applications || ''}
                          onChange={(e) =>
                            updateForm({ growth_regulator_applications: parseInt(e.target.value) || 0 })
                          }
                          placeholder="e.g. 2"
                          className="w-32"
                        />
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="grid gap-2 max-w-[300px]">
                    <Label htmlFor="seed-rate">Seed rate (kg/ha)</Label>
                    <Input
                      id="seed-rate"
                      type="number"
                      min="0"
                      value={form.seed_rate_kg_per_ha || ''}
                      onChange={(e) =>
                        updateForm({ seed_rate_kg_per_ha: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="e.g. 160"
                    />
                    <p className="text-xs text-muted-foreground">
                      Typical rates: barley 140-180 kg/ha, wheat 150-200 kg/ha.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Machinery & Fuel */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Machinery & Fuel</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Diesel consumption for tractors, combine harvesters, sprayers, and other field machinery.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="diesel">Diesel consumption (litres/year)</Label>
                    <Input
                      id="diesel"
                      type="number"
                      min="0"
                      value={form.diesel_litres_per_year || ''}
                      onChange={(e) =>
                        updateForm({ diesel_litres_per_year: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="e.g. 1500"
                    />
                    <p className="text-xs text-muted-foreground">
                      Total diesel for all field operations. Arable average: 80-150 L/ha/yr.
                    </p>
                    {form.diesel_litres_per_year > 0 && form.area_ha > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {(form.diesel_litres_per_year / form.area_ha).toFixed(0)} L/ha
                        {form.diesel_litres_per_year / form.area_ha > 300 && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">
                            Above 300 L/ha is unusually high
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="petrol">Petrol consumption (litres/year)</Label>
                    <Input
                      id="petrol"
                      type="number"
                      min="0"
                      value={form.petrol_litres_per_year || ''}
                      onChange={(e) =>
                        updateForm({ petrol_litres_per_year: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="e.g. 20"
                    />
                    <p className="text-xs text-muted-foreground">
                      ATVs, small equipment, etc. Typical: 5-20 L/ha/yr.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4">
                  <div>
                    <Label>Grain drying</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Energy used for drying grain post-harvest. Select "No drying required" if grain is sold or stored at harvest moisture.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Drying fuel type</Label>
                      <Select
                        value={form.grain_drying_fuel}
                        onValueChange={(v) => updateForm({ grain_drying_fuel: v as GrainDryingFuel })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(GRAIN_DRYING_FUEL_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.grain_drying_fuel !== 'none' && (
                      <div className="grid gap-2">
                        <Label htmlFor="drying-energy">Energy (kWh per tonne grain)</Label>
                        <Input
                          id="drying-energy"
                          type="number"
                          min="0"
                          value={form.grain_drying_energy_kwh_per_tonne || ''}
                          onChange={(e) =>
                            updateForm({ grain_drying_energy_kwh_per_tonne: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="e.g. 50"
                        />
                        <p className="text-xs text-muted-foreground">
                          UK typical: 30-80 kWh/t depending on initial moisture.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Irrigation */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Irrigation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Water use and pumping energy. Most UK arable crops are rainfed.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Field is irrigated</Label>
                    <p className="text-xs text-muted-foreground">
                      Toggle off if your field is entirely rainfed (most UK arable)
                    </p>
                  </div>
                  <Switch
                    checked={form.is_irrigated}
                    onCheckedChange={(v) => updateForm({ is_irrigated: v })}
                  />
                </div>

                {form.is_irrigated && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="water">Water applied (m3/ha/year)</Label>
                      <Input
                        id="water"
                        type="number"
                        min="0"
                        value={form.water_m3_per_ha || ''}
                        onChange={(e) =>
                          updateForm({ water_m3_per_ha: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="e.g. 100"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Pumping energy source</Label>
                      <Select
                        value={form.irrigation_energy_source}
                        onValueChange={(v) =>
                          updateForm({ irrigation_energy_source: v as IrrigationEnergySource })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grid_electricity">Grid electricity</SelectItem>
                          <SelectItem value="diesel_pump">Diesel pump</SelectItem>
                          <SelectItem value="solar_pump">Solar pump</SelectItem>
                          <SelectItem value="gravity_fed">Gravity fed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Transport & Yield */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Transport & Yield</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Transport from field to processing facility and annual grain yield.
                </p>
              </div>

              <div className="grid gap-4">
                {/* Yield section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="grain-yield">Grain yield (tonnes) *</Label>
                    <Input
                      id="grain-yield"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={form.grain_yield_tonnes || ''}
                      onChange={(e) => updateForm({ grain_yield_tonnes: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Total harvest from this area. UK barley average: 6-8 t/ha, wheat: 7-9 t/ha.
                    </p>
                    {form.grain_yield_tonnes > 0 && form.area_ha > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Calculated yield: {(form.grain_yield_tonnes / form.area_ha).toFixed(1)} t/ha
                        </p>
                        {form.grain_yield_tonnes / form.area_ha > 15 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Yield above 15 t/ha is unusually high. Please check your figures.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="moisture">Grain moisture (%)</Label>
                    <Input
                      id="moisture"
                      type="number"
                      step="0.1"
                      min="0"
                      max="30"
                      value={form.grain_moisture_percent || ''}
                      onChange={(e) => updateForm({ grain_moisture_percent: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 14.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Standard trading moisture: barley 14.5%, wheat 14.5%.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Transport section */}
                <div className="grid gap-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Transport to processing facility
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Distance from field to the facility where the grain is processed (e.g. maltings, distillery, mill).
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="transport-distance">Distance (km)</Label>
                      <Input
                        id="transport-distance"
                        type="number"
                        min="0"
                        value={form.transport_distance_km ?? ''}
                        onChange={(e) =>
                          updateForm({
                            transport_distance_km: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                        placeholder="e.g. 40"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Transport mode</Label>
                      <Select
                        value={form.transport_mode}
                        onValueChange={(v) =>
                          updateForm({ transport_mode: v as TransportMode })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="road">Road (HGV)</SelectItem>
                          <SelectItem value="rail">Rail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Impact Preview */}
              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-3">Impact Preview</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Total emissions</div>
                    <div className="text-lg font-bold text-foreground">
                      {previewResult.total_emissions.toFixed(1)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">kg CO2e/year</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {previewResult.total_emissions_per_kg.toFixed(3)} kg CO2e per kg grain
                    </div>
                  </div>
                  {previewResult.total_removals > 0 && (
                    <div className="rounded-lg border border-green-800/30 bg-green-950/20 p-3">
                      <div className="text-xs text-green-400/70 flex items-center gap-1">
                        Soil carbon removals
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">
                                Under SBTi FLAG guidance, carbon removals from soil management
                                are reported separately from emissions and cannot be netted
                                against your total footprint.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-lg font-bold text-green-400">
                        {previewResult.total_removals.toFixed(1)}
                        <span className="text-xs font-normal text-green-400/70 ml-1">kg CO2e removed/year</span>
                      </div>
                      <div className="text-xs text-green-400/50 mt-1">
                        {previewResult.flag_removals.methodology === 'practice_based_default'
                          ? 'Practice-based estimate'
                          : 'Verified measurement'}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Fertiliser & N2O</div>
                    <div className="text-sm font-medium">
                      {(previewResult.flag_emissions.total_flag_co2e + previewResult.non_flag_emissions.fertiliser_production_co2e).toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Fuel</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.machinery_fuel_co2e.toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Grain Drying</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.grain_drying_co2e.toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Seed</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.seed_production_co2e.toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Transport</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.transport_co2e.toFixed(0)} kg
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 0) onCancel();
            else setCurrentStep(currentStep - 1);
          }}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Save &amp; Finalise
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
