'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Award,
  Search,
  Filter,
  RefreshCw,
  Target,
  FileText,
  Package,
} from 'lucide-react';
import { CertificationReadinessHero } from '@/components/certifications/CertificationReadinessHero';
import { EvidenceLibrary } from '@/components/certifications/EvidenceLibrary';
import { AuditPackageManager } from '@/components/certifications/AuditPackageManager';
import { FrameworkCard } from '@/components/certifications/FrameworkCard';
import { useCertificationFrameworks } from '@/hooks/data/useCertificationFrameworks';
import { useCertificationScore } from '@/hooks/data/useCertificationScore';

export default function CertificationsPage() {
  const { frameworks, certifications, loading, startCertification, refetch } =
    useCertificationFrameworks(true);
  const { readinessSummary, loading: scoreLoading } = useCertificationScore();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [starting, setStarting] = useState(false);

  // Get unique categories
  const categories = Array.from(new Set(frameworks.map(f => f.category)));

  // Filter frameworks
  const filteredFrameworks = frameworks.filter(framework => {
    const cert = certifications.find(c => c.framework_id === framework.id);
    const matchesSearch =
      !searchTerm ||
      framework.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      framework.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || framework.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'all' || (cert?.status || 'not_started') === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleStartCertification = async () => {
    if (!selectedFramework) return;
    setStarting(true);
    try {
      await startCertification(selectedFramework, targetDate || undefined);
      setStartDialogOpen(false);
      setSelectedFramework(null);
      setTargetDate('');
    } finally {
      setStarting(false);
    }
  };

  const openStartDialog = (frameworkId: string) => {
    setSelectedFramework(frameworkId);
    setStartDialogOpen(true);
  };

  // Count frameworks by status
  const statusCounts = {
    all: frameworks.length,
    not_started: frameworks.filter(f => !certifications.find(c => c.framework_id === f.id)).length,
    in_progress: certifications.filter(c => c.status === 'in_progress').length,
    ready: certifications.filter(c => c.status === 'ready').length,
    certified: certifications.filter(c => c.status === 'certified').length,
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-600" />
            Certifications Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your sustainability certifications
          </p>
        </div>
        <Button variant="outline" onClick={refetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Readiness Hero */}
      <CertificationReadinessHero summary={readinessSummary} loading={scoreLoading} />

      {/* Tabs for different views */}
      <Tabs defaultValue="frameworks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="frameworks" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Frameworks
          </TabsTrigger>
          <TabsTrigger value="gap-analysis" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Gap Analysis
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="audit-packages" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Audit Packages
          </TabsTrigger>
        </TabsList>

        {/* Frameworks Tab */}
        <TabsContent value="frameworks" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search frameworks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
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
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({statusCounts.all})</SelectItem>
                    <SelectItem value="not_started">
                      Not Started ({statusCounts.not_started})
                    </SelectItem>
                    <SelectItem value="in_progress">
                      In Progress ({statusCounts.in_progress})
                    </SelectItem>
                    <SelectItem value="ready">Ready ({statusCounts.ready})</SelectItem>
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
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredFrameworks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No frameworks match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredFrameworks.map((framework) => {
                const cert = certifications.find(c => c.framework_id === framework.id);
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

        {/* Gap Analysis Tab */}
        <TabsContent value="gap-analysis">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Gap Analysis
              </CardTitle>
              <CardDescription>
                Select a framework to view and manage gap analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a framework from the Frameworks tab to perform gap analysis.</p>
                <p className="text-sm mt-1">
                  Gap analysis helps identify requirements you need to meet for certification.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence">
          <EvidenceLibrary />
        </TabsContent>

        {/* Audit Packages Tab */}
        <TabsContent value="audit-packages">
          <AuditPackageManager />
        </TabsContent>
      </Tabs>

      {/* Start Certification Dialog */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Certification Journey</DialogTitle>
            <DialogDescription>
              Begin tracking your progress toward{' '}
              {frameworks.find(f => f.id === selectedFramework)?.name} certification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target_date">Target Certification Date (Optional)</Label>
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
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>
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
