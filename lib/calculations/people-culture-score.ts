/**
 * People & Culture Score Calculations
 *
 * ISOLATED MODULE - Does not modify any existing calculation files
 *
 * Supports:
 * - B Corp 2.1 Workers/JEDI requirements
 * - CSRD ESRS S1 (Own Workforce) reporting
 */

// UK Living Wage Foundation rates (2024)
export const LIVING_WAGE_BENCHMARKS = {
  'United Kingdom': {
    'London': 13.15,
    'default': 12.00,
  },
  'Ireland': {
    'default': 13.85,
  },
  'United States': {
    'default': 15.00,
  },
  'Germany': {
    'default': 12.41,
  },
  'France': {
    'default': 11.65,
  },
} as const;

export interface CompensationRecord {
  hourly_rate: number | null;
  annual_salary: number | null;
  work_country: string;
  work_region: string | null;
  gender: string | null;
  employment_type: string;
  role_level: string | null;
}

export interface LivingWageAnalysis {
  total_employees: number;
  employees_above_living_wage: number;
  employees_below_living_wage: number;
  compliance_rate: number;
  average_hourly_rate: number;
  living_wage_gap: number;
}

export interface GenderPayGapAnalysis {
  mean_gap_percentage: number;
  median_gap_percentage: number;
  male_average: number;
  female_average: number;
  male_median: number;
  female_median: number;
  has_sufficient_data: boolean;
}

export interface PayRatioAnalysis {
  ceo_to_median_ratio: number;
  executive_to_median_ratio: number;
  highest_paid: number;
  median_salary: number;
  lowest_paid: number;
}

/**
 * Get living wage rate for a specific location
 */
export function getLivingWageRate(country: string, region: string | null): number {
  const countryRates = LIVING_WAGE_BENCHMARKS[country as keyof typeof LIVING_WAGE_BENCHMARKS];
  if (!countryRates) {
    // Default fallback rate
    return 12.00;
  }

  if (region && region in countryRates) {
    return countryRates[region as keyof typeof countryRates] as number;
  }

  return countryRates.default;
}

/**
 * Convert annual salary to hourly rate
 * Assumes 52 weeks, standard hours based on employment type
 */
export function annualToHourlyRate(
  annualSalary: number,
  employmentType: string = 'full_time'
): number {
  const weeklyHours = employmentType === 'full_time' ? 37.5 :
                      employmentType === 'part_time' ? 20 : 37.5;
  return annualSalary / (52 * weeklyHours);
}

/**
 * Analyze living wage compliance across workforce
 */
export function analyzeLivingWageCompliance(
  records: CompensationRecord[]
): LivingWageAnalysis {
  if (records.length === 0) {
    return {
      total_employees: 0,
      employees_above_living_wage: 0,
      employees_below_living_wage: 0,
      compliance_rate: 0,
      average_hourly_rate: 0,
      living_wage_gap: 0,
    };
  }

  let aboveCount = 0;
  let belowCount = 0;
  let totalHourlyRate = 0;
  let totalGap = 0;

  for (const record of records) {
    let hourlyRate = record.hourly_rate;

    // Convert annual salary to hourly if needed
    if (!hourlyRate && record.annual_salary) {
      hourlyRate = annualToHourlyRate(record.annual_salary, record.employment_type);
    }

    if (!hourlyRate) continue;

    const livingWage = getLivingWageRate(record.work_country, record.work_region);

    if (hourlyRate >= livingWage) {
      aboveCount++;
    } else {
      belowCount++;
      totalGap += livingWage - hourlyRate;
    }

    totalHourlyRate += hourlyRate;
  }

  const totalWithRate = aboveCount + belowCount;

  return {
    total_employees: records.length,
    employees_above_living_wage: aboveCount,
    employees_below_living_wage: belowCount,
    compliance_rate: totalWithRate > 0 ? (aboveCount / totalWithRate) * 100 : 0,
    average_hourly_rate: totalWithRate > 0 ? totalHourlyRate / totalWithRate : 0,
    living_wage_gap: totalGap,
  };
}

/**
 * Calculate gender pay gap (UK GPG Reporting methodology)
 */
