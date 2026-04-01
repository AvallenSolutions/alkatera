import { ESG_QUESTIONS, type EsgResponse, type EsgSection } from './questions'

const POINTS: Record<EsgResponse, number | null> = {
  yes: 2,
  partial: 1,
  no: 0,
  na: null, // excluded from denominator
}

export interface SectionScore {
  section: EsgSection
  score: number | null // 0-100, or null if all answers are N/A
  answered: number
  total: number
}

export interface EsgScores {
  sections: Record<EsgSection, number | null> // 0-100 per section, null if all N/A
  total: number | null // average of scored sections, null if none scorable
  rating: 'leader' | 'progressing' | 'needs_improvement' | 'not_assessed'
  sectionDetails: SectionScore[]
}

/**
 * Calculate the score for a single section.
 * yes = 2 points, partial = 1, no = 0, na = excluded from denominator.
 * Returns the section percentage (0-100) rounded to the nearest integer.
 */
function calcSectionScore(
  section: EsgSection,
  answers: Record<string, EsgResponse>
): SectionScore {
  const questions = ESG_QUESTIONS.filter((q) => q.section === section)
  let points = 0
  let maxPoints = 0
  let answered = 0

  for (const q of questions) {
    const response = answers[q.id]
    if (!response) continue

    answered++
    const pts = POINTS[response]
    if (pts !== null) {
      points += pts
      maxPoints += 2
    }
  }

  const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : null

  return { section, score, answered, total: questions.length }
}

/**
 * Calculate all section scores, total score, and rating.
 */
export function calculateScores(answers: Record<string, EsgResponse>): EsgScores {
  const sections: EsgSection[] = [
    'labour_human_rights',
    'environment',
    'ethics',
    'health_safety',
    'management_systems',
  ]

  const sectionDetails = sections.map((s) => calcSectionScore(s, answers))

  const sectionScores = {} as Record<EsgSection, number | null>
  for (const detail of sectionDetails) {
    sectionScores[detail.section] = detail.score
  }

  // Total = average of section scores (only sections with scorable answers, not all-NA)
  const scoredSections = sectionDetails.filter((d) => d.score !== null)
  const total =
    scoredSections.length > 0
      ? Math.round(
          scoredSections.reduce((sum, d) => sum + (d.score as number), 0) / scoredSections.length
        )
      : null

  let rating: EsgScores['rating']
  if (total === null) rating = 'not_assessed'
  else if (total >= 75) rating = 'leader'
  else if (total >= 50) rating = 'progressing'
  else rating = 'needs_improvement'

  return { sections: sectionScores, total, rating, sectionDetails }
}

/**
 * Determine which sections are completed (all questions answered).
 */
export function getSectionCompletion(
  answers: Record<string, EsgResponse>
): Record<EsgSection, boolean> {
  const sections: EsgSection[] = [
    'labour_human_rights',
    'environment',
    'ethics',
    'health_safety',
    'management_systems',
  ]

  const result = {} as Record<EsgSection, boolean>
  for (const section of sections) {
    const questions = ESG_QUESTIONS.filter((q) => q.section === section)
    result[section] = questions.every((q) => answers[q.id] != null)
  }
  return result
}

/**
 * Check if all required questions have been answered (for submission validation).
 */
export function isReadyToSubmit(answers: Record<string, EsgResponse>): boolean {
  return ESG_QUESTIONS.every((q) => answers[q.id] != null)
}

/**
 * Human-readable rating label.
 */
export function getRatingLabel(rating: EsgScores['rating']): string {
  switch (rating) {
    case 'leader':
      return 'Leader'
    case 'progressing':
      return 'Progressing'
    case 'needs_improvement':
      return 'Needs Improvement'
    case 'not_assessed':
      return 'Not Assessed'
  }
}
