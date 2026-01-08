"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  Download,
  Trash2,
  RefreshCw
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface SpendImportCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  onUpdate?: () => void;
}

interface ImportBatch {
  id: string;
  filename: string;
  total_rows: number;
  processed_rows: number;
  approved_rows: number;
  rejected_rows: number;
  status: string;
  created_at: string;
  error_message?: string | null;
}

const STUCK_THRESHOLD_MINUTES = 5;

export function SpendImportCard({ reportId, organizationId, year, onUpdate }: SpendImportCardProps) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBatches();
  }, [reportId]);

  const isStuckBatch = (batch: ImportBatch): boolean => {
    if (batch.status !== "uploading" && batch.status !== "processing") return false;
    const createdAt = new Date(batch.created_at).getTime();
    const now = Date.now();
    const minutesElapsed = (now - createdAt) / (1000 * 60);
    return minutesElapsed > STUCK_THRESHOLD_MINUTES;
  };

  const deleteBatch = async (batchId: string) => {
    try {
      setIsDeleting(true);
      const supabase = getSupabaseBrowserClient();

      const { error: itemsError } = await supabase
        .from("spend_import_items")
        .delete()
        .eq("batch_id", batchId);

      if (itemsError) {
        console.error("Error deleting items:", itemsError);
      }

      const { error: batchError } = await supabase
        .from("spend_import_batches")
        .delete()
        .eq("id", batchId);

      if (batchError) throw batchError;

      toast.success("Upload cancelled and cleaned up");
      fetchBatches();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to cancel upload");
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("spend_import_batches")
        .select("*")
        .eq("report_id", reportId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setBatches(data || []);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    await parseAndUploadFile(file);
  };

  const parseAndUploadFile = async (file: File) => {
    let createdBatchId: string | null = null;

    try {
      setIsUploading(true);
      setUploadProgress(10);

      const supabase = getSupabaseBrowserClient();

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

      if (jsonData.length === 0) {
        throw new Error("File is empty");
      }

      setUploadProgress(30);

      const { data: batch, error: batchError } = await supabase
        .from("spend_import_batches")
        .insert({
          organization_id: organizationId,
          report_id: reportId,
          filename: file.name,
          total_rows: jsonData.length,
          status: "uploading",
        })
        .select()
        .single();

      if (batchError) throw batchError;

      createdBatchId = batch.id;
      setUploadProgress(50);

      const items = jsonData.map((row: any, index: number) => {
        const description =
          row.description ||
          row.Description ||
          row.item ||
          row.Item ||
          row.vendor ||
          row.Vendor ||
          row.supplier ||
          row.Supplier ||
          row.Merchant ||
          row.merchant ||
          row.Note ||
          row.note ||
          "";

        const amount =
          parseFloat(
            String(row.amount || row.Amount || row.spend || row.Spend || row.cost || row.Cost || row.Total || row.total || "0")
              .replace(/[^0-9.-]/g, "")
          ) || 0;

        const currency = row.currency || row.Currency || "GBP";

        let date = null;
        const dateField = row.date || row.Date || row.transaction_date || row["Transaction Date"] || row["Created (UTC)"];
        if (dateField) {
          const parsedDate = new Date(dateField);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString().split("T")[0];
          }
        }

        return {
          batch_id: batch.id,
          row_number: index + 1,
          raw_description: String(description).substring(0, 1000).trim(),
          raw_amount: Math.abs(amount),
          raw_currency: currency,
          raw_date: date,
          raw_vendor: String(row.vendor || row.Vendor || row.Merchant || row.merchant || "").substring(0, 500).trim() || null,
          raw_category: String(row.category || row.Category || "").substring(0, 200).trim() || null,
        };
      });

      const chunkSize = 100;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const { error: itemsError } = await supabase.from("spend_import_items").insert(chunk);

        if (itemsError) {
          console.error("Error inserting chunk:", itemsError);
          throw new Error(`Failed to insert items: ${itemsError.message}`);
        }

        setUploadProgress(50 + ((i + chunk.length) / items.length) * 30);
      }

      await supabase
        .from("spend_import_batches")
        .update({ status: "processing" })
        .eq("id", batch.id);

      setUploadProgress(90);

      await triggerAICategorization(batch.id);

      setUploadProgress(100);

      toast.success(`Uploaded ${items.length} items. AI categorisation in progress...`);
      fetchBatches();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error uploading file:", error);

      if (createdBatchId) {
        try {
          const supabase = getSupabaseBrowserClient();
          await supabase.from("spend_import_items").delete().eq("batch_id", createdBatchId);
          await supabase.from("spend_import_batches").delete().eq("id", createdBatchId);
          console.log("Cleaned up failed batch:", createdBatchId);
        } catch (cleanupError) {
          console.error("Failed to clean up batch:", cleanupError);
        }
      }

      toast.error(error.message || "Failed to upload file");
      fetchBatches();
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const triggerAICategorization = async (batchId: string) => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      console.log('Triggering AI categorization for batch:', batchId);

      const response = await fetch(`${supabaseUrl}/functions/v1/categorise-spend-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ batch_id: batchId }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = responseData.error || `AI categorisation failed with status ${response.status}`;
        const needsSetup = responseData.needsSetup;

        console.error("AI categorization error:", {
          userMessage: errorMsg,
          technicalError: responseData.technicalError,
          needsSetup
        });

        fetchBatches();
        onUpdate?.();

        if (needsSetup) {
          toast.warning("AI categorization is not configured. Items uploaded successfully - manual categorization required.");
        } else {
          toast.error(errorMsg);
        }

        return;
      }

      console.log('AI categorization completed:', responseData);

      if (responseData.hasAIError) {
        toast.warning("Items uploaded successfully. AI categorization unavailable - manual review required.");
      } else if (responseData.ai_disabled) {
        toast.info("Items uploaded successfully. AI categorization disabled - manual review required.");
      } else {
        toast.success("AI categorisation completed. Review categorisations and approve.");
      }

      fetchBatches();
      onUpdate?.();
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Failed to trigger AI categorization";
      console.error("Error triggering AI categorization:", error);
      toast.error(errorMessage);

      fetchBatches();
      onUpdate?.();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "uploading":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading</Badge>;
      case "processing":
        return <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1 animate-pulse" />AI Processing</Badge>;
      case "ready_for_review":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"><AlertCircle className="h-3 w-3 mr-1" />Ready for Review</Badge>;
      case "partially_imported":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"><AlertCircle className="h-3 w-3 mr-1" />Partially Imported</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        description: "Example: Flight to New York",
        amount: 450.00,
        currency: "GBP",
        date: "2024-01-15",
        vendor: "British Airways",
        category: "",
      },
      {
        description: "Example: Office supplies",
        amount: 125.50,
        currency: "GBP",
        date: "2024-02-20",
        vendor: "Staples",
        category: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `spend-import-template-${year}.xlsx`);
    toast.success("Template downloaded");
  };

  const latestBatch = batches[0];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <CardTitle>Accounts Import</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" />
            Template
          </Button>
        </div>
        <CardDescription>
          Upload your expense data from accounting systems, credit card statements, or procurement records.
          Our AI automatically analyses each transaction and assigns it to the correct GHG Protocol Scope 3 category
          (Business Travel, Purchased Services, Capital Goods, etc.) with confidence scoring to ensure accuracy.
          Review and approve categorisations before importing to your footprint.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isUploading ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {uploadProgress < 50 ? "Uploading file..." : uploadProgress < 90 ? "Processing data..." : "Finalising..."}
            </p>
          </div>
        ) : latestBatch && latestBatch.status !== "completed" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">{latestBatch.filename}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {latestBatch.processed_rows} / {latestBatch.total_rows} items processed
                </p>
              </div>
              {getStatusBadge(latestBatch.status)}
            </div>

            {latestBatch.status === "failed" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {latestBatch.error_message || "Upload failed. Please try again."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => deleteBatch(latestBatch.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Failed Upload
                </Button>
              </div>
            )}

            {(latestBatch.status === "uploading" || latestBatch.status === "processing") && isStuckBatch(latestBatch) && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    This upload appears to be stuck. You can cancel it and try again.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => deleteBatch(latestBatch.id)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Cancel Upload
                  </Button>
                  <Button
                    variant="outline"
                    onClick={fetchBatches}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            )}

            {latestBatch.status === "processing" && !isStuckBatch(latestBatch) && (
              <Progress value={(latestBatch.processed_rows / latestBatch.total_rows) * 100} className="h-2" />
            )}

            {latestBatch.status === "uploading" && !isStuckBatch(latestBatch) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Preparing data for AI categorisation...</span>
              </div>
            )}

            {latestBatch.status === "ready_for_review" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">
                      {latestBatch.approved_rows}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">Approved</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {latestBatch.total_rows - latestBatch.approved_rows - latestBatch.rejected_rows}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Pending</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950">
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">
                      {latestBatch.rejected_rows}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">Rejected</p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => window.location.href = `/data/spend-import/${latestBatch.id}`}>
                  Review & Approve Items
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Upload Spend Data</p>
              <p className="text-xs text-muted-foreground mb-4">
                CSV or Excel file (max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>

            {batches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Recent Imports</p>
                {batches.slice(0, 3).map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileSpreadsheet className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate text-xs">{batch.filename}</span>
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              AI automatically categorises expenses into GHG Protocol categories with confidence scores. Review and approve before importing.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