export function calculateGenderPayGap(
  records: CompensationRecord[]
): GenderPayGapAnalysis {
  const maleRates: number[] = [];
  const femaleRates: number[] = [];

  for (const record of records) {
    let hourlyRate = record.hourly_rate;

    if (!hourlyRate && record.annual_salary) {
      hourlyRate = annualToHourlyRate(record.annual_salary, record.employment_type);
    }

    if (!hourlyRate || !record.gender) continue;

    if (record.gender === 'male') {
      maleRates.push(hourlyRate);
    } else if (record.gender === 'female') {
      femaleRates.push(hourlyRate);
    }
  }

  // Need at least 5 of each gender for meaningful analysis
  const hasSufficientData = maleRates.length >= 5 && femaleRates.length >= 5;

  if (!hasSufficientData) {
    return {
      mean_gap_percentage: 0,
      median_gap_percentage: 0,
      male_average: 0,
      female_average: 0,
      male_median: 0,
      female_median: 0,
      has_sufficient_data: false,
    };
  }

  // Calculate means
  const maleAverage = maleRates.reduce((a, b) => a + b, 0) / maleRates.length;
  const femaleAverage = femaleRates.reduce((a, b) => a + b, 0) / femaleRates.length;

  // Calculate medians
  maleRates.sort((a, b) => a - b);
  femaleRates.sort((a, b) => a - b);

  const maleMedian = maleRates.length % 2 === 0
    ? (maleRates[maleRates.length / 2 - 1] + maleRates[maleRates.length / 2]) / 2
    : maleRates[Math.floor(maleRates.length / 2)];

  const femaleMedian = femaleRates.length % 2 === 0
    ? (femaleRates[femaleRates.length / 2 - 1] + femaleRates[femaleRates.length / 2]) / 2
    : femaleRates[Math.floor(femaleRates.length / 2)];

  // UK GPG: (male - female) / male * 100
  // Positive = men paid more, Negative = women paid more
  const meanGap = maleAverage > 0 ? ((maleAverage - femaleAverage) / maleAverage) * 100 : 0;
  const medianGap = maleMedian > 0 ? ((maleMedian - femaleMedian) / maleMedian) * 100 : 0;

  return {
    mean_gap_percentage: Math.round(meanGap * 10) / 10,
    median_gap_percentage: Math.round(medianGap * 10) / 10,
    male_average: Math.round(maleAverage * 100) / 100,
    female_average: Math.round(femaleAverage * 100) / 100,
    male_median: Math.round(maleMedian * 100) / 100,
    female_median: Math.round(femaleMedian * 100) / 100,
    has_sufficient_data: true,
  };
}

/**
 * Calculate pay ratios (CEO to median, executive to median)
 */
export function calculatePayRatios(
  records: CompensationRecord[]
): PayRatioAnalysis {
  const salaries: number[] = [];
  let executiveSalary = 0;
  let executiveCount = 0;

  for (const record of records) {
    let annualSalary = record.annual_salary;

    if (!annualSalary && record.hourly_rate) {
      // Convert hourly to annual
      const weeklyHours = record.employment_type === 'full_time' ? 37.5 : 20;
      annualSalary = record.hourly_rate * weeklyHours * 52;
    }

    if (!annualSalary) continue;

    salaries.push(annualSalary);

    if (record.role_level === 'executive' || record.role_level === 'director') {
      executiveSalary += annualSalary;
      executiveCount++;
    }
  }

  if (salaries.length === 0) {
    return {
      ceo_to_median_ratio: 0,
      executive_to_median_ratio: 0,
      highest_paid: 0,
      median_salary: 0,
      lowest_paid: 0,
    };
  }

  salaries.sort((a, b) => a - b);

  const median = salaries.length % 2 === 0
    ? (salaries[salaries.length / 2 - 1] + salaries[salaries.length / 2]) / 2
    : salaries[Math.floor(salaries.length / 2)];

  const highest = salaries[salaries.length - 1];
  const lowest = salaries[0];
  const avgExecutive = executiveCount > 0 ? executiveSalary / executiveCount : highest;

  return {
    ceo_to_median_ratio: median > 0 ? Math.round((highest / median) * 10) / 10 : 0,
    executive_to_median_ratio: median > 0 ? Math.round((avgExecutive / median) * 10) / 10 : 0,
    highest_paid: Math.round(highest),
    median_salary: Math.round(median),
    lowest_paid: Math.round(lowest),
  };
}

/**
 * Calculate People & Culture composite score
 *
 * Weights:
 * - Fair Work: 30%
 * - Diversity & Inclusion: 30%
 * - Employee Wellbeing: 20%
 * - Training & Development: 20%
 */
export interface PeopleCultureScoreInput {
  // Fair Work
  livingWageComplianceRate: number; // 0-100
  genderPayGapMean: number; // percentage (positive = gap exists)
  payRatio: number; // CEO:median ratio

  // Diversity
  genderDiversityRatio: number; // 0-1, closer to 0.5 is better
  hasPublishedDEICommitments: boolean;
  deiActionsCompletedRate: number; // 0-100

  // Wellbeing
  benefitUptakeRate: number; // 0-100
  surveyResponseRate: number; // 0-100
  engagementScore: number; // 0-5

  // Training
  avgTrainingHoursPerEmployee: number;
  trainingParticipationRate: number; // 0-100
}

export interface PeopleCultureScoreResult {
  overall_score: number;
  fair_work_score: number;
  diversity_score: number;
  wellbeing_score: number;
  training_score: number;
  data_completeness: number;
}

