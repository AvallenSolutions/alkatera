/**
 * Governance Policy Client Library
 */

import { supabase } from '@/lib/supabaseClient';

export interface PolicyAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploaded_at: string;
}

/**
 * Upload a policy document to storage
 */
export async function uploadPolicyDocument(
  organizationId: string,
  file: File
): Promise<PolicyAttachment> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${organizationId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('policy-documents')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading policy document:', uploadError);
    throw uploadError;
  }

  // Use signed URL since the bucket is private
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('policy-documents')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (signedUrlError) {
    console.error('Error creating signed URL:', signedUrlError);
    // Fall back to path - components will generate signed URLs when displaying
  }

  return {
    path: filePath,
    name: file.name,
    size: file.size,
    type: file.type,
    url: signedUrlData?.signedUrl || filePath,
    uploaded_at: new Date().toISOString(),
  };
}

/**
 * Get signed URL for a private policy document
 */
export async function getPolicyDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('policy-documents')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) {
    console.error('Error getting policy document URL:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Delete a policy document from storage
 */
export async function deletePolicyDocument(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('policy-documents')
    .remove([path]);

  if (error) {
    console.error('Error deleting policy document:', error);
    throw error;
  }
}
