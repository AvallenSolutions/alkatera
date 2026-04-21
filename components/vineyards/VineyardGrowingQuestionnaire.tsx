'use client';

import { useState, useEffect, useRef } from 'react';
import { useAwareFactor } from '@/hooks/data/useAwareFactor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Leaf,
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
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIngestStash } from '@/hooks/useIngestStash';
import { calculateViticultureImpacts } from '@/lib/viticulture-calculator';
import { SOIL_CARBON_REMOVAL_DEFAULTS } from '@/lib/ghg-constants';
import type {
  VineyardGrowingProfile,
  VineyardSoilCarbonEvidence,
  SoilManagement,
  SoilCarbonMethodology,
  FertiliserType,
  PesticideType,
  IrrigationEnergySource,
  ViticultureCalculatorInput,
  VineyardClimateZone,
  VineyardCertification,
  PreviousLandUseType,
  ChemicalType,
  SprayChemicalDraft,
} from '@/lib/types/viticulture';

const CHEMICAL_TYPE_OPTIONS: { value: ChemicalType; label: string }[] = [
  { value: 'fertiliser', label: 'Fertiliser' },
  { value: 'fungicide', label: 'Fungicide' },
  { value: 'herbicide', label: 'Herbicide' },
  { value: 'insecticide', label: 'Insecticide' },
  { value: 'other', label: 'Other' },
];

function chemicalTypeBadgeClass(type: ChemicalType): string {
  switch (type) {
    case 'fertiliser': return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'fungicide': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'herbicide': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'insecticide': return 'bg-red-500/10 text-red-400 border-red-500/20';
    default: return 'bg-muted/50 text-muted-foreground border-border';
  }
}

interface QuestionnaireProps {
  vineyardId: string;
  vineyardName: string;
  vineyardHectares: number;
  vineyardClimateZone: VineyardClimateZone;
  vineyardCertification: VineyardCertification;
  vineyardCountryCode: string | null;
  vineyardPreviousLandUse?: PreviousLandUseType | null;
  vineyardLandConversionYear?: number | null;
  vineyardPlantingYear?: number | null;
  existingProfile?: VineyardGrowingProfile | null;
  vintageYear?: number;
  copyFromData?: Record<string, any>;
  onComplete: (profile: VineyardGrowingProfile) => void;
  onCancel: () => void;
}

const PREVIOUS_LAND_USE_OPTIONS: { value: PreviousLandUseType; label: string }[] = [
  { value: 'permanent_vineyard', label: 'Already a vineyard (no land use change)' },
  { value: 'grassland', label: 'Grassland / pasture' },
  { value: 'arable', label: 'Arable cropland' },
  { value: 'forest', label: 'Forest / woodland' },
  { value: 'wetland', label: 'Wetland' },
  { value: 'settlement', label: 'Settlement / urban land' },
  { value: 'other_land', label: 'Other land' },
];

const PESTICIDE_TYPES: { value: PesticideType; label: string }[] = [
  { value: 'generic', label: 'Generic / mixed products' },
  { value: 'copper_fungicide', label: 'Copper-based fungicide (e.g. Bordeaux mixture)' },
  { value: 'sulfur', label: 'Sulphur-based' },
  { value: 'synthetic_fungicide', label: 'Synthetic fungicide' },
];

const HERBICIDE_TYPES: { value: PesticideType; label: string }[] = [
  { value: 'generic', label: 'Generic herbicide' },
  { value: 'herbicide_glyphosate', label: 'Glyphosate-based' },
];

const STEPS = [
  { id: 'soil', label: 'Soil & Land', icon: Sprout },
  { id: 'inputs', label: 'Inputs', icon: Leaf },
  { id: 'machinery', label: 'Machinery & Fuel', icon: Fuel },
  { id: 'irrigation', label: 'Irrigation', icon: Droplets },
] as const;

const SOIL_PRACTICES: { value: SoilManagement; label: string; description: string }[] = [
  { value: 'conventional_tillage', label: 'Conventional tillage', description: 'Regular ploughing and mechanical soil disturbance' },
  { value: 'minimum_tillage', label: 'Minimum tillage', description: 'Reduced soil disturbance, shallow cultivation only' },
  { value: 'no_till', label: 'No-till', description: 'No mechanical soil disturbance, direct seeding' },
  { value: 'cover_cropping', label: 'Cover cropping (active)', description: 'Living ground cover between vine rows year-round' },
  { value: 'composting', label: 'Composting (active)', description: 'Regular compost application to vineyard soils' },
  { value: 'biochar_compost', label: 'Biochar + compost', description: 'Biochar-amended compost for enhanced carbon storage' },
  { value: 'regenerative_integrated', label: 'Regenerative integrated', description: 'Holistic approach combining cover crops, no-till, and organic inputs' },
];

