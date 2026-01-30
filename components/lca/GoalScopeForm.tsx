'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Target,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { CriticalReviewType, DataQualityRequirements } from '@/lib/types/lca';

interface GoalScopeFormProps {
  pcfId: string;
}

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

export default function GoalScopeForm({ pcfId }: GoalScopeFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [intendedApplication, setIntendedApplication] = useState('');
  const [reasonsForStudy, setReasonsForStudy] = useState('');
  const [intendedAudience, setIntendedAudience] = useState<string[]>([]);
  const [isComparativeAssertion, setIsComparativeAssertion] = useState(false);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [newAssumption, setNewAssumption] = useState('');
  const [criticalReviewType, setCriticalReviewType] = useState<CriticalReviewType>('none');
  const [criticalReviewJustification, setCriticalReviewJustification] = useState('');

  const [dataQuality, setDataQuality] = useState<DataQualityRequirements>({
    temporal_coverage: '',
    geographic_coverage: '',
    technological_coverage: '',
    precision: 'medium',
    completeness: 0,
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_carbon_footprints')
        .select('intended_application, reasons_for_study, intended_audience, is_comparative_assertion, assumptions_limitations, data_quality_requirements, critical_review_type, critical_review_justification, reference_year')
        .eq('id', pcfId)
        .maybeSingle();

      if (!error && data) {
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
      setLoading(false);
    }
    fetchData();
  }, [pcfId]);

  const handleSave = async () => {
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Goal & Scope definition updated.' });
    }
    setSaving(false);
  };

  const addAssumption = () => {
    if (newAssumption.trim()) {
      setAssumptions([...assumptions, newAssumption.trim()]);
      setNewAssumption('');
    }
  };

  const removeAssumption = (index: number) => {
    setAssumptions(assumptions.filter((_, i) => i !== index));
  };

  const toggleAudience = (option: string) => {
    setIntendedAudience(
      intendedAudience.includes(option)
        ? intendedAudience.filter((a) => a !== option)
        : [...intendedAudience, option]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Goal & Scope Definition
          </h2>
          <p className="text-sm text-muted-foreground">ISO 14044 Section 4.2</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      {/* Goal Definition (4.2.2) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Goal Definition</CardTitle>
          <CardDescription>ISO 14044 Section 4.2.2</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Intended Application</Label>
            <Textarea
              value={intendedApplication}
              onChange={(e) => setIntendedApplication(e.target.value)}
              placeholder="e.g., Internal product development decision-making, EPD publication, marketing claims..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Reasons for Carrying Out the Study</Label>
            <Textarea
              value={reasonsForStudy}
              onChange={(e) => setReasonsForStudy(e.target.value)}
              placeholder="e.g., CSRD reporting obligation, customer request, product improvement..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Intended Audience</Label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map((option) => (
                <Badge
                  key={option}
                  variant={intendedAudience.includes(option) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleAudience(option)}
                >
                  {option}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border">
            <Checkbox
              checked={isComparativeAssertion}
              onCheckedChange={(checked) => setIsComparativeAssertion(checked === true)}
            />
            <div>
              <Label className="font-medium">Comparative Assertion</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                This LCA will be used for public comparative assertions between products
              </p>
            </div>
          </div>
          {isComparativeAssertion && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  ISO 14044 requires an external panel critical review for any LCA used for public comparative assertions. Ensure the review type is set accordingly.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scope Definition (4.2.3) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Assumptions & Limitations</CardTitle>
          <CardDescription>ISO 14044 Section 4.2.3</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assumptions.map((a, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <span className="text-sm flex-1">{a}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAssumption(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newAssumption}
              onChange={(e) => setNewAssumption(e.target.value)}
              placeholder="Add an assumption or limitation..."
              onKeyDown={(e) => e.key === 'Enter' && addAssumption()}
            />
            <Button variant="outline" size="sm" onClick={addAssumption}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Data Quality Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Temporal Coverage</Label>
              <Input
                value={dataQuality.temporal_coverage}
                onChange={(e) => setDataQuality({ ...dataQuality, temporal_coverage: e.target.value })}
                placeholder="e.g., 2024-2025"
              />
            </div>
            <div className="space-y-2">
              <Label>Geographic Coverage</Label>
              <Input
                value={dataQuality.geographic_coverage}
                onChange={(e) => setDataQuality({ ...dataQuality, geographic_coverage: e.target.value })}
                placeholder="e.g., UK, EU average"
              />
            </div>
            <div className="space-y-2">
              <Label>Technological Coverage</Label>
              <Input
                value={dataQuality.technological_coverage}
                onChange={(e) => setDataQuality({ ...dataQuality, technological_coverage: e.target.value })}
                placeholder="e.g., Industry average"
              />
            </div>
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
                  <SelectItem value="high">High — Primary data from verified sources</SelectItem>
                  <SelectItem value="medium">Medium — Mix of primary and secondary data</SelectItem>
                  <SelectItem value="low">Low — Predominantly industry averages</SelectItem>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Review Type (4.2.4) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Critical Review Requirements</CardTitle>
          <CardDescription>ISO 14044 Section 4.2.4 / Section 6</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Review Type</Label>
            <Select value={criticalReviewType} onValueChange={(v) => setCriticalReviewType(v as CriticalReviewType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — No critical review planned</SelectItem>
                <SelectItem value="internal">Internal — Review by qualified internal staff</SelectItem>
                <SelectItem value="external_expert">External Expert — Independent LCA practitioner</SelectItem>
                <SelectItem value="external_panel">External Panel — Panel of experts (required for comparative assertions)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {criticalReviewType !== 'none' && (
            <div className="space-y-2">
              <Label>Justification</Label>
              <Textarea
                value={criticalReviewJustification}
                onChange={(e) => setCriticalReviewJustification(e.target.value)}
                placeholder="Explain why this review type was selected..."
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