export function calculatePeopleCultureScore(
  input: Partial<PeopleCultureScoreInput>
): PeopleCultureScoreResult {
  let totalDataPoints = 0;
  let providedDataPoints = 0;

  // Fair Work Score (30% weight)
  let fairWorkScore = 0;
  let fairWorkComponents = 0;

  if (input.livingWageComplianceRate !== undefined) {
    fairWorkScore += input.livingWageComplianceRate;
    fairWorkComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  if (input.genderPayGapMean !== undefined) {
    // Score based on gap: 0% gap = 100, 20%+ gap = 0
    const gapScore = Math.max(0, 100 - Math.abs(input.genderPayGapMean) * 5);
    fairWorkScore += gapScore;
    fairWorkComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  if (input.payRatio !== undefined) {
    // Score based on ratio: 10:1 or less = 100, 100:1 = 0
    const ratioScore = Math.max(0, Math.min(100, 100 - (input.payRatio - 10) * 1.11));
    fairWorkScore += ratioScore;
    fairWorkComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  fairWorkScore = fairWorkComponents > 0 ? fairWorkScore / fairWorkComponents : 0;

  // Diversity Score (30% weight)
  let diversityScore = 0;
  let diversityComponents = 0;

  if (input.genderDiversityRatio !== undefined) {
    // 50/50 = 100, 100/0 or 0/100 = 0
    const diversityBalance = 1 - Math.abs(0.5 - input.genderDiversityRatio) * 2;
    diversityScore += diversityBalance * 100;
    diversityComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  if (input.hasPublishedDEICommitments !== undefined) {
    diversityScore += input.hasPublishedDEICommitments ? 100 : 0;
    diversityComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  if (input.deiActionsCompletedRate !== undefined) {
    diversityScore += input.deiActionsCompletedRate;
    diversityComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  diversityScore = diversityComponents > 0 ? diversityScore / diversityComponents : 0;

  // Wellbeing Score (20% weight)
  let wellbeingScore = 0;
  let wellbeingComponents = 0;

  if (input.benefitUptakeRate !== undefined) {
    wellbeingScore += input.benefitUptakeRate;
    wellbeingComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  if (input.surveyResponseRate !== undefined) {
    wellbeingScore += input.surveyResponseRate;
    wellbeingComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  if (input.engagementScore !== undefined) {
    wellbeingScore += (input.engagementScore / 5) * 100;
    wellbeingComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  wellbeingScore = wellbeingComponents > 0 ? wellbeingScore / wellbeingComponents : 0;

  // Training Score (20% weight)
  let trainingScore = 0;
  let trainingComponents = 0;

  if (input.avgTrainingHoursPerEmployee !== undefined) {
    // B Corp recommends 20+ hours per employee
    const hoursScore = Math.min(100, (input.avgTrainingHoursPerEmployee / 20) * 100);
    trainingScore += hoursScore;
    trainingComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  if (input.trainingParticipationRate !== undefined) {
    trainingScore += input.trainingParticipationRate;
    trainingComponents++;
    providedDataPoints++;
  }
  totalDataPoints++;

  trainingScore = trainingComponents > 0 ? trainingScore / trainingComponents : 0;

  // Calculate overall score with weights
  const overallScore =
    fairWorkScore * 0.30 +
    diversityScore * 0.30 +
    wellbeingScore * 0.20 +
    trainingScore * 0.20;

  const dataCompleteness = totalDataPoints > 0
    ? (providedDataPoints / totalDataPoints) * 100
    : 0;

  return {
    overall_score: Math.round(overallScore * 10) / 10,
    fair_work_score: Math.round(fairWorkScore * 10) / 10,
    diversity_score: Math.round(diversityScore * 10) / 10,
    wellbeing_score: Math.round(wellbeingScore * 10) / 10,
    training_score: Math.round(trainingScore * 10) / 10,
    data_completeness: Math.round(dataCompleteness * 10) / 10,
  };
}

/**
 * Get score tier label
 */
export function getScoreTier(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 80) {
    return {
      label: 'Excellent',
      color: 'emerald',
      description: 'B Corp ready - exceeds best practices',
    };
  }
  if (score >= 60) {
    return {
      label: 'Good',
      color: 'blue',
      description: 'Strong foundation with room for improvement',
    };
  }
  if (score >= 40) {
    return {
      label: 'Developing',
      color: 'amber',
      description: 'Progress made - focus areas identified',
    };
  }
  if (score >= 20) {
    return {
      label: 'Emerging',
      color: 'orange',
      description: 'Early stage - significant gaps exist',
    };
  }
  return {
    label: 'Starting',
    color: 'red',
    description: 'Requires immediate attention',
  };
}
