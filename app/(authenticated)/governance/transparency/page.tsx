'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  RefreshCw,
  ArrowLeft,
  Target,
  Building2,
  Globe,
  Heart,
  Save,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useOrganization } from '@/lib/organizationContext';

interface MissionData {
  id?: string;
  mission_statement: string | null;
  vision_statement: string | null;
  purpose_statement: string | null;
  purpose_type: string | null;
  core_values: Array<{ name: string; description: string }> | null;
  legal_structure: string | null;
  is_benefit_corporation: boolean;
  benefit_corp_registration_date: string | null;
  articles_include_stakeholder_consideration: boolean;
  sdg_commitments: number[] | null;
  climate_commitments: string[] | null;
}

const SDG_LIST = [
  { number: 1, name: 'No Poverty' },
  { number: 2, name: 'Zero Hunger' },
  { number: 3, name: 'Good Health & Well-being' },
  { number: 4, name: 'Quality Education' },
  { number: 5, name: 'Gender Equality' },
  { number: 6, name: 'Clean Water & Sanitation' },
  { number: 7, name: 'Affordable & Clean Energy' },
  { number: 8, name: 'Decent Work & Economic Growth' },
  { number: 9, name: 'Industry, Innovation & Infrastructure' },
  { number: 10, name: 'Reduced Inequalities' },
  { number: 11, name: 'Sustainable Cities & Communities' },
  { number: 12, name: 'Responsible Consumption & Production' },
  { number: 13, name: 'Climate Action' },
  { number: 14, name: 'Life Below Water' },
  { number: 15, name: 'Life on Land' },
  { number: 16, name: 'Peace, Justice & Strong Institutions' },
  { number: 17, name: 'Partnerships for the Goals' },
];

