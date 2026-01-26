"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FileCheck,
  FileClock,
  FileX,
  Eye,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Document {
  provenance_id: string;
  source_description: string;
  document_type: string;
  storage_object_path: string;
  verification_status: "unverified" | "verified" | "rejected";
  created_at: string;
}

interface SupplierEvidenceTabProps {
  supplierId: string;
}

export function SupplierEvidenceTab({ supplierId }: SupplierEvidenceTabProps) {
  const { currentOrganization } = useOrganization();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    description: "",
    documentType: "lca_report",
  });

  useEffect(() => {
    fetchDocuments();
  }, [supplierId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("data_provenance_trail")
        .select("*")
        .eq("organization_id", currentOrganization?.id)
        .like("storage_object_path", `%supplier-${supplierId}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDocuments(data || []);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error("File size must be less than 10MB");
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "image/jpeg",
        "image/png",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload PDF, Excel, CSV, or image files");
        return;
      }

      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !currentOrganization) {
      toast.error("Please select a file and provide a description");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to upload documents");
        return;
      }

      const fileExt = uploadForm.file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${currentOrganization.id}/supplier-${supplierId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-evidence")
        .upload(filePath, uploadForm.file);

      if (uploadError) {
        if (uploadError.message.includes("Bucket not found")) {
          throw new Error("Storage bucket not configured. Please contact support.");
        }
        throw uploadError;
      }

      const { error: dbError } = await supabase
        .from("data_provenance_trail")
        .insert({
          organization_id: currentOrganization.id,
          user_id: user.id,
          source_description: uploadForm.description,
          document_type: uploadForm.documentType,
          storage_object_path: filePath,
          verification_status: "unverified",
        });

      if (dbError) throw dbError;

      toast.success("Document uploaded successfully");
      setUploadDialogOpen(false);
      setUploadForm({ file: null, description: "", documentType: "lca_report" });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchDocuments();
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("supplier-evidence")
        .remove([documentToDelete.storage_object_path]);

      if (storageError && !storageError.message.includes("not found")) {
        console.warn("Storage deletion warning:", storageError);
      }

      const { error: dbError } = await supabase
        .from("data_provenance_trail")
        .delete()
        .eq("provenance_id", documentToDelete.provenance_id);

      if (dbError) throw dbError;

      toast.success("Document deleted successfully");
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      await fetchDocuments();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error(error.message || "Failed to delete document");
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-600 gap-1">
            <FileCheck className="h-3 w-3" />
            Verified
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <FileX className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <FileClock className="h-3 w-3" />
            Pending Review
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDocumentIcon = (type: string) => {
    return <FileText className="h-10 w-10 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>LCA Evidence & Documentation</CardTitle>
            <CardDescription>
              Environmental Product Declarations (EPDs), LCA reports, and certificates
            </CardDescription>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                No documents uploaded yet
              </p>
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.provenance_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {getDocumentIcon(doc.document_type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{doc.source_description}</h4>
                        {getVerificationBadge(doc.verification_status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="capitalize">{doc.document_type.replace(/_/g, " ")}</span>
                        <span>•</span>
                        <span>Uploaded {formatDate(doc.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDocumentToDelete(doc);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accepted Document Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Environmental Product Declarations (EPDs)</p>
                <p className="text-xs text-muted-foreground">ISO 14025 compliant EPDs</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Carbon Footprint Reports</p>
                <p className="text-xs text-muted-foreground">Full lifecycle assessment studies</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Carbon Footprint Certificates</p>
                <p className="text-xs text-muted-foreground">Product carbon footprint verification</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Sustainability Reports</p>
                <p className="text-xs text-muted-foreground">Annual sustainability disclosures</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload evidence documents from this supplier
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-type">Document Type</Label>
              <Select
                value={uploadForm.documentType}
                onValueChange={(value) => setUploadForm({ ...uploadForm, documentType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lca_report">Carbon Footprint Report</SelectItem>
                  <SelectItem value="epd">Environmental Product Declaration</SelectItem>
                  <SelectItem value="carbon_certificate">Carbon Certificate</SelectItem>
                  <SelectItem value="sustainability_report">Sustainability Report</SelectItem>
                  <SelectItem value="invoice">Invoice / Bill</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="e.g., EPD for Organic Sugar Cane 2024"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">File</Label>
              <Input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                required
              />
              {uploadForm.file && (
                <p className="text-xs text-muted-foreground">
                  Selected: {uploadForm.file.name} ({(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, Excel, CSV, JPG, PNG (max 10MB)
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs text-blue-900 dark:text-blue-100">
                Documents will be reviewed and verified by your team before being used in LCA calculations
              </p>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <Button onClick={handleUpload} disabled={uploading || !uploadForm.file || !uploadForm.description}>
                {uploading ? "Uploading..." : "Upload Document"}
              </Button>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{documentToDelete?.source_description}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
