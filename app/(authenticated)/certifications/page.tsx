'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Award, Search, Filter, RefreshCw } from 'lucide-react';
import { Eyebrow } from '@/components/studio';
import { CertificationReadinessHero } from '@/components/certifications/CertificationReadinessHero';
import { FrameworkCard } from '@/components/certifications/FrameworkCard';
import { useCertificationFrameworks } from '@/hooks/data/useCertificationFrameworks';
import { useCertificationScore } from '@/hooks/data/useCertificationScore';

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
        <Button
          variant="outline"
          onClick={() => {
            refetch();
            refetchScores();
          }}
          disabled={loading || scoreLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Readiness overview */}
      <CertificationReadinessHero
        summary={readinessSummary}
        loading={scoreLoading}
      />

      <Tabs defaultValue="frameworks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="frameworks" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Frameworks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="frameworks" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[200px] flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                    <Input
                      placeholder="Search frameworks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All ({statusCounts.all})
                    </SelectItem>
                    <SelectItem value="not_started">
                      Not Started ({statusCounts.not_started})
                    </SelectItem>
                    <SelectItem value="in_progress">
                      In Progress ({statusCounts.in_progress})
                    </SelectItem>
                    <SelectItem value="ready">
                      Ready ({statusCounts.ready})
                    </SelectItem>
                    <SelectItem value="certified">
                      Certified ({statusCounts.certified})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Framework Cards */}
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-6 w-24 rounded bg-secondary" />
                    <div className="mt-2 h-4 w-3/4 rounded bg-secondary" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 rounded bg-secondary" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredFrameworks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Award className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>No frameworks match your filters.</p>
              </CardContent>
            </Card>
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
        </TabsContent>
      </Tabs>

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
