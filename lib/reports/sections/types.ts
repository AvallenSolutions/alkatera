/**
 * The report payload shapes for the social and value-chain sections.
 *
 * These lived as private interfaces inside render-sustainability-report-html.ts
 * while nothing populated them, which is how the renderer and the (absent)
 * fetchers drifted for so long without anyone noticing that five sections
 * never rendered. One definition, imported by both sides.
 *
 * CONTRACT: every score, rate, percentage and completeness value on this
 * payload is 0-100, never 0-1. A value that has not been recorded is `null`,
 * never 0 and never a placeholder — the renderer prints "not yet measured"
 * for null, and 0 is a claim that something was measured and came to nothing.
 */

export interface FacilityInfo {
  name: string;
  type: string;
  location: string;
  /** Site scope 1+2 emissions in TONNES CO2e. The source column is kg. */
  totalEmissions: number | null;
  unitsProduced: number | null;
  hasData: boolean;
}

export interface SupplierData {
  name: string;
  category: string;
  /** Non-empty when the supplier has shared activity data for the year. */
  emissionsData: Record<string, any>;
}

export interface PeopleCultureData {
  overallScore: number;
  fairWorkScore: number;
  diversityScore: number;
  wellbeingScore: number;
  trainingScore: number;
  dataCompleteness: number;
  livingWageCompliance: number | null;
  genderPayGapMean: number | null;
  ceoWorkerPayRatio: number | null;
  trainingHoursPerEmployee: number | null;
  engagementScore: number | null;
  totalEmployees: number | null;
  femalePercentage: number | null;
  newHires: number | null;
  departures: number | null;
  turnoverRate: number | null;
  deiActionsTotal: number | null;
  deiActionsCompleted: number | null;
  benefits: string[];
}

export interface GovernanceData {
  missionStatement: string | null;
  visionStatement: string | null;
  purposeStatement: string | null;
  isBenefitCorp: boolean;
  sdgCommitments: number[];
  climateCommitments: string[];
  boardMembers: {
    name: string;
    role: string;
    gender: string | null;
    isIndependent: boolean | null;
    attendanceRate: number | null;
  }[];
  /** Percentages are null with no board members: the renderer must not .toFixed() them. */
  boardDiversityMetrics: {
    totalMembers: number;
    femalePercentage: number | null;
    independentPercentage: number | null;
    averageAttendance: number | null;
  };
  policies: {
    name: string;
    type: string;
    status: string;
    isPublic: boolean;
  }[];
  policyCompleteness: number | null;
  ethicsTrainingRate: number | null;
  ethicsIncidents: number | null;
  lobbyingActivities: number | null;
}

export interface CommunityImpactData {
  overallScore: number;
  givingScore: number;
  localImpactScore: number;
  volunteeringScore: number;
  engagementScore: number;
  dataCompleteness: number;
  totalDonations: number | null;
  donationCount: number | null;
  totalVolunteerHours: number | null;
  volunteerActivities: number | null;
  impactStories: {
    title: string;
    category: string;
    summary: string;
    photo?: string;
  }[];
  localEmploymentRate: number | null;
  localSourcingRate: number | null;
}

// ============================================================================
// EMPTY CONSTANTS
// ============================================================================
// A selected section whose data could not be fetched renders as an
// all-"not yet measured" skeleton rather than vanishing, so these stand in
// for a missing payload. Scores read 0 (the scorers genuinely score an empty
// org at zero); everything measurable reads null.

export const EMPTY_PEOPLE_CULTURE: PeopleCultureData = {
  overallScore: 0,
  fairWorkScore: 0,
  diversityScore: 0,
  wellbeingScore: 0,
  trainingScore: 0,
  dataCompleteness: 0,
  livingWageCompliance: null,
  genderPayGapMean: null,
  ceoWorkerPayRatio: null,
  trainingHoursPerEmployee: null,
  engagementScore: null,
  totalEmployees: null,
  femalePercentage: null,
  newHires: null,
  departures: null,
  turnoverRate: null,
  deiActionsTotal: null,
  deiActionsCompleted: null,
  benefits: [],
};

export const EMPTY_GOVERNANCE: GovernanceData = {
  missionStatement: null,
  visionStatement: null,
  purposeStatement: null,
  isBenefitCorp: false,
  sdgCommitments: [],
  climateCommitments: [],
  boardMembers: [],
  boardDiversityMetrics: {
    totalMembers: 0,
    femalePercentage: null,
    independentPercentage: null,
    averageAttendance: null,
  },
  policies: [],
  policyCompleteness: null,
  ethicsTrainingRate: null,
  ethicsIncidents: null,
  lobbyingActivities: null,
};

export const EMPTY_COMMUNITY_IMPACT: CommunityImpactData = {
  overallScore: 0,
  givingScore: 0,
  localImpactScore: 0,
  volunteeringScore: 0,
  engagementScore: 0,
  dataCompleteness: 0,
  totalDonations: null,
  donationCount: null,
  totalVolunteerHours: null,
  volunteerActivities: null,
  impactStories: [],
  localEmploymentRate: null,
  localSourcingRate: null,
};
