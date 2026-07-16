"use client";

// Guided packaging builder: a question-led alternative to the flat packaging
// form. "Does your product come in a can or bottle? What is it made of?
// What does it weigh?" Each answer maps deterministically (via
// lib/constants/packaging-catalogue.ts) to packaging role, material identity
// for end-of-life factors, an auto-matched emission factor, typical-weight
// pre-fills and circularity defaults. No free-text material names, so none
// of the keyword-inference failure modes apply to rows built here.

import { useMemo, useState } from "react";
import { WizardContainer, WizardStep } from "@/components/wizards/WizardContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Package,
  CupSoda,
  Container as ContainerIcon,
  Box,
  Milk,
  Wine,
  ShoppingBag,
  Tag,
  Grip,
  CheckCircle2,
  Scale,
} from "lucide-react";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";
import {
  CONTAINER_FORMATS,
  CLOSURE_OPTIONS,
  LABEL_OPTIONS,
  MULTIPACK_OPTIONS,
  accessoryOptionsForFormat,
  containerDisplayName,
  getFormat,
  getMaterial,
  getTypicalWeight,
  type AccessoryOption,
} from "@/lib/constants/packaging-catalogue";
import { autoMatchEmissionFactor } from "@/lib/products/ef-auto-match";
import { makePackagingRow, applyPackagingDefaults } from "@/lib/products/packaging-row-builder";

const FORMAT_ICONS: Record<string, typeof Package> = {
  bottle: Wine,
  can: CupSoda,
  keg: ContainerIcon,
  carton: Milk,
  pouch: ShoppingBag,
  bag_in_box: Box,
};

interface PackagingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  /** Product unit size in ml, used to preselect the container size */
  containerSizeMl?: number | null;
  /** Receives the finished rows; the caller merges them into the form state */
  onComplete: (rows: PackagingFormData[]) => void;
}

// Row construction (makeRow/applyDefaults) lives in
// lib/products/packaging-row-builder.ts so PackagingComposer's one-line add
// builds rows the identical way — see makePackagingRow/applyPackagingDefaults.

