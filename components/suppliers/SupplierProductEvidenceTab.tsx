"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload,
  FileText,
  FileCheck,
  FileClock,
  FileX,
  Trash2,
  ExternalLink,
  Cloud,
  Droplets,
  Trash,
  Leaf,
  Shield,
  Download,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useSupplierProductEvidence } from "@/hooks/data/useSupplierProductEvidence";
import {
  type EvidenceType,
  type EvidenceFormData,
  type SupplierProductEvidence,
  EVIDENCE_TYPE_LABELS,
} from "@/lib/types/supplier-product";
import { formatDistanceToNow } from "date-fns";

interface SupplierProductEvidenceTabProps {
  supplierProductId?: string;
  platformSupplierProductId?: string;
  organizationId?: string;
  productName: string;
  canVerify?: boolean;
  canUpload?: boolean;
}

const EVIDENCE_TYPE_ICONS: Record<EvidenceType, React.ElementType> = {
  epd: FileCheck,
  lca_report: FileText,
  carbon_certificate: Shield,
  water_certificate: Droplets,
  third_party_verification: Shield,
  supplier_declaration: FileText,
  test_report: FileText,
  certification: Shield,
  invoice: FileText,
  specification_sheet: FileText,
  other: FileText,
};

export function SupplierProductEvidenceTab({
  supplierProductId,
  platformSupplierProductId,
  organizationId,
  productName,
  canVerify = false,
  canUpload = true,
}: SupplierProductEvidenceTabProps) {
  const {
    evidence,
    coverage,
    verificationBodies,
    loading,
    error,
    uploadEvidence,
    verifyEvidence,
    rejectEvidence,
    deleteEvidence,
  } = useSupplierProductEvidence({
    supplierProductId,
    platformSupplierProductId,
    organizationId,
  });

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<SupplierProductEvidence | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<EvidenceFormData>({
    evidence_type: "epd",
    document_name: "",
    document_description: "",
    covers_climate: true,
    covers_water: false,
    covers_waste: false,
    covers_land: false,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      return;
    }

    setSelectedFile(file);
    if (!formData.document_name) {
      setFormData((prev) => ({ ...prev, document_name: file.name }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await uploadEvidence(selectedFile, formData);
      setUploadDialogOpen(false);
      resetForm();
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedEvidence) return;
    await verifyEvidence(selectedEvidence.id, verifyNotes);
    setVerifyDialogOpen(false);
    setSelectedEvidence(null);
    setVerifyNotes("");
  };

  const handleReject = async () => {
    if (!selectedEvidence || !rejectReason.trim()) return;
    await rejectEvidence(selectedEvidence.id, rejectReason);
    setRejectDialogOpen(false);
    setSelectedEvidence(null);
    setRejectReason("");
  };

  const handleDelete = async () => {
    if (!selectedEvidence) return;
    await deleteEvidence(selectedEvidence.id);
    setDeleteDialogOpen(false);
    setSelectedEvidence(null);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      evidence_type: "epd",
      document_name: "",
      document_description: "",
      covers_climate: true,
      covers_water: false,
      covers_waste: false,
      covers_land: false,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <FileCheck className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <FileX className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <FileClock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
    }
  };

  const getCategoryBadges = (doc: SupplierProductEvidence) => {
    const badges = [];
    if (doc.covers_climate)
      badges.push(
        <TooltipProvider key="climate">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1 rounded bg-blue-100 dark:bg-blue-900">
                <Cloud className="h-3 w-3 text-blue-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Covers Climate Impact</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    if (doc.covers_water)
      badges.push(
        <TooltipProvider key="water">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1 rounded bg-cyan-100 dark:bg-cyan-900">
                <Droplets className="h-3 w-3 text-cyan-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Covers Water Impact</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    if (doc.covers_waste)
      badges.push(
        <TooltipProvider key="waste">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1 rounded bg-amber-100 dark:bg-amber-900">
                <Trash className="h-3 w-3 text-amber-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Covers Waste & Circularity</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    if (doc.covers_land)
      badges.push(
        <TooltipProvider key="land">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-900">
                <Leaf className="h-3 w-3 text-emerald-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Covers Land & Biodiversity</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    return badges;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Coverage Summary */}
      {coverage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evidence Coverage</CardTitle>
            <CardDescription>
              {coverage.has_verified_evidence
                ? "Impact claims are supported by verified evidence"
                : "Upload evidence to support your impact claims"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div
                className={`p-3 rounded-lg border ${
                  coverage.climate_covered
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Cloud
                    className={`h-4 w-4 ${
                      coverage.climate_covered ? "text-blue-600" : "text-gray-400"
                    }`}
                  />
                  <span className="text-sm font-medium">Climate</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {coverage.climate_covered ? "Verified" : "Not covered"}
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  coverage.water_covered
                    ? "bg-cyan-50 border-cyan-200 dark:bg-cyan-950 dark:border-cyan-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Droplets
                    className={`h-4 w-4 ${
                      coverage.water_covered ? "text-cyan-600" : "text-gray-400"
                    }`}
                  />
                  <span className="text-sm font-medium">Water</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {coverage.water_covered ? "Verified" : "Not covered"}
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  coverage.waste_covered
                    ? "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Trash
                    className={`h-4 w-4 ${
                      coverage.waste_covered ? "text-amber-600" : "text-gray-400"
                    }`}
                  />
                  <span className="text-sm font-medium">Waste</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {coverage.waste_covered ? "Verified" : "Not covered"}
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  coverage.land_covered
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Leaf
                    className={`h-4 w-4 ${
                      coverage.land_covered ? "text-emerald-600" : "text-gray-400"
                    }`}
                  />
                  <span className="text-sm font-medium">Land</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {coverage.land_covered ? "Verified" : "Not covered"}
                </p>
              </div>
            </div>

            {coverage.earliest_expiry && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    Earliest evidence expiry:{" "}
                    {new Date(coverage.earliest_expiry).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Button */}
      {canUpload && (
        <div className="flex justify-end">
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Evidence
          </Button>
        </div>
      )}

      {/* Evidence List */}
      {evidence.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No evidence uploaded</h3>
            <p className="text-muted-foreground mb-4">
              Upload EPDs, LCA reports, or other documentation to support your impact claims.
            </p>
            {canUpload && (
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {evidence.map((doc) => {
            const Icon = EVIDENCE_TYPE_ICONS[doc.evidence_type as EvidenceType] || FileText;
            return (
              <Card key={doc.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{doc.document_name}</h4>
                          {getStatusBadge(doc.verification_status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {EVIDENCE_TYPE_LABELS[doc.evidence_type as EvidenceType]}
                        </p>
                        <div className="flex items-center gap-2 mb-2">
                          {getCategoryBadges(doc)}
                        </div>
                        {doc.document_description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {doc.document_description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {doc.verifier_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {doc.verifier_name}
                            </span>
                          )}
                          {doc.document_expiry && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires:{" "}
                              {new Date(doc.document_expiry).toLocaleDateString("en-GB")}
                            </span>
                          )}
                          <span>
                            Uploaded{" "}
                            {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {doc.rejection_reason && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300">
                            <strong>Rejection reason:</strong> {doc.rejection_reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.document_url && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(doc.document_url!, "_blank")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {canVerify && doc.verification_status === "pending" && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-emerald-600 hover:text-emerald-700"
                                  onClick={() => {
                                    setSelectedEvidence(doc);
                                    setVerifyDialogOpen(true);
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Verify</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedEvidence(doc);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reject</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                      {doc.verification_status !== "verified" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  setSelectedEvidence(doc);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Evidence</DialogTitle>
            <DialogDescription>
              Upload documentation to support the impact data for {productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="evidence_type">Document Type *</Label>
              <Select
                value={formData.evidence_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, evidence_type: value as EvidenceType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVIDENCE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>File *</Label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4">
                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select File
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      PDF, Excel, CSV, or images up to 20MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_name">Document Name *</Label>
              <Input
                id="document_name"
                value={formData.document_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, document_name: e.target.value }))
                }
                placeholder="e.g., Product EPD - Sugar Cane 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_description">Description</Label>
              <Textarea
                id="document_description"
                value={formData.document_description || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, document_description: e.target.value }))
                }
                placeholder="Additional details about this document..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Impact Categories Covered *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select which impact claims this evidence supports
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="covers_climate"
                    checked={formData.covers_climate}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, covers_climate: checked as boolean }))
                    }
                  />
                  <Label htmlFor="covers_climate" className="flex items-center gap-1 cursor-pointer">
                    <Cloud className="h-4 w-4 text-blue-600" />
                    Climate
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="covers_water"
                    checked={formData.covers_water}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, covers_water: checked as boolean }))
                    }
                  />
                  <Label htmlFor="covers_water" className="flex items-center gap-1 cursor-pointer">
                    <Droplets className="h-4 w-4 text-cyan-600" />
                    Water
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="covers_waste"
                    checked={formData.covers_waste}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, covers_waste: checked as boolean }))
                    }
                  />
                  <Label htmlFor="covers_waste" className="flex items-center gap-1 cursor-pointer">
                    <Trash className="h-4 w-4 text-amber-600" />
                    Waste
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="covers_land"
                    checked={formData.covers_land}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, covers_land: checked as boolean }))
                    }
                  />
                  <Label htmlFor="covers_land" className="flex items-center gap-1 cursor-pointer">
                    <Leaf className="h-4 w-4 text-emerald-600" />
                    Land
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document_date">Document Date</Label>
                <Input
                  id="document_date"
                  type="date"
                  value={formData.document_date || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, document_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_expiry">Expiry Date</Label>
                <Input
                  id="document_expiry"
                  type="date"
                  value={formData.document_expiry || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, document_expiry: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verifier_name">Verification Body (if applicable)</Label>
              <Select
                value={formData.verifier_body_id || "custom"}
                onValueChange={(value) => {
                  if (value === "custom") {
                    setFormData((prev) => ({ ...prev, verifier_body_id: undefined }));
                  } else {
                    const body = verificationBodies.find((b) => b.id === value);
                    setFormData((prev) => ({
                      ...prev,
                      verifier_body_id: value,
                      verifier_name: body?.name || "",
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or enter custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Enter manually</SelectItem>
                  {verificationBodies.map((body) => (
                    <SelectItem key={body.id} value={body.id}>
                      {body.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.verifier_body_id && (
                <Input
                  className="mt-2"
                  placeholder="Enter verification body name"
                  value={formData.verifier_name || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, verifier_name: e.target.value }))
                  }
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                uploading ||
                !selectedFile ||
                !formData.document_name ||
                (!formData.covers_climate &&
                  !formData.covers_water &&
                  !formData.covers_waste &&
                  !formData.covers_land)
              }
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Evidence</DialogTitle>
            <DialogDescription>
              Confirm that {selectedEvidence?.document_name} meets verification requirements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify_notes">Verification Notes (optional)</Label>
              <Textarea
                id="verify_notes"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Add any notes about the verification..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerify} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Evidence</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedEvidence?.document_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject_reason">Rejection Reason *</Label>
              <Textarea
                id="reject_reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this evidence is being rejected..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evidence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedEvidence?.document_name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
