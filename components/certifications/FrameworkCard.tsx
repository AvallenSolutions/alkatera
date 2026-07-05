'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StateChip } from '@/components/studio/state-chip';
import type { WorkingTone } from '@/components/studio/theme';
import {
  Award,
  ChevronRight,
  Calendar,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useSubscription, type FeatureCode } from '@/hooks/useSubscription';

interface Framework {
  id: string;
  name: string;
  code: string;
  version: string;
  description: string;
  category: string;
  passing_score: number;
  total_points: number;
}

interface Certification {
  id: string;
  framework_id: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'certified' | 'expired';
  current_score: number | null;
  target_date: string | null;
  certification_date: string | null;
  expiry_date: string | null;
}

interface FrameworkCardProps {
  framework: Framework;
  certification?: Certification;
  onStart?: (frameworkId: string) => void;
}

const statusConfig: Record<
  Certification['status'],
  { label: string; tone: WorkingTone; icon: typeof Clock }
> = {
  not_started: {
    label: 'Not Started',
    tone: 'quiet',
    icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    tone: 'attention',
    icon: Target,
  },
  ready: {
    label: 'Ready',
    tone: 'good',
    icon: CheckCircle2,
  },
  certified: {
    label: 'Certified',
    tone: 'good',
    icon: Award,
  },
  expired: {
    label: 'Expired',
    tone: 'stale',
    icon: AlertCircle,
  },
};

// Maps framework codes to their required feature codes
const frameworkFeatureMap: Record<string, string> = {
  csrd: 'csrd_compliance',
  gri: 'gri_standards',
  iso14001: 'iso_14001',
  iso50001: 'iso_50001',
  sbti: 'sbti_targets',
};

export function FrameworkCard({ framework, certification, onStart }: FrameworkCardProps) {
  const { hasFeature } = useSubscription();
  const requiredFeature = frameworkFeatureMap[framework.code.toLowerCase()] as FeatureCode | undefined;
  const isLocked = requiredFeature ? !hasFeature(requiredFeature) : false;

  const status = certification?.status || 'not_started';
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const score = certification?.current_score ?? 0;
  const isPassingScore = score >= framework.passing_score;

  return (
    <Card
      className={`rounded-[6px] border-border bg-card transition-colors duration-200 ease-studio hover:border-foreground/30 ${isLocked ? 'opacity-75' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-brick">
              {framework.category}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              {framework.version}
            </span>
          </div>
          {isLocked ? (
            <StateChip tone="attention" className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Canopy
            </StateChip>
          ) : (
            <StateChip tone={config.tone} className="inline-flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </StateChip>
          )}
        </div>
        <CardTitle className="font-display text-lg mt-2">{framework.name}</CardTitle>
        <CardDescription className="line-clamp-2">{framework.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Progress */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              Current Score
            </span>
            <span className={`text-sm font-medium tabular-nums ${isPassingScore ? 'text-studio-good' : ''}`}>
              {score}% / {framework.passing_score}% required
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${isPassingScore ? 'bg-studio-good' : 'bg-studio-brick'}`}
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
        </div>

        {/* Dates */}
        {(certification?.target_date || certification?.certification_date) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {certification.target_date && status !== 'certified' && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Target: {new Date(certification.target_date).toLocaleDateString()}</span>
              </div>
            )}
            {certification.certification_date && (
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4 text-studio-good" />
                <span>Certified: {new Date(certification.certification_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {isLocked ? (
            <Link href="/dashboard/settings" className="w-full">
              <Button variant="outline" className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                Upgrade to Canopy
              </Button>
            </Link>
          ) : status === 'not_started' ? (
            <Button
              variant="default"
              className="w-full"
              onClick={() => onStart?.(framework.id)}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Certification
            </Button>
          ) : (
            <Link href={`/certifications/${framework.code.toLowerCase()}`} className="w-full">
              <Button variant="outline" className="w-full">
                View Details
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