export function PackagingWizard({
  open,
  onOpenChange,
  organizationId,
  containerSizeMl,
  onComplete,
}: PackagingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  // Answers
  const [formatKey, setFormatKey] = useState<string | null>(null);
  const [materialKey, setMaterialKey] = useState<string | null>(null);
  const [sizeMl, setSizeMl] = useState<number | null>(containerSizeMl ?? null);
  const [customSize, setCustomSize] = useState('');
  const [weightG, setWeightG] = useState('');
  const [weightTouched, setWeightTouched] = useState(false);
  const [closureKey, setClosureKey] = useState<string | null>(null); // 'none' or option key
  const [closureWeightG, setClosureWeightG] = useState('');
  const [labelKey, setLabelKey] = useState<string | null>(null);
  const [labelWeightG, setLabelWeightG] = useState('');
  const [multipackKey, setMultipackKey] = useState<string | null>(null);
  const [unitsPerPack, setUnitsPerPack] = useState('');
  const [multipackWeightG, setMultipackWeightG] = useState('');

  const format = getFormat(formatKey);
  const material = getMaterial(formatKey, materialKey);
  const typicalWeight = useMemo(() => getTypicalWeight(material, sizeMl), [material, sizeMl]);

  const closureChoices = format ? accessoryOptionsForFormat(CLOSURE_OPTIONS, format.key) : [];
  const labelChoices = format ? accessoryOptionsForFormat(LABEL_OPTIONS, format.key) : [];
  const closure = closureChoices.find((o) => o.key === closureKey) ?? null;
  const labelOption = labelChoices.find((o) => o.key === labelKey) ?? null;
  const multipack = MULTIPACK_OPTIONS.find((o) => o.key === multipackKey) ?? null;

  const reset = () => {
    setCurrentStep(0);
    setFormatKey(null);
    setMaterialKey(null);
    setSizeMl(containerSizeMl ?? null);
    setCustomSize('');
    setWeightG('');
    setWeightTouched(false);
    setClosureKey(null);
    setClosureWeightG('');
    setLabelKey(null);
    setLabelWeightG('');
    setMultipackKey(null);
    setUnitsPerPack('');
    setMultipackWeightG('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const selectFormat = (key: string) => {
    setFormatKey(key);
    const f = getFormat(key)!;
    // Preselect when there is only one material; clear otherwise
    setMaterialKey(f.materials.length === 1 ? f.materials[0].key : null);
    setWeightG('');
    setWeightTouched(false);
  };

  const selectMaterial = (key: string) => {
    setMaterialKey(key);
    setWeightG('');
    setWeightTouched(false);
  };

  const selectSize = (ml: number | null) => {
    setSizeMl(ml);
    if (!weightTouched) setWeightG('');
  };

  // Pre-fill the weight from the catalogue median once material + size are known
  const effectiveWeight = weightG !== '' ? weightG : (typicalWeight ? String(typicalWeight.medianG) : '');

  const buildRows = (): PackagingFormData[] => {
    if (!format || !material || !sizeMl) return [];
    const rows: PackagingFormData[] = [];

    const containerName = containerDisplayName(format, material, sizeMl);
    rows.push(applyPackagingDefaults(makePackagingRow({
      name: containerName,
      packaging_category: 'container',
      net_weight_g: effectiveWeight,
      amount: effectiveWeight,
      unit: 'g',
      epr_is_drinks_container: true,
      container_format: format.key,
      container_material: material.key,
      container_size_ml: sizeMl,
      weight_source: weightTouched ? 'measured' : 'typical',
    }), material.defaults));

    if (closure) {
      const w = closureWeightG !== '' ? closureWeightG : String(closure.typicalWeightG.medianG);
      rows.push(applyPackagingDefaults(makePackagingRow({
        name: closure.label,
        packaging_category: 'closure',
        net_weight_g: w,
        amount: w,
        unit: 'g',
        container_format: format.key,
        container_material: closure.materialKey,
        weight_source: closureWeightG !== '' ? 'measured' : 'typical',
      }), closure.defaults));
    }

    if (labelOption) {
      const w = labelWeightG !== '' ? labelWeightG : String(labelOption.typicalWeightG.medianG);
      rows.push(applyPackagingDefaults(makePackagingRow({
        name: labelOption.label,
        packaging_category: 'label',
        net_weight_g: w,
        amount: w,
        unit: 'g',
        container_format: format.key,
        container_material: labelOption.materialKey,
        weight_source: labelWeightG !== '' ? 'measured' : 'typical',
      }), labelOption.defaults));
    }

    if (multipack) {
      const w = multipackWeightG !== '' ? multipackWeightG : String(multipack.typicalWeightG.medianG);
      rows.push(applyPackagingDefaults(makePackagingRow({
        name: multipack.label,
        packaging_category: 'secondary',
        net_weight_g: w,
        amount: w,
        unit: 'g',
        units_per_group: unitsPerPack,
        container_material: multipack.materialKey,
        weight_source: multipackWeightG !== '' ? 'measured' : 'typical',
      }), multipack.defaults));
    }

    return rows;
  };

  const handleComplete = async () => {
    const rows = buildRows();
    if (rows.length === 0) return;
    setIsCompleting(true);
    try {
      // Auto-match an emission factor for each row from its deterministic
      // catalogue search. Failures leave the row unmatched (user picks later).
      const efSources = [
        { query: material!.efSearchQuery, category: 'container' },
        closure ? { query: closure.efSearchQuery, category: 'closure' } : null,
        labelOption ? { query: labelOption.efSearchQuery, category: 'label' } : null,
        multipack ? { query: multipack.efSearchQuery, category: 'secondary' } : null,
      ].filter((s): s is { query: string; category: string } => s !== null);

      const matches = await Promise.all(
        efSources.map((s) =>
          autoMatchEmissionFactor({
            query: s.query,
            organizationId,
            packagingCategory: s.category,
          })
        )
      );

      const matchedRows = rows.map((row, i) => {
        const match = matches[i];
        if (!match) return { ...row, match_status: 'needs_review' as const };
        return {
          ...row,
          // Curated catalogue mapping with a deterministic search: verified
          match_status: 'verified' as const,
          matched_source_name: match.matched_source_name,
          data_source: match.data_source,
          data_source_id: match.data_source_id,
          supplier_product_id: match.supplier_product_id,
          carbon_intensity: match.carbon_intensity,
          openlca_database: match.openlca_database,
          ef_source: match.ef_source,
          ef_source_type: match.ef_source_type,
          ef_data_quality_grade: match.ef_data_quality_grade,
          ef_uncertainty_percent: match.ef_uncertainty_percent,
        };
      });

      const unmatched = matchedRows.filter((r) => !r.data_source).length;
      onComplete(matchedRows);
      handleOpenChange(false);
      toast.success(
        unmatched === 0
          ? `${matchedRows.length} packaging item${matchedRows.length > 1 ? 's' : ''} added with emission factors matched`
          : `${matchedRows.length} packaging item${matchedRows.length > 1 ? 's' : ''} added. ${unmatched} still need${unmatched === 1 ? 's' : ''} an emission factor.`
      );
    } finally {
      setIsCompleting(false);
    }
  };

  const steps = [
    {
      id: 'format',
      title: 'Container',
      validate: () => !!formatKey,
    },
    {
      id: 'material-size',
      title: 'Material and size',
      validate: () => !!materialKey && !!sizeMl && sizeMl > 0,
    },
    {
      id: 'weight',
      title: 'Weight',
      validate: () => Number(effectiveWeight) > 0,
    },
    {
      id: 'closure-label',
      title: 'Cap and label',
      optional: true,
      validate: () => true,
    },
    {
      id: 'multipack',
      title: 'Multipack',
      optional: true,
      validate: () => {
        if (!multipackKey || multipackKey === 'none' || !multipack) return true;
        const upg = Number(unitsPerPack);
        return Number.isFinite(upg) && upg >= 2;
      },
    },
    {
      id: 'review',
      title: 'Review',
    },
  ];

  const weightRangeHint = typicalWeight
    ? `Typical: ${typicalWeight.minG} to ${typicalWeight.maxG} g`
    : null;

  return (
    <WizardContainer
      title="Set up your packaging"
      description="Answer a few questions and we will build the packaging list for you"
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onComplete={handleComplete}
      onCancel={() => handleOpenChange(false)}
      variant="dialog"
      dialogOpen={open}
      onDialogOpenChange={handleOpenChange}
      isLoading={isCompleting}
      allowSkip
      showProgress
    >
      <WizardStep step="format">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Does your product come in a can, bottle, or something else?</h3>
            <p className="text-sm text-muted-foreground mt-1">Pick the main container your drink is sold in.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CONTAINER_FORMATS.map((f) => {
              const Icon = FORMAT_ICONS[f.key] || Package;
              const selected = formatKey === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => selectFormat(f.key)}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors hover:border-primary/60',
                    selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                  )}
                >
                  <Icon className={cn('h-6 w-6 mb-2', selected ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="font-medium text-sm">{f.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Something unusual? Close this and use Add manually instead.
          </p>
        </div>
      </WizardStep>

      <WizardStep step="material-size">
        <div className="space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="font-medium">What is your {format?.label.toLowerCase() ?? 'container'} made of?</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {format?.materials.map((m) => (
                <Button
                  key={m.key}
                  type="button"
                  variant={materialKey === m.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => selectMaterial(m.key)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-medium">What size is it?</h3>
              <p className="text-sm text-muted-foreground mt-1">How much drink one container holds.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {format?.sizePresets.map((p) => (
                <Button
                  key={p.ml}
                  type="button"
                  variant={sizeMl === p.ml && !customSize ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setCustomSize('');
                    selectSize(p.ml);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                type="number"
                min={1}
                placeholder="Or enter a size"
                value={customSize}
                onChange={(e) => {
                  setCustomSize(e.target.value);
                  const v = parseFloat(e.target.value);
                  selectSize(!isNaN(v) && v > 0 ? v : null);
                }}
              />
              <span className="text-sm text-muted-foreground">ml</span>
            </div>
          </div>
        </div>
      </WizardStep>

      <WizardStep step="weight">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">How much does the empty {format?.label.toLowerCase() ?? 'container'} weigh?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Weigh one empty if you can. If not, the typical weight below is a reasonable starting point.
            </p>
          </div>
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={effectiveWeight}
              onChange={(e) => {
                setWeightG(e.target.value);
                setWeightTouched(true);
              }}
            />
            <span className="text-sm text-muted-foreground">grams</span>
          </div>
          {weightRangeHint && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Scale className="h-4 w-4" />
              {weightRangeHint}
              {!weightTouched && typicalWeight && (
                <Badge variant="secondary" className="ml-1">Pre-filled with the typical weight</Badge>
              )}
            </div>
          )}
          {typicalWeight && Number(effectiveWeight) > 0 &&
            (Number(effectiveWeight) < typicalWeight.minG || Number(effectiveWeight) > typicalWeight.maxG) && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              That is outside the typical range for this container. Double-check it is the weight of one empty container in grams.
            </p>
          )}
        </div>
      </WizardStep>

      <WizardStep step="closure-label">
        <div className="space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="font-medium flex items-center gap-2"><Grip className="h-4 w-4" /> Does it have a cap, cork or other closure?</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={closureKey === 'none' || !closureKey ? 'default' : 'outline'}
                size="sm"
                onClick={() => setClosureKey('none')}
              >
                No closure
              </Button>
              {closureChoices.map((o) => (
                <Button
                  key={o.key}
                  type="button"
                  variant={closureKey === o.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClosureKey(o.key)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {closure && (
              <AccessoryWeightInput
                option={closure}
                value={closureWeightG}
                onChange={setClosureWeightG}
              />
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-medium flex items-center gap-2"><Tag className="h-4 w-4" /> Does it have a label?</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={labelKey === 'none' || !labelKey ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLabelKey('none')}
              >
                No label
              </Button>
              {labelChoices.map((o) => (
                <Button
                  key={o.key}
                  type="button"
                  variant={labelKey === o.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLabelKey(o.key)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {labelOption && (
              <AccessoryWeightInput
                option={labelOption}
                value={labelWeightG}
                onChange={setLabelWeightG}
              />
            )}
          </div>
        </div>
      </WizardStep>

      <WizardStep step="multipack">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Is it sold in a multipack, case or box?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Packaging shared by several products. Its impact is split between them, so we need to know how many fit in one.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={multipackKey === 'none' || !multipackKey ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMultipackKey('none')}
            >
              Sold individually
            </Button>
            {MULTIPACK_OPTIONS.map((o) => (
              <Button
                key={o.key}
                type="button"
                variant={multipackKey === o.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMultipackKey(o.key)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          {multipack && (
            <div className="space-y-3 pt-2">
              <div className="max-w-xs">
                <Label>How many products fit in one?</Label>
                <Input
                  type="number"
                  min={2}
                  step={1}
                  placeholder="e.g. 24"
                  value={unitsPerPack}
                  onChange={(e) => setUnitsPerPack(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For example, enter 24 for a case of 24 bottles.
                </p>
              </div>
              <AccessoryWeightInput
                option={multipack}
                value={multipackWeightG}
                onChange={setMultipackWeightG}
                label={`How much does the empty ${multipack.label.toLowerCase()} weigh?`}
              />
            </div>
          )}
        </div>
      </WizardStep>

      <WizardStep step="review">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Here is what we will add</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Each item gets a matching emission factor automatically. You can fine-tune everything afterwards.
            </p>
          </div>
          <div className="space-y-2">
            {buildRows().map((row) => (
              <Card key={row.tempId} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.packaging_category}
                      {' · '}{Number(row.net_weight_g)} g
                      {row.units_per_group ? ` · shared by ${row.units_per_group} products` : ''}
                      {row.weight_source === 'typical' ? ' · typical weight' : ''}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </WizardStep>
    </WizardContainer>
  );
}

function AccessoryWeightInput({
  option,
  value,
  onChange,
  label,
}: {
  option: AccessoryOption;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="max-w-xs">
      <Label className="text-sm">{label ?? 'Weight'}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          type="number"
          min={0}
          step="0.1"
          value={value !== '' ? value : String(option.typicalWeightG.medianG)}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-sm text-muted-foreground">grams</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Typical: {option.typicalWeightG.minG} to {option.typicalWeightG.maxG} g. Pre-filled with the usual weight.
      </p>
    </div>
  );
}
