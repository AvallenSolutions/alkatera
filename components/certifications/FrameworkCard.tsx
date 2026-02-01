'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

const statusConfig = {
  not_started: {
    label: 'Not Started',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Target,
  },
  ready: {
    label: 'Ready',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: CheckCircle2,
  },
  certified: {
    label: 'Certified',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: Award,
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertCircle,
  },
};

const categoryColors: Record<string, string> = {
  'B Corp': 'bg-emerald-500',
  'Climate': 'bg-blue-500',
  'ESG': 'bg-purple-500',
  'Reporting': 'bg-amber-500',
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
    <Card className={`hover:shadow-md transition-shadow ${isLocked ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={categoryColors[framework.category] || 'bg-slate-500'}>
              {framework.category}
            </Badge>
            <Badge variant="outline">{framework.version}</Badge>
          </div>
          {isLocked ? (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <Lock className="h-3 w-3 mr-1" />
              Canopy
            </Badge>
          ) : (
            <Badge className={config.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-2">{framework.name}</CardTitle>
        <CardDescription className="line-clamp-2">{framework.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Score</span>
            <span className={`font-medium ${isPassingScore ? 'text-emerald-600' : ''}`}>
              {score}% / {framework.passing_score}% required
            </span>
          </div>
          <Progress
            value={score}
            className={`h-2 ${isPassingScore ? '[&>div]:bg-emerald-500' : ''}`}
          />
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
                <Award className="h-4 w-4 text-emerald-500" />
                <span>Certified: {new Date(certification.certification_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {isLocked ? (
            <Link href="/dashboard/settings" className="w-full">
              <Button variant="outline" className="w-full text-amber-600 border-amber-300 hover:bg-amber-50">
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
