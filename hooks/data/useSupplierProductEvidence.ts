import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import type {
  SupplierProductEvidence,
  EvidenceCoverageSummary,
  VerificationBody,
  EvidenceFormData,
  EvidenceVerificationStatus,
} from "@/lib/types/supplier-product";

export type { SupplierProductEvidence, EvidenceCoverageSummary, VerificationBody };

interface UseSupplierProductEvidenceOptions {
  supplierProductId?: string;
  platformSupplierProductId?: string;
  organizationId?: string;
}

export function useSupplierProductEvidence(options: UseSupplierProductEvidenceOptions) {
  const { supplierProductId, platformSupplierProductId, organizationId } = options;

  const [evidence, setEvidence] = useState<SupplierProductEvidence[]>([]);
  const [coverage, setCoverage] = useState<EvidenceCoverageSummary | null>(null);
  const [verificationBodies, setVerificationBodies] = useState<VerificationBody[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch evidence for the product
  const fetchEvidence = useCallback(async () => {
    if (!supplierProductId && !platformSupplierProductId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("supplier_product_evidence")
        .select("*")
        .order("created_at", { ascending: false });

      if (supplierProductId) {
        query = query.eq("supplier_product_id", supplierProductId);
      } else if (platformSupplierProductId) {
        query = query.eq("platform_supplier_product_id", platformSupplierProductId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setEvidence(data || []);

      // Calculate coverage summary
      if (data && data.length > 0) {
        const verifiedDocs = data.filter((d) => d.verification_status === "verified");
        const coverageSummary: EvidenceCoverageSummary = {
          has_any_evidence: data.length > 0,
          has_verified_evidence: verifiedDocs.length > 0,
          total_documents: data.length,
          verified_documents: verifiedDocs.length,
          pending_documents: data.filter((d) => d.verification_status === "pending").length,
          climate_covered: verifiedDocs.some((d) => d.covers_climate),
          water_covered: verifiedDocs.some((d) => d.covers_water),
          waste_covered: verifiedDocs.some((d) => d.covers_waste),
          land_covered: verifiedDocs.some((d) => d.covers_land),
          evidence_types: Array.from(new Set(verifiedDocs.map((d) => d.evidence_type))),
          earliest_expiry: verifiedDocs
            .filter((d) => d.document_expiry)
            .sort((a, b) => new Date(a.document_expiry!).getTime() - new Date(b.document_expiry!).getTime())[0]
            ?.document_expiry || null,
        };
        setCoverage(coverageSummary);
      } else {
        setCoverage({
          has_any_evidence: false,
          has_verified_evidence: false,
          total_documents: 0,
          verified_documents: 0,
          pending_documents: 0,
          climate_covered: false,
          water_covered: false,
          waste_covered: false,
          land_covered: false,
          evidence_types: [],
          earliest_expiry: null,
        });
      }
    } catch (err: any) {
      console.error("Error fetching evidence:", err);
      setError(err.message || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [supplierProductId, platformSupplierProductId]);

  // Fetch verification bodies reference data
  const fetchVerificationBodies = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("verification_bodies")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (fetchError) throw fetchError;

      setVerificationBodies(data || []);
    } catch (err: any) {
      console.error("Error fetching verification bodies:", err);
    }
  }, []);

  // Upload evidence
  const uploadEvidence = async (
    file: File,
    formData: EvidenceFormData
  ): Promise<SupplierProductEvidence | null> => {
    if (!supplierProductId && !platformSupplierProductId) {
      toast.error("No product selected");
      return null;
    }

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Determine storage path
      const productId = supplierProductId || platformSupplierProductId;
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = organizationId
        ? `${organizationId}/products/${productId}/${timestamp}-${sanitizedFileName}`
        : `platform/products/${productId}/${timestamp}-${sanitizedFileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("supplier-product-evidence")
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("supplier-product-evidence").getPublicUrl(storagePath);

      // Create evidence record
      const evidenceRecord = {
        supplier_product_id: supplierProductId || null,
        platform_supplier_product_id: platformSupplierProductId || null,
        organization_id: organizationId || null,
        evidence_type: formData.evidence_type,
        document_name: formData.document_name,
        document_description: formData.document_description || null,
        document_url: publicUrl,
        storage_object_path: storagePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        covers_climate: formData.covers_climate,
        covers_water: formData.covers_water,
        covers_waste: formData.covers_waste,
        covers_land: formData.covers_land,
        document_date: formData.document_date || null,
        document_expiry: formData.document_expiry || null,
        document_reference_number: formData.document_reference_number || null,
        verifier_body_id: formData.verifier_body_id || null,
        verifier_name: formData.verifier_name || null,
        verification_standard: formData.verification_standard || null,
        verification_date: formData.verification_date || null,
        verification_expiry: formData.verification_expiry || null,
        verification_status: "pending" as EvidenceVerificationStatus,
        uploaded_by: user.id,
      };

      const { data, error: insertError } = await supabase
        .from("supplier_product_evidence")
        .insert([evidenceRecord])
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success("Evidence uploaded successfully");
      await fetchEvidence();
      return data;
    } catch (err: any) {
      console.error("Error uploading evidence:", err);
      toast.error(err.message || "Failed to upload evidence");
      return null;
    }
  };

  // Update evidence
  const updateEvidence = async (
    evidenceId: string,
    updates: Partial<SupplierProductEvidence>
  ): Promise<SupplierProductEvidence | null> => {
    try {
      const { data, error } = await supabase
        .from("supplier_product_evidence")
        .update(updates)
        .eq("id", evidenceId)
        .select()
        .single();

      if (error) throw error;

      toast.success("Evidence updated successfully");
      await fetchEvidence();
      return data;
    } catch (err: any) {
      console.error("Error updating evidence:", err);
      toast.error(err.message || "Failed to update evidence");
      return null;
    }
  };

  // Verify evidence (internal verification)
  const verifyEvidence = async (
    evidenceId: string,
    notes?: string
  ): Promise<SupplierProductEvidence | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("supplier_product_evidence")
        .update({
          verification_status: "verified" as EvidenceVerificationStatus,
          internal_verified_by: user.id,
          internal_verified_at: new Date().toISOString(),
          internal_verification_notes: notes || null,
        })
        .eq("id", evidenceId)
        .select()
        .single();

      if (error) throw error;

      toast.success("Evidence verified successfully");
      await fetchEvidence();
      return data;
    } catch (err: any) {
      console.error("Error verifying evidence:", err);
      toast.error(err.message || "Failed to verify evidence");
      return null;
    }
  };

  // Reject evidence
  const rejectEvidence = async (
    evidenceId: string,
    reason: string
  ): Promise<SupplierProductEvidence | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("supplier_product_evidence")
        .update({
          verification_status: "rejected" as EvidenceVerificationStatus,
          internal_verified_by: user.id,
          internal_verified_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", evidenceId)
        .select()
        .single();

      if (error) throw error;

      toast.success("Evidence rejected");
      await fetchEvidence();
      return data;
    } catch (err: any) {
      console.error("Error rejecting evidence:", err);
      toast.error(err.message || "Failed to reject evidence");
      return null;
    }
  };

  // Delete evidence
  const deleteEvidence = async (evidenceId: string): Promise<boolean> => {
    try {
      // First get the evidence to find the storage path
      const { data: evidenceData, error: fetchError } = await supabase
        .from("supplier_product_evidence")
        .select("storage_object_path, verification_status")
        .eq("id", evidenceId)
        .single();

      if (fetchError) throw fetchError;

      if (evidenceData.verification_status === "verified") {
        toast.error("Cannot delete verified evidence");
        return false;
      }

      // Delete from storage if path exists
      if (evidenceData.storage_object_path) {
        const { error: storageError } = await supabase.storage
          .from("supplier-product-evidence")
          .remove([evidenceData.storage_object_path]);

        if (storageError) {
          console.warn("Failed to delete file from storage:", storageError);
        }
      }

      // Delete the record
      const { error: deleteError } = await supabase
        .from("supplier_product_evidence")
        .delete()
        .eq("id", evidenceId);

      if (deleteError) throw deleteError;

      toast.success("Evidence deleted successfully");
      await fetchEvidence();
      return true;
    } catch (err: any) {
      console.error("Error deleting evidence:", err);
      toast.error(err.message || "Failed to delete evidence");
      return false;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEvidence();
    fetchVerificationBodies();
  }, [fetchEvidence, fetchVerificationBodies]);

  return {
    evidence,
    coverage,
    verificationBodies,
    loading,
    error,
    refetch: fetchEvidence,
    uploadEvidence,
    updateEvidence,
    verifyEvidence,
    rejectEvidence,
    deleteEvidence,
  };
}

// Hook to get evidence coverage for a product (lightweight version)
export function useEvidenceCoverage(supplierProductId: string | undefined) {
  const [coverage, setCoverage] = useState<EvidenceCoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierProductId) {
      setLoading(false);
      return;
    }

    const fetchCoverage = async () => {
      try {
        const { data, error } = await supabase.rpc("get_evidence_coverage", {
          p_supplier_product_id: supplierProductId,
        });

        if (error) throw error;

        setCoverage(data);
      } catch (err) {
        console.error("Error fetching evidence coverage:", err);
        setCoverage(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCoverage();
  }, [supplierProductId]);

  return { coverage, loading };
}
