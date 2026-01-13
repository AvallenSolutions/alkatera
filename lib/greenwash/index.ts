import { supabase } from '../supabaseClient';
import type {
  GreenwashAssessment,
  GreenwashAssessmentClaim,
  GreenwashAssessmentWithClaims,
  CreateAssessmentInput,
  InputType,
} from '../types/greenwash';

// ============================================================================
// Fetch Assessments
// ============================================================================

export async function fetchAssessments(
  organizationId: string
): Promise<GreenwashAssessment[]> {
  const { data, error } = await supabase
    .from('greenwash_assessments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assessments:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function fetchAssessment(
  assessmentId: string
): Promise<GreenwashAssessment | null> {
  const { data, error } = await supabase
    .from('greenwash_assessments')
    .select('*')
    .eq('id', assessmentId)
    .single();

  if (error) {
    console.error('Error fetching assessment:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function fetchAssessmentWithClaims(
  assessmentId: string
): Promise<GreenwashAssessmentWithClaims | null> {
  const { data: assessment, error: assessmentError } = await supabase
    .from('greenwash_assessments')
    .select('*')
    .eq('id', assessmentId)
    .single();

  if (assessmentError) {
    console.error('Error fetching assessment:', assessmentError);
    throw new Error(assessmentError.message);
  }

  if (!assessment) return null;

  const { data: claims, error: claimsError } = await supabase
    .from('greenwash_assessment_claims')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('display_order', { ascending: true });

  if (claimsError) {
    console.error('Error fetching claims:', claimsError);
    // Don't throw - return assessment without claims
  }

  return {
    ...assessment,
    claims: claims || [],
  };
}

// ============================================================================
// Create Assessment
// ============================================================================

export async function createAssessment(
  input: CreateAssessmentInput
): Promise<GreenwashAssessment> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('greenwash_assessments')
    .insert({
      organization_id: input.organization_id,
      created_by: user.id,
      title: input.title,
      input_type: input.input_type,
      input_source: input.input_source || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating assessment:', error);
    throw new Error(error.message);
  }

  return data;
}

// ============================================================================
// Trigger Analysis
// ============================================================================

export async function triggerAnalysis(
  assessmentId: string,
  content: string,
  inputType: InputType,
  inputSource?: string
): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('No active session');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-greenwash-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      assessment_id: assessmentId,
      content,
      input_type: inputType,
      input_source: inputSource,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return { success: false, error: result.error || 'Analysis failed' };
  }

  return { success: true };
}

// ============================================================================
// Delete Assessment
// ============================================================================

export async function deleteAssessment(assessmentId: string): Promise<void> {
  // Claims are deleted automatically via CASCADE
  const { error } = await supabase
    .from('greenwash_assessments')
    .delete()
    .eq('id', assessmentId);

  if (error) {
    console.error('Error deleting assessment:', error);
    throw new Error(error.message);
  }
}

// ============================================================================
// URL Content Fetching (Client-side proxy)
// ============================================================================

export async function fetchUrlContent(url: string): Promise<string> {
  // For now, we'll use a simple fetch approach
  // In production, this should go through a server-side proxy
  try {
    const response = await fetch(`/api/fetch-url-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch URL content');
    }

    const data = await response.json();
    return data.content;
  } catch (error: any) {
    console.error('Error fetching URL content:', error);
    throw new Error(`Failed to fetch content from URL: ${error.message}`);
  }
}

// ============================================================================
// Document Upload
// ============================================================================

export async function uploadDocument(
  organizationId: string,
  file: File
): Promise<{ path: string; content: string }> {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const fileName = `${organizationId}/${Date.now()}-${file.name}`;

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('greenwash-documents')
    .upload(fileName, file);

  if (uploadError) {
    console.error('Error uploading document:', uploadError);
    throw new Error('Failed to upload document');
  }

  // Extract text content based on file type
  let content = '';

  if (fileExt === 'txt') {
    content = await file.text();
  } else if (fileExt === 'pdf' || fileExt === 'docx') {
    // For PDF and DOCX, we'll need to extract on the server
    // For now, send to an API route
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/extract-document-text', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to extract document text');
    }

    const data = await response.json();
    content = data.content;
  }

  return {
    path: uploadData.path,
    content,
  };
}

// ============================================================================
// Social Media Content Extraction
// ============================================================================

export async function fetchSocialMediaContent(url: string): Promise<string> {
  // Detect platform and fetch content appropriately
  const isInstagram = url.includes('instagram.com');
  const isLinkedIn = url.includes('linkedin.com');
  const isTwitter = url.includes('twitter.com') || url.includes('x.com');
  const isFacebook = url.includes('facebook.com');

  // For social media, we'll use the same URL fetching API
  // The server will handle platform-specific extraction
  const response = await fetch('/api/fetch-url-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      platform: isInstagram ? 'instagram' :
                isLinkedIn ? 'linkedin' :
                isTwitter ? 'twitter' :
                isFacebook ? 'facebook' : 'unknown'
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch social media content');
  }

  const data = await response.json();
  return data.content;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getRiskLevelColor(level: string): string {
  switch (level) {
    case 'high':
      return 'red';
    case 'medium':
      return 'amber';
    case 'low':
      return 'green';
    default:
      return 'gray';
  }
}

export function getRiskLevelLabel(level: string): string {
  switch (level) {
    case 'high':
      return 'High Risk';
    case 'medium':
      return 'Medium Risk';
    case 'low':
      return 'Low Risk';
    default:
      return 'Unknown';
  }
}

export function getJurisdictionLabel(jurisdiction: string): string {
  switch (jurisdiction) {
    case 'uk':
      return 'UK';
    case 'eu':
      return 'EU';
    case 'both':
      return 'UK & EU';
    default:
      return jurisdiction.toUpperCase();
  }
}
