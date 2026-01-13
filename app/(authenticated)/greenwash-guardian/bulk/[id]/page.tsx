"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  AlertTriangle,
  Globe,
  RefreshCw,
} from "lucide-react";
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
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "skipped":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-slate-500/20 text-slate-400 border-slate-500/30",
      processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      completed: "bg-green-500/20 text-green-400 border-green-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
      cancelled: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    };
    return (
      <Badge className={variants[status] || variants.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6">
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h3 className="text-lg font-medium text-white mb-2">Bulk Job Not Found</h3>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-xl bg-white/5">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/greenwash-guardian/history">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to History
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{job.title}</h1>
                <p className="text-slate-400">
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
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {job.completed_count + job.failed_count} of {job.total_urls} URLs processed
              </span>
              <span className="text-white font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />

            {currentUrl && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span>Processing: {currentUrl}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{job.completed_count}</div>
                <div className="text-sm text-slate-400">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{job.failed_count}</div>
                <div className="text-sm text-slate-400">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-400">
                  {job.total_urls - job.completed_count - job.failed_count}
                </div>
                <div className="text-sm text-slate-400">Pending</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4 border-t border-white/10">
              {job.status === "pending" && (
                <Button
                  onClick={handleStart}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              )}
              {job.status === "processing" && (
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              {(job.status === "completed" || job.status === "cancelled" || job.status === "failed") && (
                <>
                  <Button onClick={loadJob} variant="outline" className="border-white/10">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
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
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">URLs ({job.urls.length})</CardTitle>
            <CardDescription className="text-slate-400">
              List of all URLs in this bulk scan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">URL</TableHead>
                  <TableHead className="text-slate-400">Processed</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.urls.map((url) => (
                  <TableRow key={url.id} className="border-white/10">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(url.status)}
                        <span className="text-slate-300 capitalize">{url.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-md">
                        <Globe className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <span className="text-white truncate" title={url.url}>
                          {url.url}
                        </span>
                      </div>
                      {url.error_message && (
                        <p className="text-xs text-red-400 mt-1">{url.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {url.processed_at
                        ? format(new Date(url.processed_at), "MMM d, h:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {url.assessment_id && (
                        <Link href={`/greenwash-guardian/${url.assessment_id}`}>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
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
