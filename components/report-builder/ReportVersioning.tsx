'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  Clock,
  User,
  FileText,
  ChevronRight,
  RotateCcw,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useToast } from '@/hooks/use-toast';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface ReportVersioningProps {
  reportId?: string;
  currentConfig?: ReportConfig;
  onRestore?: (config: ReportConfig) => void;
}

interface ReportVersion {
  id: string;
  report_name: string;
  version: number;
  is_latest: boolean;
  changelog: string | null;
  config: any;
  status: string;
  document_url: string | null;
  created_at: string;
  created_by: string;
  profiles: {
    full_name: string;
  };
}

export function ReportVersioning({ reportId, currentConfig, onRestore }: ReportVersioningProps) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [showCreateVersionDialog, setShowCreateVersionDialog] = useState(false);
  const [newChangelog, setNewChangelog] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<[string, string] | null>(null);
  const supabase = getSupabaseBrowserClient();
  const { toast } = useToast();

  useEffect(() => {
    if (reportId) {
      loadVersionHistory();
    }
  }, [reportId]);

  async function loadVersionHistory() {
    setLoading(true);

    try {
      const { data: versionsData } = await supabase
        .from('generated_reports')
        .select(`
          id,
          report_name,
          version,
          is_latest,
          changelog,
          config,
          status,
          document_url,
          created_at,
          created_by,
          profiles (
            full_name
          )
        `)
        .or(`id.eq.${reportId},parent_report_id.eq.${reportId}`)
        .order('version', { ascending: false });

      setVersions(versionsData || []);
    } catch (error) {
      console.error('Error loading version history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateVersion() {
    if (!newChangelog.trim()) {
      toast({
        title: 'Error',
        description: 'Please describe what changed in this version',
        variant: 'destructive',
      });
      return;
    }

    if (!reportId || !currentConfig) {
      toast({
        title: 'Error',
        description: 'No report to create version from',
        variant: 'destructive',
      });
      return;
    }

    setCreatingVersion(true);

    try {
      const { data, error } = await supabase.rpc('create_report_version', {
        p_report_id: reportId,
        p_changelog: newChangelog,
        p_config: currentConfig,
      });

      if (error) throw error;

      toast({
        title: 'Version Created',
        description: 'A new version of the report has been created.',
      });

      setNewChangelog('');
      setShowCreateVersionDialog(false);
      loadVersionHistory();
    } catch (error) {
      console.error('Error creating version:', error);
      toast({
        title: 'Failed to Create Version',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setCreatingVersion(false);
    }
  }

  function handleRestoreVersion(version: ReportVersion) {
    if (onRestore) {
      onRestore(version.config);
      toast({
        title: 'Version Restored',
        description: `Configuration from version ${version.version} has been loaded.`,
      });
    }
  }

  function handleCompare(version1Id: string, version2Id: string) {
    setSelectedVersions([version1Id, version2Id]);
  }

  function getChangeIcon(changelog: string | null) {
    if (!changelog) return null;

    const lowerChangelog = changelog.toLowerCase();
    if (lowerChangelog.includes('fix') || lowerChangelog.includes('correct')) {
      return '🔧';
    }
    if (lowerChangelog.includes('add') || lowerChangelog.includes('new')) {
      return '✨';
    }
    if (lowerChangelog.includes('update') || lowerChangelog.includes('improve')) {
      return '📈';
    }
    if (lowerChangelog.includes('remove') || lowerChangelog.includes('delete')) {
      return '🗑️';
    }
    return '📝';
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!reportId) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Version history will be available once you generate your first report. Save your report configuration to begin tracking versions.
        </AlertDescription>
      </Alert>
    );
  }

  const latestVersion = versions.find((v) => v.is_latest);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="h-6 w-6 text-purple-600" />
              <div>
                <CardTitle>Version History</CardTitle>
                <CardDescription>
                  {versions.length} version{versions.length !== 1 ? 's' : ''} • Latest: v{latestVersion?.version || 1}
                </CardDescription>
              </div>
            </div>
            {currentConfig && (
              <Dialog open={showCreateVersionDialog} onOpenChange={setShowCreateVersionDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <GitBranch className="mr-2 h-4 w-4" />
                    Create New Version
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Report Version</DialogTitle>
                    <DialogDescription>
                      Document what changed in this version. This helps track report evolution over time.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="changelog">What Changed?</Label>
                      <Textarea
                        id="changelog"
                        placeholder="e.g., Updated emissions data for Q4, added new product LCAs, revised methodology section..."
                        value={newChangelog}
                        onChange={(e) => setNewChangelog(e.target.value)}
                        className="mt-2"
                        rows={4}
                      />
                    </div>
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        The current configuration will be saved as version {(latestVersion?.version || 0) + 1}
                      </AlertDescription>
                    </Alert>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateVersion} disabled={creatingVersion}>
                      {creatingVersion ? 'Creating Version...' : 'Create Version'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{versions.length}</div>
              <div className="text-sm text-muted-foreground">Total Versions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {versions.filter((v) => v.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Generated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">v{latestVersion?.version || 1}</div>
              <div className="text-sm text-muted-foreground">Current Version</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Version Timeline</CardTitle>
          <CardDescription>Chronological history of all report versions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {versions.length === 0 ? (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  No versions yet. Create your first version to start tracking changes.
                </AlertDescription>
              </Alert>
            ) : (
              versions.map((version, idx) => (
                <div key={version.id} className="relative">
                  {/* Timeline connector */}
                  {idx < versions.length - 1 && (
                    <div className="absolute left-[11px] top-10 bottom-0 w-0.5 bg-border" />
                  )}

                  <div className="flex gap-4">
                    {/* Version indicator */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          version.is_latest
                            ? 'bg-purple-600 text-white ring-4 ring-purple-100'
                            : 'bg-gray-300 text-gray-700'
                        }`}
                      >
                        {version.version}
                      </div>
                    </div>

                    {/* Version details */}
                    <Card className={`flex-1 ${version.is_latest ? 'border-purple-300 bg-purple-50/30' : ''}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">
                                {version.report_name} v{version.version}
                              </span>
                              {version.is_latest && (
                                <Badge className="bg-purple-600">Latest</Badge>
                              )}
                              {version.status === 'completed' && version.document_url && (
                                <Badge variant="outline">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Generated
                                </Badge>
                              )}
                            </div>

                            {version.changelog && (
                              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mb-3">
                                <span className="text-lg">{getChangeIcon(version.changelog)}</span>
                                <p className="text-sm flex-1">{version.changelog}</p>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {version.profiles?.full_name || 'Unknown'}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(version.created_at).toLocaleString()}
                              </div>
                            </div>

                            {/* Configuration summary */}
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {version.config?.sections?.length || 0} sections
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {version.config?.outputFormat?.toUpperCase() || 'N/A'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {version.config?.audience || 'N/A'}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {version.status === 'completed' && version.document_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(version.document_url!, '_blank')}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            )}
                            {onRestore && !version.is_latest && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRestoreVersion(version)}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Restore
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Version Comparison (Future Enhancement) */}
      {versions.length > 1 && (
        <Alert className="border-blue-200 bg-blue-50">
          <ChevronRight className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>Pro Tip:</strong> You can restore any previous version to reuse its configuration. This is useful when you want to regenerate a report with updated data but the same structure.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
