'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ExternalLink, Check, X } from 'lucide-react';
import { StateChip } from '@/components/studio';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  source_label: string;
  source_summary: string;
  completeness_flag: string | null;
  completeness_note: string | null;
  status: string;
}

interface PlatformInfo {
  module: string;
  moduleLabel: string;
  moduleLink: string;
  found: boolean;
  completeness: 'complete' | 'partial' | 'missing';
  completenessNote: string | null;
}

interface AutoEvidencePanelProps {
  requirementId: string;
  onAccepted: () => Promise<void> | void;
}

export function AutoEvidencePanel({
  requirementId,
  onAccepted,
}: AutoEvidencePanelProps) {
  const [loading, setLoading] = useState(true);
  const [mapped, setMapped] = useState(false);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/certifications/auto-evidence/${requirementId}`,
      );
      if (!res.ok) throw new Error('Failed to load suggestions');
      const data = await res.json();
      setMapped(!!data.mapped);
      setPlatform(data.platform ?? null);
      setSuggestions(
        (data.suggestions ?? []).filter(
          (s: Suggestion) => s.status === 'suggested',
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/certifications/auto-evidence/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_evidence_id: id }),
      });
      if (!res.ok) throw new Error('Failed to accept');
      toast.success('Evidence added from platform data');
      await load();
      await onAccepted();
    } catch (err) {
      console.error(err);
      toast.error('Could not use this suggestion');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/certifications/auto-evidence/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_evidence_id: id }),
      });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[6px] border border-border bg-card p-3 text-sm text-muted-foreground">
        Checking alkatera for relevant data...
      </div>
    );
  }

  if (!mapped) return null;

  if (platform && !platform.found) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-3 text-sm">
        <p className="text-studio-attention">
          No {platform.moduleLabel.toLowerCase()} data found on alkatera.
          Complete your {platform.moduleLabel.toLowerCase()} to populate this
          requirement.
        </p>
        <a
          href={platform.moduleLink}
          className="mt-1 inline-flex items-center gap-1 font-medium text-foreground underline"
        >
          Go to {platform.moduleLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2 rounded-[6px] border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-studio-brick">
        <Sparkles className="h-4 w-4" />
        Suggested from alkatera data
      </div>
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="flex items-start justify-between gap-3 rounded-[6px] border border-border bg-secondary p-2 text-sm"
        >
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.source_label}</span>
              {s.completeness_flag && s.completeness_flag !== 'complete' && (
                <StateChip tone="attention">{s.completeness_flag}</StateChip>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{s.source_summary}</p>
            {s.completeness_note && (
              <p className="mt-1 text-xs text-studio-attention">
                {s.completeness_note}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === s.id}
              onClick={() => accept(s.id)}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Use as evidence
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === s.id}
              onClick={() => dismiss(s.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
