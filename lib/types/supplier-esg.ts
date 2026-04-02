import type { EsgResponse, EsgSection } from '@/lib/supplier-esg/questions'

export interface SupplierEsgAssessment {
  id: string
  supplier_id: string

  // Section completion flags
  labour_human_rights_completed: boolean
  environment_completed: boolean
  ethics_completed: boolean
  health_safety_completed: boolean
  management_systems_completed: boolean

  // Answers keyed by question_id
  answers: Record<string, EsgResponse>

  // Scores (0-100)
  score_labour: number | null
  score_environment: number | null
  score_ethics: number | null
  score_health_safety: number | null
  score_management: number | null
  score_total: number | null
  score_rating: 'leader' | 'progressing' | 'needs_improvement' | 'not_assessed' | null

  // Submission
  submitted_at: string | null
  submitted: boolean

  // Verification
  is_verified: boolean
  verified_by: string | null
  verified_at: string | null
  verification_notes: string | null

  created_at: string
  updated_at: string
}

/** Shape returned by the admin verification list query (joined with supplier name). */
export interface EsgAssessmentForVerification extends SupplierEsgAssessment {
  supplier: { name: string }
}

/** A single evidence file attached to an ESG assessment question. */
export interface SupplierEsgEvidence {
  id: string
  assessment_id: string
  question_id: string
  document_name: string
  document_url: string | null
  storage_object_path: string | null
  file_size_bytes: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}
