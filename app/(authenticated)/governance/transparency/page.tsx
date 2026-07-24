'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useOrganization } from '@/lib/organizationContext';

import { FeatureGate } from '@/components/subscription/FeatureGate';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { TopicHeader, Section, HubSkeleton, ComplianceNote } from '@/components/social';

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
  return (
    <FeatureGate feature="governance_ethics">
      <TransparencyPageContent />
    </FeatureGate>
  );
}

function TransparencyPageContent() {
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
          `/api/governance/mission?organization_id=${currentOrganization.id}`
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
      // Get the current session to pass to API
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/governance/mission', {
        method: 'POST',
        headers,
        credentials: 'include',
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
    return <HubSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <TopicHeader
        eyebrow={<>OUR PEOPLE &middot; GOVERNANCE</>}
        headline={<>Transparency.</>}
        description="Mission, values, legal structure, and public commitments."
        backHref="/governance"
        backLabel="Governance"
      >
        <PillButton size="sm" onClick={handleSave} disabled={saving}>
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </PillButton>
      </TopicHeader>

      <ComplianceNote label="ABOUT TRANSPARENCY">
        Document your organisation&apos;s mission, vision, values, and public commitments. This
        information supports B Corp certification and demonstrates purpose-driven governance.
      </ComplianceNote>

      <Section label="MISSION & VISION" blurb="Your organisation's purpose and direction.">
        <div className="space-y-4">
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
        </div>
      </Section>

      <Section label="CORE VALUES" blurb="The principles that guide your organisation.">
        <div className="space-y-4">
          {formData.core_values && formData.core_values.length > 0 && (
            <div className="divide-y divide-studio-hairline border-y border-studio-hairline">
              {formData.core_values.map((value, index) => (
                <div key={index} className="flex items-start gap-2 py-3">
                  <div className="flex-1">
                    <p className="font-medium">{value.name}</p>
                    {value.description && (
                      <p className="text-sm text-muted-foreground">{value.description}</p>
                    )}
                  </div>
                  <PillButton variant="ghost" size="sm" onClick={() => removeCoreValue(index)}>
                    Remove
                  </PillButton>
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
                <PillButton variant="outline" onClick={addCoreValue} disabled={!newValue.name}>
                  Add
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section label="LEGAL STRUCTURE" blurb="Your organisation's legal form and governance.">
        <div className="space-y-4">
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
        </div>
      </Section>

      <Section
        label="UN SUSTAINABLE DEVELOPMENT GOALS"
        blurb="Select the SDGs your organisation is committed to."
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {SDG_LIST.map((sdg) => {
            const isSelected = (formData.sdg_commitments || []).includes(sdg.number);
            return (
              <button
                key={sdg.number}
                onClick={() => toggleSDG(sdg.number)}
                className={`p-2 rounded-[6px] border text-left transition-colors ${
                  isSelected
                    ? 'border-studio-ink bg-studio-cream'
                    : 'border-studio-hairline bg-transparent hover:bg-studio-cream'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${isSelected ? 'text-foreground' : 'text-studio-dim'}`}>
                    {sdg.number}
                  </span>
                  <span className="text-xs line-clamp-1">{sdg.name}</span>
                </div>
              </button>
            );
          })}
        </div>
        {(formData.sdg_commitments || []).length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Selected:</span>
            {(formData.sdg_commitments || []).map(num => (
              <StateChip key={num} tone="quiet">
                SDG {num}
              </StateChip>
            ))}
          </div>
        )}
      </Section>

      <Section label="CLIMATE COMMITMENTS" blurb="Public climate and environmental commitments.">
        <div className="space-y-4">
          {formData.climate_commitments && formData.climate_commitments.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {formData.climate_commitments.map((commitment, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => removeClimateCommitment(index)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-studio-stale"
                  title="Remove commitment"
                >
                  {commitment} ×
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newClimateCommitment}
              onChange={(e) => setNewClimateCommitment(e.target.value)}
              placeholder="e.g., Net Zero by 2050, SBTi committed"
            />
            <PillButton variant="outline" onClick={addClimateCommitment} disabled={!newClimateCommitment}>
              Add
            </PillButton>
          </div>
        </div>
      </Section>
    </div>
  );
}
