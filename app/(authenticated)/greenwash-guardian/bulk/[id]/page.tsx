"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Globe,
  RefreshCw,
} from "lucide-react";
import { StateChip } from "@/components/studio/state-chip";
import { BigNumber } from "@/components/studio/big-number";
import type { WorkingTone } from "@/components/studio/theme";
import {
  getBulkJobWithUrls,
  startBulkJob,
  cancelBulkJob,
  deleteBulkJob,
  getNextPendingUrl,
  processBulkJobUrl,
} from "@/lib/greenwash";
import type { GreenwashBulkJobWithUrls, GreenwashBulkJobUrl } from "@/lib/types/greenwash";
import { format } from "date-fns";
import { toast } from "sonner";

export default function BulkJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<GreenwashBulkJobWithUrls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    try {
      const data = await getBulkJobWithUrls(jobId);
      setJob(data);
    } catch (error) {
      console.error("Error loading bulk job:", error);
      toast.error("Failed to load bulk job");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  // Auto-refresh while processing
  useEffect(() => {
    if (job?.status === "processing" && !isProcessing) {
      const interval = setInterval(loadJob, 5000);
      return () => clearInterval(interval);
    }
  }, [job?.status, isProcessing, loadJob]);

  // Use ref to track cancellation to avoid stale closure issues
  const cancelledRef = useRef(false);

  async function handleStart() {
    if (!job) return;

    try {
      cancelledRef.current = false;
      setIsProcessing(true);
      await startBulkJob(job.id);
      await loadJob();

      // Process URLs one by one with small delay to avoid rate limiting
      let nextUrl = await getNextPendingUrl(job.id);
      while (nextUrl && !cancelledRef.current) {
        setCurrentUrl(nextUrl.url);
        await processBulkJobUrl(nextUrl, job.organization_id);
        await loadJob();

        // Small delay between requests to be respectful to target servers
        await new Promise(resolve => setTimeout(resolve, 1000));

        nextUrl = await getNextPendingUrl(job.id);
      }

      if (!cancelledRef.current) {
        toast.success("Bulk job completed");
      }
    } catch (error: unknown) {
      console.error("Error processing bulk job:", error);
      const message = error instanceof Error ? error.message : "Error processing bulk job";
      toast.error(message);
    } finally {
      setIsProcessing(false);
      setCurrentUrl(null);
      await loadJob();
    }
  }

  async function handleCancel() {
    if (!job) return;
    try {
      cancelledRef.current = true;
      setIsProcessing(false);
      await cancelBulkJob(job.id);
      await loadJob();
      toast.success("Bulk job cancelled");
    } catch (error) {
      console.error("Error cancelling bulk job:", error);
      toast.error("Failed to cancel bulk job");
    }
  }

  async function handleDelete() {
    if (!job || !confirm("Are you sure you want to delete this bulk job?")) return;
    try {
      await deleteBulkJob(job.id);
      toast.success("Bulk job deleted");
      router.push("/greenwash-guardian/history");
    } catch (error) {
      console.error("Error deleting bulk job:", error);
      toast.error("Failed to delete bulk job");
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-studio-good" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-studio-stale" />;
      case "processing":
        return <Clock className="h-4 w-4 text-studio-hold" />;
      case "skipped":
        return <AlertTriangle className="h-4 w-4 text-studio-attention" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const tones: Record<string, WorkingTone> = {
      pending: "quiet",
      processing: "hold",
      completed: "good",
      failed: "stale",
      cancelled: "attention",
    };
    return (
      <StateChip tone={tones[status] || "quiet"}>{status}</StateChip>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">Loading</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen p-6">
        <Card className="rounded-[6px]">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-studio-attention" />
            <h3 className="font-display text-lg font-medium text-foreground mb-2">Bulk job not found.</h3>
            <Link href="/greenwash-guardian">
              <Button>Back to Greenwash Guardian</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = job.total_urls > 0
    ? Math.round(((job.completed_count + job.failed_count) / job.total_urls) * 100)
    : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/greenwash-guardian/history">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to History
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="h-6 w-6 text-studio-brick" />
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">{job.title}</h1>
                <p className="text-muted-foreground">
                  Created {format(new Date(job.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(job.status)}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 space-y-6">
        {/* Progress Card */}
        <Card className="rounded-[6px]">
          <CardHeader className="pb-2">
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {job.completed_count + job.failed_count} of {job.total_urls} URLs processed
              </span>
              <span className="text-foreground font-medium tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />

            {currentUrl && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <StateChip tone="hold">Processing</StateChip>
                <span>{currentUrl}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-4">
              <BigNumber value={job.completed_count} label="COMPLETED" tone="good" className="text-center" />
              <BigNumber value={job.failed_count} label="FAILED" tone="stale" className="text-center" />
              <BigNumber
                value={job.total_urls - job.completed_count - job.failed_count}
                label="PENDING"
                className="text-center"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4 border-t border-border">
              {job.status === "pending" && (
                <Button
                  onClick={handleStart}
                  disabled={isProcessing}
                  className="bg-primary text-primary-foreground"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              )}
              {job.status === "processing" && (
                <Button
                  onClick={handleCancel}
                  variant="outline"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              {(job.status === "completed" || job.status === "cancelled" || job.status === "failed") && (
                <>
                  <Button onClick={loadJob} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="outline"
                    className="text-studio-stale hover:text-studio-stale"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* URLs Table */}
        <Card className="rounded-[6px]">
          <CardHeader>
            <CardTitle>URLs ({job.urls.length})</CardTitle>
            <CardDescription>
              List of all URLs in this bulk scan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.urls.map((url) => (
                  <TableRow key={url.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(url.status)}
                        <span className="text-foreground capitalize">{url.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-md">
                        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-foreground truncate" title={url.url}>
                          {url.url}
                        </span>
                      </div>
                      {url.error_message && (
                        <p className="text-xs text-studio-stale mt-1">{url.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {url.processed_at
                        ? format(new Date(url.processed_at), "MMM d, h:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {url.assessment_id && (
                        <Link href={`/greenwash-guardian/${url.assessment_id}`}>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                            View Report
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
