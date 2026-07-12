'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Award, Search, RefreshCw } from 'lucide-react';
import { Eyebrow, Panel, PillButton } from '@/components/studio';
import { PageLoader } from '@/components/ui/page-loader';
import { CertificationReadinessHero } from '@/components/certifications/CertificationReadinessHero';
import { FrameworkCard } from '@/components/certifications/FrameworkCard';
import { useCertificationFrameworks } from '@/hooks/data/useCertificationFrameworks';
import { useCertificationScore } from '@/hooks/data/useCertificationScore';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'certified', label: 'Certified' },
] as const;

/** Quiet mono text-link: active reads in the room accent, the rest are dim. */
function filterLinkClass(active: boolean) {
  return cn(
    'font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ease-studio',
    active
      ? 'text-room-accent underline underline-offset-4'
      : 'text-studio-dim hover:text-foreground',
  );
}

export default function CertificationsPage() {
  return (
    <FeatureGate feature="bcorp_tracking">
      <CertificationsHub />
    </FeatureGate>
  );
}

/**
 * Certifications hub: an overview of certification progress, the frameworks
 * we support, and the ability to select one. Per-framework work (e.g. the
 * full B Corp experience) lives on the framework detail page at
 * /certifications/[code].
 */
function CertificationsHub() {
  const router = useRouter();
  const { frameworks, certifications, loading, startCertification, refetch } =
    useCertificationFrameworks(true);
  const {
    readinessSummary,
    loading: scoreLoading,
    refetch: refetchScores,
  } = useCertificationScore();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(
    null,
  );
  const [targetDate, setTargetDate] = useState('');
  const [starting, setStarting] = useState(false);

  const categories = Array.from(new Set(frameworks.map((f) => f.category)));

  const filteredFrameworks = frameworks.filter((framework) => {
    const cert = certifications.find((c) => c.framework_id === framework.id);
    const matchesSearch =
      !searchTerm ||
      framework.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      framework.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || framework.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (cert?.status || 'not_started') === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // B Corp owns its full journey on its detail page (journey selection,
  // gap analysis, Risk Tool, audit workflow). Selecting it from the hub
  // routes there rather than opening the generic start dialog.
  const openStartDialog = (frameworkId: string) => {
    const fw = frameworks.find((f) => f.id === frameworkId);
    if (fw && fw.code.toLowerCase() === 'bcorp_2026') {
      router.push('/certifications/bcorp_2026');
      return;
    }
    setSelectedFramework(frameworkId);
    setStartDialogOpen(true);
  };

  const handleStartCertification = async () => {
    if (!selectedFramework) return;
    setStarting(true);
    try {
      await startCertification(selectedFramework, {
        target_date: targetDate || undefined,
      });
      setStartDialogOpen(false);
      setSelectedFramework(null);
      setTargetDate('');
    } finally {
      setStarting(false);
    }
  };

  const statusCounts = {
    all: frameworks.length,
    not_started: frameworks.filter(
      (f) => !certifications.find((c) => c.framework_id === f.id),
    ).length,
    in_progress: certifications.filter((c) => c.status === 'in_progress')
      .length,
    ready: certifications.filter((c) => c.status === 'ready').length,
    certified: certifications.filter((c) => c.status === 'certified').length,
  };

  return (
    <div className="space-y-6">
      {/* Statement header */}
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-2">
          <Eyebrow>THE EVIDENCE · CERTIFICATIONS</Eyebrow>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
            The certifications.
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your certification progress and choose a framework to work on
          </p>
        </div>
        <PillButton
          variant="outline"
          onClick={() => {
            refetch();
            refetchScores();
          }}
          disabled={loading || scoreLoading}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </PillButton>
      </div>

      {/* Readiness overview */}
      <CertificationReadinessHero
        summary={readinessSummary}
        loading={scoreLoading}
      />

      {/* Filters: a quiet inline row, search plus two mono text-link groups */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder="Search frameworks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="mr-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-studio-dim">
              Category
            </span>
            <button
              type="button"
              className={filterLinkClass(categoryFilter === 'all')}
              onClick={() => setCategoryFilter('all')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={filterLinkClass(categoryFilter === cat)}
                onClick={() =>
                  setCategoryFilter(categoryFilter === cat ? 'all' : cat)
                }
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <span className="mr-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-studio-dim">
            Status
          </span>
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={filterLinkClass(statusFilter === value)}
              onClick={() =>
                setStatusFilter(statusFilter === value ? 'all' : value)
              }
            >
              {label} ({statusCounts[value]})
            </button>
          ))}
        </div>
      </div>

      {/* Framework Cards */}
      {loading ? (
        <PageLoader message="Loading frameworks..." />
      ) : filteredFrameworks.length === 0 ? (
        <Panel className="p-8 text-center text-muted-foreground">
          <Award className="mx-auto mb-2 h-12 w-12 opacity-50" />
          <p>No frameworks match your filters.</p>
        </Panel>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredFrameworks.map((framework) => {
            const cert = certifications.find(
              (c) => c.framework_id === framework.id,
            );
            return (
              <FrameworkCard
                key={framework.id}
                framework={framework}
                certification={cert}
                onStart={openStartDialog}
              />
            );
          })}
        </div>
      )}

      {/* Start Certification Dialog (non-B Corp frameworks) */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Certification Journey</DialogTitle>
            <DialogDescription>
              Begin tracking your progress toward{' '}
              {frameworks.find((f) => f.id === selectedFramework)?.name}{' '}
              certification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target_date">
                Target Certification Date (Optional)
              </Label>
              <Input
                id="target_date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Set a target date to track your progress against
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStartDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleStartCertification} disabled={starting}>
              {starting ? 'Starting...' : 'Start Certification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