export default function TransparencyPage() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState<MissionData>({
    mission_statement: '',
    vision_statement: '',
    purpose_statement: '',
    purpose_type: 'purpose',
    core_values: [],
    legal_structure: 'ltd',
    is_benefit_corporation: false,
    benefit_corp_registration_date: null,
    articles_include_stakeholder_consideration: false,
    sdg_commitments: [],
    climate_commitments: [],
  });
  const [newValue, setNewValue] = useState({ name: '', description: '' });
  const [newClimateCommitment, setNewClimateCommitment] = useState('');

  useEffect(() => {
    async function fetchMission() {
      if (!currentOrganization?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/governance/mission?organization_id=${organization.id}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setFormData({
              ...data,
              core_values: data.core_values || [],
              sdg_commitments: data.sdg_commitments || [],
              climate_commitments: data.climate_commitments || [],
            });
          }
        }
      } catch (error) {
        console.error('Error fetching mission:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMission();
  }, [currentOrganization?.id]);

  const handleSave = async () => {
    if (!currentOrganization?.id) return;

    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch('/api/governance/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organization_id: currentOrganization.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save mission');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving mission:', error);
      alert('Failed to save mission');
    } finally {
      setSaving(false);
    }
  };

  const addCoreValue = () => {
    if (newValue.name) {
      setFormData({
        ...formData,
        core_values: [...(formData.core_values || []), newValue],
      });
      setNewValue({ name: '', description: '' });
    }
  };

  const removeCoreValue = (index: number) => {
    setFormData({
      ...formData,
      core_values: (formData.core_values || []).filter((_, i) => i !== index),
    });
  };

  const toggleSDG = (sdgNumber: number) => {
    const current = formData.sdg_commitments || [];
    if (current.includes(sdgNumber)) {
      setFormData({
        ...formData,
        sdg_commitments: current.filter(n => n !== sdgNumber),
      });
    } else {
      setFormData({
        ...formData,
        sdg_commitments: [...current, sdgNumber].sort((a, b) => a - b),
      });
    }
  };

  const addClimateCommitment = () => {
    if (newClimateCommitment) {
      setFormData({
        ...formData,
        climate_commitments: [...(formData.climate_commitments || []), newClimateCommitment],
      });
      setNewClimateCommitment('');
    }
  };

  const removeClimateCommitment = (index: number) => {
    setFormData({
      ...formData,
      climate_commitments: (formData.climate_commitments || []).filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/governance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Eye className="h-6 w-6 text-amber-600" />
              Transparency & Mission
            </h1>
            <p className="text-muted-foreground mt-1">
              Mission, values, legal structure, and public commitments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saved ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" />
                Saved
              </>
            ) : saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>About Transparency:</strong> Document your organization's mission, vision,
            values, and public commitments. This information supports B Corp certification and
            demonstrates purpose-driven governance.
          </p>
        </CardContent>
      </Card>

      {/* Mission & Vision */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Mission & Vision</CardTitle>
          </div>
          <CardDescription>Your organization's purpose and direction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mission_statement">Mission Statement</Label>
            <Textarea
              id="mission_statement"
              value={formData.mission_statement || ''}
              onChange={(e) => setFormData({ ...formData, mission_statement: e.target.value })}
              placeholder="What is your organization's core purpose?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vision_statement">Vision Statement</Label>
            <Textarea
              id="vision_statement"
              value={formData.vision_statement || ''}
              onChange={(e) => setFormData({ ...formData, vision_statement: e.target.value })}
              placeholder="What future are you working to create?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose_statement">Purpose Statement</Label>
            <Textarea
              id="purpose_statement"
              value={formData.purpose_statement || ''}
              onChange={(e) => setFormData({ ...formData, purpose_statement: e.target.value })}
              placeholder="Why does your organization exist beyond profit?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Core Values */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            <CardTitle className="text-base">Core Values</CardTitle>
          </div>
          <CardDescription>The principles that guide your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.core_values && formData.core_values.length > 0 && (
            <div className="space-y-2">
              {formData.core_values.map((value, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{value.name}</p>
                    {value.description && (
                      <p className="text-sm text-muted-foreground">{value.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCoreValue(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value_name">Value Name</Label>
              <Input
                id="value_name"
                value={newValue.name}
                onChange={(e) => setNewValue({ ...newValue, name: e.target.value })}
                placeholder="e.g., Integrity"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="value_description">Description</Label>
              <div className="flex gap-2">
                <Input
                  id="value_description"
                  value={newValue.description}
                  onChange={(e) => setNewValue({ ...newValue, description: e.target.value })}
                  placeholder="Brief description..."
                />
                <Button onClick={addCoreValue} disabled={!newValue.name}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Structure */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">Legal Structure</CardTitle>
          </div>
          <CardDescription>Your organization's legal form and governance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_benefit_corporation"
              checked={formData.is_benefit_corporation}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_benefit_corporation: checked as boolean })
              }
            />
            <Label htmlFor="is_benefit_corporation" className="text-sm font-normal">
              Registered as a Benefit Corporation / B Corp
            </Label>
          </div>

          {formData.is_benefit_corporation && (
            <div className="space-y-2">
              <Label htmlFor="benefit_corp_registration_date">Registration Date</Label>
              <Input
                id="benefit_corp_registration_date"
                type="date"
                value={formData.benefit_corp_registration_date || ''}
                onChange={(e) => setFormData({ ...formData, benefit_corp_registration_date: e.target.value })}
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="articles_include_stakeholder_consideration"
              checked={formData.articles_include_stakeholder_consideration}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, articles_include_stakeholder_consideration: checked as boolean })
              }
            />
            <Label htmlFor="articles_include_stakeholder_consideration" className="text-sm font-normal">
              Articles of Association include stakeholder consideration
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* SDG Commitments */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">UN Sustainable Development Goals</CardTitle>
          </div>
          <CardDescription>Select the SDGs your organization is committed to</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {SDG_LIST.map((sdg) => {
              const isSelected = (formData.sdg_commitments || []).includes(sdg.number);
              return (
                <button
                  key={sdg.number}
                  onClick={() => toggleSDG(sdg.number)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700'
                      : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                      {sdg.number}
                    </span>
                    <span className="text-xs line-clamp-1">{sdg.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {(formData.sdg_commitments || []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Selected:</span>
              {(formData.sdg_commitments || []).map(num => (
                <Badge key={num} variant="secondary">
                  SDG {num}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Climate Commitments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Climate Commitments</CardTitle>
          <CardDescription>Public climate and environmental commitments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.climate_commitments && formData.climate_commitments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.climate_commitments.map((commitment, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-red-100"
                  onClick={() => removeClimateCommitment(index)}
                >
                  {commitment} ×
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newClimateCommitment}
              onChange={(e) => setNewClimateCommitment(e.target.value)}
              placeholder="e.g., Net Zero by 2050, SBTi committed"
            />
            <Button onClick={addClimateCommitment} disabled={!newClimateCommitment}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
