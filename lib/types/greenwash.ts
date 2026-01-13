// Greenwash Guardian Types

export type RiskLevel = 'low' | 'medium' | 'high';
export type InputType = 'url' | 'document' | 'text' | 'social_media';
export type AssessmentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type Jurisdiction = 'uk' | 'eu' | 'both';

export interface GreenwashAssessment {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  input_type: InputType;
  input_source: string | null;
  input_content: string | null;
  overall_risk_level: RiskLevel | null;
  overall_risk_score: number | null;
  summary: string | null;
  recommendations: string[];
  legislation_applied: LegislationReference[];
  status: AssessmentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface GreenwashAssessmentClaim {
  id: string;
  assessment_id: string;
  claim_text: string;
  claim_context: string | null;
  risk_level: RiskLevel;
  risk_score: number | null;
  issue_type: string | null;
  issue_description: string;
  legislation_name: string;
  legislation_article: string | null;
  legislation_jurisdiction: Jurisdiction;
  suggestion: string;
  suggested_revision: string | null;
  display_order: number;
  created_at: string;
}

export interface LegislationReference {
  name: string;
  jurisdiction: Jurisdiction;
  key_requirement: string;
}

export interface GreenwashAssessmentWithClaims extends GreenwashAssessment {
  claims: GreenwashAssessmentClaim[];
}

// Input types for creating assessments
export interface CreateAssessmentInput {
  title: string;
  input_type: InputType;
  input_source?: string;
  content: string;
  organization_id: string;
}

// API Response types
export interface AnalysisResult {
  overall_risk_level: RiskLevel;
  overall_risk_score: number;
  summary: string;
  recommendations: string[];
  legislation_applied: LegislationReference[];
  claims: ClaimAnalysis[];
}

export interface ClaimAnalysis {
  claim_text: string;
  claim_context?: string;
  risk_level: RiskLevel;
  risk_score: number;
  issue_type: string;
  issue_description: string;
  legislation_name: string;
  legislation_article?: string;
  legislation_jurisdiction: Jurisdiction;
  suggestion: string;
  suggested_revision?: string;
}

// UI State types
export interface AssessmentFormState {
  activeTab: InputType;
  url: string;
  text: string;
  socialMediaUrl: string;
  socialMediaText: string;
  documentFile: File | null;
  title: string;
  isSubmitting: boolean;
  error: string | null;
}

// Issue type categories
export const ISSUE_TYPES = {
  vague_claim: 'Vague Environmental Claim',
  unsubstantiated: 'Unsubstantiated Claim',
  misleading_comparison: 'Misleading Comparison',
  hidden_tradeoff: 'Hidden Trade-off',
  false_label: 'False or Misleading Label',
  irrelevant_claim: 'Irrelevant Environmental Claim',
  lesser_evil: 'Lesser of Two Evils',
  absolute_claim: 'Absolute/Blanket Claim',
  future_promise: 'Unverifiable Future Promise',
  cherry_picking: 'Cherry-Picking Data',
} as const;

export type IssueType = keyof typeof ISSUE_TYPES;

// ============================================================================
// Bulk Job Types
// ============================================================================

export type BulkJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type BulkJobUrlStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface GreenwashBulkJob {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  status: BulkJobStatus;
  total_urls: number;
  completed_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface GreenwashBulkJobUrl {
  id: string;
  bulk_job_id: string;
  url: string;
  assessment_id: string | null;
  status: BulkJobUrlStatus;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface GreenwashBulkJobWithUrls extends GreenwashBulkJob {
  urls: GreenwashBulkJobUrl[];
}

export interface CreateBulkJobInput {
  urls: string[];
  organization_id: string;
  title?: string;
}