const SOIL_CARBON_METHODOLOGIES: { value: SoilCarbonMethodology; label: string; description: string }[] = [
  { value: 'soc_0_30cm_fixed', label: 'SOC sampling 0-30 cm, fixed depth', description: 'IPCC minimum depth. Single composite sample per point.' },
  { value: 'soc_0_30cm_multi_increment', label: 'SOC sampling 0-30 cm, multi-increment', description: 'IPCC recommended: 0-10, 10-20, 20-30 cm increments.' },
  { value: 'soc_0_60cm_fixed', label: 'SOC sampling 0-60 cm, fixed depth', description: 'Verra/IWCA best practice depth. Single composite per point.' },
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

export function VineyardGrowingQuestionnaire({
  vineyardId,
  vineyardName,
  vineyardHectares,
  vineyardClimateZone,
  vineyardCertification,
  vineyardCountryCode,
  vineyardPreviousLandUse,
  vineyardLandConversionYear,
  vineyardPlantingYear,
  existingProfile,
  vintageYear,
  copyFromData,
  onComplete,
  onCancel,
}: QuestionnaireProps) {
  const { awareFactor: vineyardAwareFactor } = useAwareFactor(vineyardCountryCode);
  const currentYear = new Date().getFullYear();
  const [selectedVintageYear, setSelectedVintageYear] = useState<number>(
    existingProfile?.vintage_year ?? vintageYear ?? currentYear
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Determine initial values: existingProfile > copyFromData > defaults
  const initSource = existingProfile ?? copyFromData;

  // Form state
  const [form, setForm] = useState({
    area_ha: initSource?.area_ha ?? vineyardHectares,
    soil_management: (initSource?.soil_management ?? 'conventional_tillage') as SoilManagement,
    pruning_residue_returned: initSource?.pruning_residue_returned ?? true,
    pruning_residue_management_type: (initSource as any)?.pruning_residue_management_type ?? 'in_field' as 'in_field' | 'removed_for_biomass' | 'chipped_and_spread',
    pruning_residue_measured_kg_per_ha: (initSource as any)?.pruning_residue_measured_kg_per_ha ?? null as number | null,
    fertiliser_type: (initSource?.fertiliser_type ?? 'none') as FertiliserType,
    fertiliser_quantity_kg: initSource?.fertiliser_quantity_kg ?? 0,
    fertiliser_n_content_percent: initSource?.fertiliser_n_content_percent ?? 0,
    uses_pesticides: initSource?.uses_pesticides ?? false,
    pesticide_applications_per_year: initSource?.pesticide_applications_per_year ?? 0,
    pesticide_type: (initSource?.pesticide_type ?? 'generic') as PesticideType,
    uses_herbicides: initSource?.uses_herbicides ?? false,
    herbicide_applications_per_year: initSource?.herbicide_applications_per_year ?? 0,
    herbicide_type: (initSource?.herbicide_type ?? 'generic') as PesticideType,
    diesel_litres_per_year: initSource?.diesel_litres_per_year ?? 0,
    petrol_litres_per_year: initSource?.petrol_litres_per_year ?? 0,
    is_irrigated: initSource?.is_irrigated ?? false,
    water_m3_per_ha: initSource?.water_m3_per_ha ?? 0,
    irrigation_energy_source: (initSource?.irrigation_energy_source ?? 'none') as IrrigationEnergySource,
    grape_yield_tonnes: initSource?.grape_yield_tonnes ?? 0,
    // Land use change (FLAG-C3) - stored on vineyard, not growing profile
    previous_land_use_type: (vineyardPreviousLandUse ?? 'permanent_vineyard') as PreviousLandUseType,
    land_conversion_year: vineyardLandConversionYear ?? null as number | null,
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
  const [existingEvidence, setExistingEvidence] = useState<VineyardSoilCarbonEvidence[]>([]);

  // Load existing evidence when editing a profile
  useEffect(() => {
    if (!existingProfile?.id) return;
    fetch(`/api/vineyards/${vineyardId}/growing-profile/evidence?profile_id=${existingProfile.id}`)
      .then((res) => res.json())
      .then(({ data }) => { if (data) setExistingEvidence(data); })
      .catch(() => { /* silently fail - evidence is optional */ });
  }, [existingProfile?.id, vineyardId]);

  // Spray chemicals state
  const [sprayChemicals, setSprayChemicals] = useState<SprayChemicalDraft[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const sprayFileInputRef = useRef<HTMLInputElement>(null);

  // Load existing chemicals when editing a profile
  useEffect(() => {
    if (!existingProfile?.id) return;
    fetch(`/api/vineyards/${vineyardId}/spray-chemicals?growing_profile_id=${existingProfile.id}`)
      .then((res) => res.json())
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSprayChemicals(
            data.map((c: any) => ({
              chemical_name: c.chemical_name,
              chemical_type: c.chemical_type,
              unit: c.unit,
              rate_per_ha: c.rate_per_ha,
              water_rate_l_per_ha: c.water_rate_l_per_ha,
              total_ha_sprayed: c.total_ha_sprayed,
              total_amount_used: c.total_amount_used,
              applications_count: c.applications_count,
              n_content_percent: (c as any).n_content_percent ?? 0,
              fertiliser_subtype: (c as any).fertiliser_subtype ?? null,
              library_matched: (c as any).library_matched ?? false,
            }))
          );
        }
      })
      .catch(() => { /* silently fail */ });
  }, [existingProfile?.id, vineyardId]);

  function deriveSimplifiedFields(chemicals: SprayChemicalDraft[]) {
    const fertilisers = chemicals.filter((c) => c.chemical_type === 'fertiliser');
    const pesticides = chemicals.filter((c) => c.chemical_type === 'fungicide' || c.chemical_type === 'insecticide');
    const herbicides = chemicals.filter((c) => c.chemical_type === 'herbicide');

    // Total product quantity for all fertilisers
    const fertiliser_quantity_kg = fertilisers.reduce((sum, c) => sum + (c.total_amount_used || 0), 0);

    // Weighted-average N content: sum(qty × n%) / total_qty
    const fertiliser_n_content_percent =
      fertiliser_quantity_kg > 0
        ? fertilisers.reduce((sum, c) => sum + (c.total_amount_used || 0) * (c.n_content_percent || 0), 0) /
          fertiliser_quantity_kg
        : 0;

    // Derive fertiliser type from subtypes
    let fertiliser_type: FertiliserType = 'none';
    if (fertilisers.length > 0) {
      const subtypes = new Set(
        fertilisers.map((c) => c.fertiliser_subtype).filter((s): s is NonNullable<typeof s> => s !== null && s !== undefined)
      );
      const hasSyntheticN = subtypes.has('synthetic_n');
      const hasOrganic = subtypes.has('organic_compost') || subtypes.has('organic_manure');
      const hasManure = subtypes.has('organic_manure');
      if (hasSyntheticN && hasOrganic) {
        fertiliser_type = 'mixed';
      } else if (hasSyntheticN) {
        fertiliser_type = 'synthetic_n';
      } else if (hasManure) {
        fertiliser_type = 'organic_manure';
      } else if (hasOrganic) {
        fertiliser_type = 'organic_compost';
      } else {
        // Fertilisers present but all zero-N or unmatched (e.g. calcium, iron products)
        fertiliser_type = 'mixed';
      }
    }

    return {
      fertiliser_type,
      fertiliser_quantity_kg,
      fertiliser_n_content_percent,
      uses_pesticides: pesticides.length > 0,
      pesticide_applications_per_year: pesticides.reduce((s, c) => s + (c.applications_count || 0), 0),
      pesticide_type: 'generic' as PesticideType,
      uses_herbicides: herbicides.length > 0,
      herbicide_applications_per_year: herbicides.reduce((s, c) => s + (c.applications_count || 0), 0),
      herbicide_type: 'generic' as PesticideType,
    };
  }

  function addEmptyChemical() {
    setSprayChemicals((prev) => [
      ...prev,
      {
        chemical_name: '',
        chemical_type: 'fungicide',
        unit: 'L',
        rate_per_ha: 0,
        water_rate_l_per_ha: null,
        total_ha_sprayed: 0,
        total_amount_used: 0,
        applications_count: 1,
        n_content_percent: 0,
        fertiliser_subtype: null,
        library_matched: false,
      },
    ]);
  }

  function updateChemical(index: number, updates: Partial<SprayChemicalDraft>) {
    setSprayChemicals((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  }

  function removeChemical(index: number) {
    setSprayChemicals((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSprayImport(file: File) {
    setIsImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/vineyards/${vineyardId}/spray-import`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      const { chemicals } = await res.json();
      setSprayChemicals(chemicals);
      // Derive simplified fields immediately so calculator stays live
      updateForm(deriveSimplifiedFields(chemicals));
      toast.success(`${chemicals.length} chemical${chemicals.length !== 1 ? 's' : ''} imported`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to import spray diary');
    } finally {
      setIsImporting(false);
    }
  }

  // Pick up files stashed by the Universal Dropzone (header upload button).
  useIngestStash('spray', handleSprayImport);
  useIngestStash('evidence', (file) => {
    setEvidenceFile(file);
    toast.info('Evidence ready to upload — complete the questionnaire and click Save to attach it.');
  });

  // Build vintage year options (current year down to current-10)
  const vintageYearOptions = Array.from({ length: 11 }, (_, i) => currentYear - i);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  function updateForm(updates: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  async function handleSave(asDraft: boolean) {
    // Full validation only when finalising
    if (!asDraft) {
      if (form.grape_yield_tonnes <= 0) {
        toast.error('Please enter the annual grape yield (tonnes) to finalise');
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
      const url = `/api/vineyards/${vineyardId}/growing-profile`;
      const method = existingProfile ? 'PATCH' : 'POST';

      const body = {
        ...(existingProfile ? { id: existingProfile.id } : {}),
        vintage_year: selectedVintageYear,
        area_ha: form.area_ha,
        soil_management: form.soil_management,
        pruning_residue_returned: form.pruning_residue_management_type !== 'removed_for_biomass',
        pruning_residue_management_type: form.pruning_residue_management_type,
        pruning_residue_measured_kg_per_ha: form.pruning_residue_measured_kg_per_ha,
        fertiliser_type: form.fertiliser_type,
        fertiliser_quantity_kg: form.fertiliser_quantity_kg,
        fertiliser_n_content_percent: form.fertiliser_n_content_percent,
        uses_pesticides: form.uses_pesticides,
        pesticide_applications_per_year: form.pesticide_applications_per_year,
        pesticide_type: form.pesticide_type,
        uses_herbicides: form.uses_herbicides,
        herbicide_applications_per_year: form.herbicide_applications_per_year,
        herbicide_type: form.herbicide_type,
        diesel_litres_per_year: form.diesel_litres_per_year,
        petrol_litres_per_year: form.petrol_litres_per_year,
        is_irrigated: form.is_irrigated,
        water_m3_per_ha: form.water_m3_per_ha,
        irrigation_energy_source: form.irrigation_energy_source,
        grape_yield_tonnes: form.grape_yield_tonnes,
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

      // Save LUC fields to the vineyard record (not the growing profile)
      const lucChanged =
        form.previous_land_use_type !== (vineyardPreviousLandUse ?? 'permanent_vineyard') ||
        form.land_conversion_year !== vineyardLandConversionYear;
      if (lucChanged) {
        await fetch(`/api/vineyards/${vineyardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            previous_land_use_type: form.previous_land_use_type === 'permanent_vineyard'
              ? null
              : form.previous_land_use_type,
            land_conversion_year: form.previous_land_use_type === 'permanent_vineyard'
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

      // Save spray chemicals if any
      if (sprayChemicals.length > 0 && data?.id) {
        try {
          await fetch(`/api/vineyards/${vineyardId}/spray-chemicals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ growing_profile_id: data.id, chemicals: sprayChemicals }),
          });
        } catch {
          toast.error('Profile saved but chemical data could not be saved. You can re-import later.');
        }
      }

      // Upload evidence file if pending
      if (evidenceFile && data?.id) {
        setEvidenceUploading(true);
        try {
          const evidenceFormData = new FormData();
          evidenceFormData.append('file', evidenceFile);
          evidenceFormData.append('profile_id', data.id);

          const evidenceRes = await fetch(
            `/api/vineyards/${vineyardId}/growing-profile/evidence`,
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

      toast.success(asDraft ? 'Draft saved' : 'Growing profile saved');
      onComplete(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Preview calculation
  const previewResult = calculateViticultureImpacts({
    climate_zone: vineyardClimateZone,
    certification: vineyardCertification,
    location_country_code: vineyardCountryCode,
    aware_factor: vineyardAwareFactor,
    area_ha: form.area_ha,
    soil_management: form.soil_management,
    pruning_residue_returned: form.pruning_residue_management_type !== 'removed_for_biomass',
    pruning_residue_management_type: form.pruning_residue_management_type,
    pruning_residue_measured_kg_per_ha: form.pruning_residue_measured_kg_per_ha ?? undefined,
    fertiliser_type: form.fertiliser_type,
    fertiliser_quantity_kg: form.fertiliser_quantity_kg,
    fertiliser_n_content_percent: form.fertiliser_n_content_percent,
    uses_pesticides: form.uses_pesticides,
    pesticide_applications_per_year: form.pesticide_applications_per_year,
    pesticide_type: form.pesticide_type,
    uses_herbicides: form.uses_herbicides,
    herbicide_applications_per_year: form.herbicide_applications_per_year,
    herbicide_type: form.herbicide_type,
    diesel_litres_per_year: form.diesel_litres_per_year,
    petrol_litres_per_year: form.petrol_litres_per_year,
    is_irrigated: form.is_irrigated,
    water_m3_per_ha: form.water_m3_per_ha,
    irrigation_energy_source: form.irrigation_energy_source,
    grape_yield_tonnes: form.grape_yield_tonnes,
    soil_carbon_override_kg_co2e_per_ha: form.has_measured_soil_carbon
      ? form.soil_carbon_override_kg_co2e_per_ha
      : null,
    previous_land_use_type: form.previous_land_use_type,
    land_conversion_year: form.land_conversion_year,
    vintage_year: selectedVintageYear,
    vine_age: vineyardPlantingYear != null && selectedVintageYear != null
      ? selectedVintageYear - vineyardPlantingYear
      : null,
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
      {/* Vintage Year Selector */}
      <div className="flex items-center gap-3">
        <Label htmlFor="vintage-year" className="text-sm font-medium whitespace-nowrap">Vintage Year</Label>
        <Select
          value={String(selectedVintageYear)}
          onValueChange={(v) => setSelectedVintageYear(parseInt(v))}
        >
          <SelectTrigger id="vintage-year" className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vintageYearOptions.map((yr) => (
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
            Grape growing questionnaire for <span className="text-foreground font-medium">{vineyardName}</span>
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
                  How you manage your vineyard soils affects carbon sequestration and N2O emissions.
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
                      Vineyard total: {vineyardHectares} ha. Enter the area used for this product.
                    </p>
                    {form.area_ha > vineyardHectares && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠ Area exceeds vineyard total ({vineyardHectares} ha)
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="yield">Annual grape yield (tonnes) *</Label>
                    <Input
                      id="yield"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={form.grape_yield_tonnes || ''}
                      onChange={(e) => updateForm({ grape_yield_tonnes: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Total harvest from this area. UK average: 5-8 t/ha, warm climate: 8-15 t/ha.
                    </p>
                    {form.grape_yield_tonnes > 0 && form.area_ha > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Calculated yield: {(form.grape_yield_tonnes / form.area_ha).toFixed(1)} t/ha
                        </p>
                        {form.grape_yield_tonnes / form.area_ha > 25 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ Yield above 25 t/ha is unusually high. Please check your figures.
                          </p>
                        )}
                        {form.grape_yield_tonnes / form.area_ha < 1 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ Yield below 1 t/ha is very low. Is this a newly planted vineyard?
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

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

                <Separator />

                <div className="grid gap-2">
                  <Label>Pruning residue management</Label>
                  <p className="text-xs text-muted-foreground">
                    How vine prunings are managed after pruning. This affects the N2O calculation.
                  </p>
                  <Select
                    value={form.pruning_residue_management_type}
                    onValueChange={(v) => updateForm({
                      pruning_residue_management_type: v as 'in_field' | 'removed_for_biomass' | 'chipped_and_spread',
                      pruning_residue_returned: v !== 'removed_for_biomass',
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_field">Left in field to decompose (default)</SelectItem>
                      <SelectItem value="removed_for_biomass">Removed for biomass / off-site use</SelectItem>
                      <SelectItem value="chipped_and_spread">Chipped and spread back onto soil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.pruning_residue_management_type !== 'removed_for_biomass' && (
                  <div className="grid gap-2 max-w-[300px]">
                    <Label htmlFor="pruning-dm">Measured pruning dry matter (kg/ha/yr)</Label>
                    <p className="text-xs text-muted-foreground">
                      Optional. If you have measured data, enter it here. This improves data quality from secondary to primary.
                    </p>
                    <Input
                      id="pruning-dm"
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.pruning_residue_measured_kg_per_ha ?? ''}
                      onChange={(e) =>
                        updateForm({
                          pruning_residue_measured_kg_per_ha: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="e.g. 2500"
                    />
                  </div>
                )}

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
                        Select the dominant ecosystem type at your vineyard's location. This is used for TNFD nature impact disclosure.
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
                            placeholder="e.g. South Downs National Park"
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
                      What was this land used for before it became a vineyard?
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

                  {form.previous_land_use_type !== 'permanent_vineyard' && (
                    <div className="grid gap-2 max-w-[200px]">
                      <Label htmlFor="conversion-year">Year of conversion to vineyard</Label>
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
                        removal (WineGB/OIV conservative estimate).
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
                          {form.soil_carbon_override_kg_co2e_per_ha != null &&
                            form.soil_carbon_override_kg_co2e_per_ha > 0 &&
                            (SOIL_CARBON_REMOVAL_DEFAULTS[form.soil_management] ?? 0) > 0 &&
                            form.soil_carbon_override_kg_co2e_per_ha > (SOIL_CARBON_REMOVAL_DEFAULTS[form.soil_management] ?? 0) * 3 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Significantly above the practice-based estimate.
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

                      {/* Row 3: Sampling points (optional) */}
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

                        {/* Existing evidence files */}
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
                                    `/api/vineyards/${vineyardId}/growing-profile/evidence?evidence_id=${doc.id}`,
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

                        {/* Pending upload indicator */}
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

                        {/* File input */}
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
                <h3 className="font-semibold text-lg">Chemical Inputs</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Import your spray diary or add chemicals manually to record all inputs for this vintage.
                </p>
              </div>

              {/* Import panel */}
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Import spray diary</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Accepts any Excel format — spray schedule, application diary, field records.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sprayFileInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analysing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import xlsx
                      </>
                    )}
                  </Button>
                  <input
                    ref={sprayFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSprayImport(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {/* Chemicals table */}
              {sprayChemicals.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{sprayChemicals.length} chemical{sprayChemicals.length !== 1 ? 's' : ''} recorded</p>
                  </div>

                  {/* Table header */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-[2fr_1fr_0.7fr_1fr_1fr_1fr_68px] gap-x-2 px-3 py-2 bg-muted/30 text-xs text-muted-foreground font-medium">
                      <span>Chemical</span>
                      <span>Type</span>
                      <span>N %</span>
                      <span>Rate / ha</span>
                      <span>Total ha</span>
                      <span>Total used</span>
                      <span></span>
                    </div>

                    {sprayChemicals.map((chem, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[2fr_1fr_0.7fr_1fr_1fr_1fr_68px] gap-x-2 px-3 py-2 border-t border-border items-center text-sm"
                      >
                        {/* Chemical name */}
                        <Input
                          value={chem.chemical_name}
                          onChange={(e) => updateChemical(idx, { chemical_name: e.target.value })}
                          className="h-7 text-xs px-2"
                          placeholder="Product name"
                        />

                        {/* Type */}
                        <Select
                          value={chem.chemical_type}
                          onValueChange={(v) => updateChemical(idx, { chemical_type: v as ChemicalType })}
                        >
                          <SelectTrigger className="h-7 text-xs px-2">
                            <SelectValue>
                              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${chemicalTypeBadgeClass(chem.chemical_type)}`}>
                                {CHEMICAL_TYPE_OPTIONS.find((o) => o.value === chem.chemical_type)?.label ?? chem.chemical_type}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {CHEMICAL_TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${chemicalTypeBadgeClass(o.value)}`}>
                                  {o.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* N content % — editable for fertilisers, locked for others */}
                        <div className="flex items-center gap-0.5">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={chem.chemical_type === 'fertiliser' ? (chem.n_content_percent ?? '') : ''}
                            onChange={(e) =>
                              updateChemical(idx, { n_content_percent: parseFloat(e.target.value) || 0 })
                            }
                            disabled={chem.chemical_type !== 'fertiliser'}
                            className="h-7 text-xs px-2 w-14"
                            placeholder={chem.chemical_type === 'fertiliser' ? '0' : '—'}
                          />
                          {chem.chemical_type === 'fertiliser' && chem.library_matched && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="text-green-400 text-xs leading-none">✓</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Matched from chemical library</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        {/* Rate/ha + unit */}
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={chem.rate_per_ha || ''}
                            onChange={(e) => updateChemical(idx, { rate_per_ha: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs px-2 w-16"
                            placeholder="0"
                          />
                          <Input
                            value={chem.unit}
                            onChange={(e) => updateChemical(idx, { unit: e.target.value })}
                            className="h-7 text-xs px-2 w-12"
                            placeholder="L"
                          />
                        </div>

                        {/* Total ha */}
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={chem.total_ha_sprayed || ''}
                          onChange={(e) => {
                            const ha = parseFloat(e.target.value) || 0;
                            updateChemical(idx, {
                              total_ha_sprayed: ha,
                              total_amount_used: parseFloat((chem.rate_per_ha * ha).toFixed(4)),
                            });
                          }}
                          className="h-7 text-xs px-2"
                          placeholder="ha"
                        />

                        {/* Total used */}
                        <div className="text-xs text-muted-foreground">
                          {chem.total_amount_used > 0
                            ? `${chem.total_amount_used.toFixed(1)} ${chem.unit}`
                            : '-'}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5">
                          {!chem.library_matched && (
                            <button
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
                              className="text-muted-foreground hover:text-green-600 transition-colors p-1 rounded"
                              title="Add to chemical library"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => removeChemical(idx)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Unmatched warning */}
                  {sprayChemicals.some((c) => !c.library_matched) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 px-1">
                      <AlertTriangle className="h-3 w-3" />
                      Some chemicals were not found in our library. Verify their classification and click <Plus className="h-3 w-3 inline" /> to save them for future use.
                    </p>
                  )}

                  {/* Summary row */}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
                    {(['fertiliser', 'fungicide', 'herbicide', 'insecticide'] as ChemicalType[]).map((type) => {
                      const count = sprayChemicals.filter((c) => c.chemical_type === type).length;
                      if (count === 0) return null;
                      return (
                        <span key={type} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium ${chemicalTypeBadgeClass(type)}`}>
                          {count} {type}{count !== 1 ? 's' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add manually */}
              <Button variant="outline" size="sm" onClick={addEmptyChemical} className="w-full">
                + Add chemical manually
              </Button>

            </div>
          )}

          {/* Step 3: Machinery & Fuel */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Machinery & Fuel</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Diesel consumption for tractors, sprayers, and harvesting equipment.
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
                      placeholder="e.g. 500"
                    />
                    <p className="text-xs text-muted-foreground">
                      Total diesel for all vineyard operations. Sector average: 80-150 L/ha/yr.
                    </p>
                    {form.diesel_litres_per_year > 0 && form.area_ha > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {(form.diesel_litres_per_year / form.area_ha).toFixed(0)} L/ha
                        {form.diesel_litres_per_year / form.area_ha > 300 && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">
                            ⚠ Above 300 L/ha is unusually high
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
                      placeholder="e.g. 50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Strimmers, chainsaws, ATVs, etc. Typical: 10-30 L/ha/yr.
                    </p>
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
                  Water use and pumping energy for irrigation. Most UK vineyards are rainfed.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Vineyard is irrigated</Label>
                    <p className="text-xs text-muted-foreground">
                      Toggle off if your vineyard is entirely rainfed
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
                        placeholder="e.g. 200"
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
                      {previewResult.total_emissions_per_kg.toFixed(3)} kg CO2e per kg grapes
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
                <div className="grid grid-cols-4 gap-2 mt-2">
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
                    <div className="text-xs text-muted-foreground">Pesticides</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.pesticide_production_co2e.toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Irrigation</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.irrigation_energy_co2e.toFixed(0)} kg
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
          <Button
            onClick={() => {
              if (currentStep === 1 && sprayChemicals.length > 0) {
                // Derive simplified fields from spray chemicals before advancing
                updateForm(deriveSimplifiedFields(sprayChemicals));
              }
              setCurrentStep(currentStep + 1);
            }}
          >
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
