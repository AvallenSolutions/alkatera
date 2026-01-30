'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { FIELD_HELP, SMART_DEFAULTS } from '@/lib/lca-compliance-checker';
import type { CriticalReviewType, DataQualityRequirements } from '@/lib/types/lca';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ComplianceWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pcfId: string;
  onComplete?: () => void;
  initialStep?: number;
}

const STEPS = [
  { id: 1, title: 'Goal & Purpose', icon: '1', description: 'Why are you doing this LCA?' },
  { id: 2, title: 'Scope & Boundaries', icon: '2', description: 'What assumptions apply?' },
  { id: 3, title: 'Data Quality', icon: '3', description: 'How good is your data?' },
  { id: 4, title: 'Interpretation', icon: '4', description: 'Review your analysis' },
  { id: 5, title: 'Critical Review', icon: '5', description: 'Plan your review' },
  { id: 6, title: 'Summary', icon: '6', description: 'Final compliance check' },
];

const AUDIENCE_OPTIONS = [
  'Internal management',
  'Board of directors',
  'Investors',
  'Regulatory bodies',
  'Customers / consumers',
  'Supply chain partners',
  'Third-party verifiers',
  'Public disclosure',
];

export default function ComplianceWizard({
  open,
  onOpenChange,
  pcfId,
  onComplete,
  initialStep = 1,
}: ComplianceWizardProps) {
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Goal state
  const [intendedApplication, setIntendedApplication] = useState('');
  const [reasonsForStudy, setReasonsForStudy] = useState('');
  const [intendedAudience, setIntendedAudience] = useState<string[]>([]);
  const [isComparativeAssertion, setIsComparativeAssertion] = useState(false);

  // Scope state
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [newAssumption, setNewAssumption] = useState('');

  // Data quality state
  const [dataQuality, setDataQuality] = useState<DataQualityRequirements>({
    temporal_coverage: '',
    geographic_coverage: '',
    technological_coverage: '',
    precision: 'medium',
    completeness: 0,
  });

  // Critical review state
  const [criticalReviewType, setCriticalReviewType] = useState<CriticalReviewType>('none');
  const [criticalReviewJustification, setCriticalReviewJustification] = useState('');

  // Interpretation status
  const [hasInterpretation, setHasInterpretation] = useState(false);
  const [generatingInterp, setGeneratingInterp] = useState(false);
  const [interpError, setInterpError] = useState<string | null>(null);

  // Load existing data
  useEffect(() => {
    if (!open) return;
    async function fetchData() {
      setLoading(true);
      const { data } = await supabase
        .from('product_carbon_footprints')
        .select('intended_application, reasons_for_study, intended_audience, is_comparative_assertion, assumptions_limitations, data_quality_requirements, critical_review_type, critical_review_justification, reference_year')
        .eq('id', pcfId)
        .maybeSingle();

      if (data) {
        setIntendedApplication(data.intended_application || '');
        setReasonsForStudy(data.reasons_for_study || '');
        setIntendedAudience(data.intended_audience || []);
        setIsComparativeAssertion(data.is_comparative_assertion || false);
        setAssumptions(data.assumptions_limitations || []);
        setCriticalReviewType(data.critical_review_type || 'none');
        setCriticalReviewJustification(data.critical_review_justification || '');
        if (data.data_quality_requirements && typeof data.data_quality_requirements === 'object') {
          setDataQuality({
            temporal_coverage: data.data_quality_requirements.temporal_coverage || `${data.reference_year || new Date().getFullYear()}`,
            geographic_coverage: data.data_quality_requirements.geographic_coverage || '',
            technological_coverage: data.data_quality_requirements.technological_coverage || '',
            precision: data.data_quality_requirements.precision || 'medium',
            completeness: data.data_quality_requirements.completeness || 0,
          });
        }
      }

      // Check interpretation
      const { data: interp } = await supabase
        .from('lca_interpretation_results')
        .select('id')
        .eq('product_carbon_footprint_id', pcfId)
        .maybeSingle();
      setHasInterpretation(!!interp);

      setLoading(false);
    }
    fetchData();
  }, [open, pcfId]);

  const saveProgress = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('product_carbon_footprints')
      .update({
        intended_application: intendedApplication || null,
        reasons_for_study: reasonsForStudy || null,
        intended_audience: intendedAudience,
        is_comparative_assertion: isComparativeAssertion,
        assumptions_limitations: assumptions,
        data_quality_requirements: dataQuality,
        critical_review_type: criticalReviewType,
        critical_review_justification: criticalReviewJustification || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pcfId);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
    return !error;
  };

  const handleNext = async () => {
    // Save on steps 1-3, 5
    if ([1, 2, 3, 5].includes(step)) {
      const success = await saveProgress();
      if (!success) return;
    }

    if (step < 6) {
      setStep(step + 1);
    } else {
      // Final step — save and close
      await saveProgress();
      toast({ title: 'Compliance guide complete', description: 'Your ISO 14044 data has been saved.' });
      onComplete?.();
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleGenerateInterpretation = async () => {
    setGeneratingInterp(true);
    setInterpError(null);
    try {
      const res = await fetch(`/api/lca/${pcfId}/interpretation`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate');
      }
      setHasInterpretation(true);
      toast({ title: 'Interpretation generated', description: 'Contribution, sensitivity, and completeness analyses are ready.' });
    } catch (err: any) {
      setInterpError(err.message);
    } finally {
      setGeneratingInterp(false);
    }
  };

  const toggleAudience = (option: string) => {
    setIntendedAudience(
      intendedAudience.includes(option)
        ? intendedAudience.filter((a) => a !== option)
        : [...intendedAudience, option]
    );
  };

  const addAssumption = (text?: string) => {
    const value = text || newAssumption.trim();
    if (value && !assumptions.includes(value)) {
      setAssumptions([...assumptions, value]);
      if (!text) setNewAssumption('');
    }
  };

  const removeAssumption = (index: number) => {
    setAssumptions(assumptions.filter((_, i) => i !== index));
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <button
            onClick={() => s.id <= step && setStep(s.id)}
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
              s.id === step
                ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                : s.id < step
                ? 'bg-emerald-500 text-white cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-700 text-muted-foreground'
            }`}
          >
            {s.id < step ? <Check className="h-3.5 w-3.5" /> : s.icon}
          </button>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 ${s.id < step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderFieldHelp = (fieldId: string) => {
    const help = FIELD_HELP[fieldId];
    if (!help) return null;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help inline ml-1" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm space-y-2">
            <p className="text-xs font-semibold">{help.what}</p>
            <p className="text-xs text-muted-foreground">{help.why}</p>
            <div className="pt-1 border-t">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold">Example:</span> {help.example}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  ISO 14044 requires every LCA to clearly state its purpose. This helps readers understand the context and any limitations. Don&apos;t worry — there are no wrong answers here.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center">
                Intended Application {renderFieldHelp('intended_application')}
              </Label>
              <Textarea
                value={intendedApplication}
                onChange={(e) => setIntendedApplication(e.target.value)}
                placeholder="How will this LCA be used?"
                rows={2}
              />
              {!intendedApplication && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">Suggestions:</span>
                  {SMART_DEFAULTS.intended_application_suggestions.slice(0, 3).map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      onClick={() => setIntendedApplication(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center">
                Reasons for the Study {renderFieldHelp('reasons_for_study')}
              </Label>
              <Textarea
                value={reasonsForStudy}
                onChange={(e) => setReasonsForStudy(e.target.value)}
                placeholder="Why is this LCA being carried out?"
                rows={2}
              />
              {!reasonsForStudy && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">Suggestions:</span>
                  {SMART_DEFAULTS.reasons_suggestions.slice(0, 3).map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      onClick={() => setReasonsForStudy(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center">
                Intended Audience {renderFieldHelp('intended_audience')}
              </Label>
              <p className="text-xs text-muted-foreground">Select all that apply — who will read this report?</p>
              <div className="flex flex-wrap gap-2">
                {AUDIENCE_OPTIONS.map((option) => (
                  <Badge
                    key={option}
                    variant={intendedAudience.includes(option) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleAudience(option)}
                  >
                    {intendedAudience.includes(option) && <Check className="h-3 w-3 mr-1" />}
                    {option}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Checkbox
                  checked={isComparativeAssertion}
                  onCheckedChange={(checked) => setIsComparativeAssertion(checked === true)}
                />
                <div>
                  <Label className="font-medium flex items-center">
                    Comparative Assertion {renderFieldHelp('comparative_assertion')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This LCA will be used to publicly compare products
                  </p>
                </div>
              </div>
              {isComparativeAssertion && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      ISO 14044 requires an <strong>external panel critical review</strong> for any public comparative assertions. We&apos;ll set this up in step 5.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Every LCA has assumptions and limitations. Documenting these is required by ISO 14044 and helps readers understand what the results do and don&apos;t cover.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center">
                Assumptions & Limitations {renderFieldHelp('assumptions_limitations')}
              </Label>
              <p className="text-xs text-muted-foreground">
                List the key assumptions made in this study. Add at least one.
              </p>

              {assumptions.length > 0 && (
                <div className="space-y-1.5">
                  {assumptions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm flex-1">{a}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAssumption(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={newAssumption}
                  onChange={(e) => setNewAssumption(e.target.value)}
                  placeholder="Type an assumption or limitation..."
                  onKeyDown={(e) => e.key === 'Enter' && addAssumption()}
                />
                <Button variant="outline" size="sm" onClick={() => addAssumption()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {assumptions.length === 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground font-medium">Common assumptions — click to add:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SMART_DEFAULTS.assumptions.map((a) => (
                      <Badge
                        key={a}
                        variant="outline"
                        className="text-[10px] cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={() => addAssumption(a)}
                      >
                        <Plus className="h-2.5 w-2.5 mr-0.5" /> {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  ISO 14044 requires documenting data quality. This helps readers understand how reliable the results are. Fill in what you can — even partial information is valuable.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center">
                  Temporal Coverage {renderFieldHelp('temporal_coverage')}
                </Label>
                <Input
                  value={dataQuality.temporal_coverage}
                  onChange={(e) => setDataQuality({ ...dataQuality, temporal_coverage: e.target.value })}
                  placeholder="e.g., 2024-2025"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center">
                  Geographic Coverage {renderFieldHelp('geographic_coverage')}
                </Label>
                <Input
                  value={dataQuality.geographic_coverage}
                  onChange={(e) => setDataQuality({ ...dataQuality, geographic_coverage: e.target.value })}
                  placeholder="e.g., UK production; EU average for imported materials"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center">
                  Technological Coverage {renderFieldHelp('technological_coverage')}
                </Label>
                <Input
                  value={dataQuality.technological_coverage}
                  onChange={(e) => setDataQuality({ ...dataQuality, technological_coverage: e.target.value })}
                  placeholder="e.g., Industry average 2024; site-specific for brewing"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Precision</Label>
                  <Select
                    value={dataQuality.precision}
                    onValueChange={(v) => setDataQuality({ ...dataQuality, precision: v as 'high' | 'medium' | 'low' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High — Verified primary data</SelectItem>
                      <SelectItem value="medium">Medium — Mix of sources</SelectItem>
                      <SelectItem value="low">Low — Mostly estimates</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estimated Completeness (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={dataQuality.completeness}
                    onChange={(e) => setDataQuality({ ...dataQuality, completeness: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-muted-foreground">Aim for 95%+ for ISO compliance</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  ISO 14044 Section 4.5 requires an interpretation phase that includes contribution analysis, sensitivity analysis, and completeness checks. We can generate this automatically from your LCA data.
                </p>
              </div>
            </div>

            {hasInterpretation ? (
              <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                <CardContent className="flex items-center gap-3 py-6">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="font-semibold">Interpretation Generated</p>
                    <p className="text-sm text-muted-foreground">
                      Contribution analysis, sensitivity analysis, completeness checks, and conclusions are ready. You can review them on the Interpretation tab after completing this guide.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
                  <Target className="h-10 w-10 text-muted-foreground/40" />
                  <div className="text-center space-y-1">
                    <p className="font-semibold">Interpretation Not Yet Generated</p>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Click below to automatically generate a full ISO 14044 interpretation from your LCA calculation results.
                    </p>
                  </div>
                  <Button onClick={handleGenerateInterpretation} disabled={generatingInterp} className="gap-2">
                    {generatingInterp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {generatingInterp ? 'Generating...' : 'Generate Interpretation'}
                  </Button>
                  {interpError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> {interpError}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-200">
                  <p>
                    ISO 14044 Section 6 covers critical review.
                    {isComparativeAssertion
                      ? ' Since you declared a comparative assertion, an external panel review is required.'
                      : ' A critical review is recommended for public reports but not strictly required for internal use.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center">
                  Review Type {renderFieldHelp('critical_review_type')}
                </Label>
                <Select value={criticalReviewType} onValueChange={(v) => setCriticalReviewType(v as CriticalReviewType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — No review planned</SelectItem>
                    <SelectItem value="internal">Internal — Qualified internal staff</SelectItem>
                    <SelectItem value="external_expert">External Expert — Independent practitioner</SelectItem>
                    <SelectItem value="external_panel">External Panel — Panel of experts</SelectItem>
                  </SelectContent>
                </Select>

                {isComparativeAssertion && criticalReviewType !== 'external_panel' && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-800 dark:text-red-200">
                        You indicated this LCA makes comparative assertions. ISO 14044 <strong>requires</strong> an external panel review. Please select &quot;External Panel&quot;.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {criticalReviewType !== 'none' && (
                <div className="space-y-2">
                  <Label className="flex items-center">
                    Justification {renderFieldHelp('critical_review_justification')}
                  </Label>
                  <Textarea
                    value={criticalReviewJustification}
                    onChange={(e) => setCriticalReviewJustification(e.target.value)}
                    placeholder="Why was this review type selected?"
                    rows={2}
                  />
                </div>
              )}

              {criticalReviewType !== 'none' && (
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground">
                    After completing this guide, go to the <strong>Critical Review</strong> tab to add reviewers, manage comments, and track the review process.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-5">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 dark:text-emerald-200">
                  Here&apos;s a summary of what you&apos;ve completed. Items with a green tick are done. Items with an orange warning still need attention.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <SummaryRow label="Intended application" done={!!intendedApplication.trim()} />
              <SummaryRow label="Reasons for study" done={!!reasonsForStudy.trim()} />
              <SummaryRow label="Intended audience" done={intendedAudience.length > 0} />
              <SummaryRow label="Assumptions documented" done={assumptions.length > 0} />
              <SummaryRow label="Temporal coverage" done={!!dataQuality.temporal_coverage?.trim()} />
              <SummaryRow label="Geographic coverage" done={!!dataQuality.geographic_coverage?.trim()} />
              <SummaryRow label="Technological coverage" done={!!dataQuality.technological_coverage?.trim()} />
              <SummaryRow label="Interpretation generated" done={hasInterpretation} />
              <SummaryRow
                label="Critical review planned"
                done={criticalReviewType !== 'none'}
                optional={!isComparativeAssertion}
              />
            </div>

            {(!intendedApplication.trim() || !reasonsForStudy.trim() || intendedAudience.length === 0 || assumptions.length === 0) && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Some required fields are still incomplete. You can go back to fill them in, or save your progress and return later — your data is preserved.
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            ISO 14044 Compliance Guide — Step {step} of {STEPS.length}
          </DialogTitle>
          <DialogDescription>{currentStep.title}: {currentStep.description}</DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}
        {renderStep()}

        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleBack} disabled={step === 1} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button onClick={handleNext} className="gap-1.5">
              {step === 6 ? (
                <>
                  <Check className="h-4 w-4" /> Finish
                </>
              ) : (
                <>
                  Next <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, done, optional }: { label: string; done: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertCircle className={`h-4 w-4 flex-shrink-0 ${optional ? 'text-slate-300' : 'text-amber-500'}`} />
      )}
      <span className={`text-sm ${done ? 'text-muted-foreground' : ''}`}>{label}</span>
      {optional && !done && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">Optional</Badge>
      )}
    </div>
  );
}
