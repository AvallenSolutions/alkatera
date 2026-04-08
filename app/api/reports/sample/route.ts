import { NextRequest, NextResponse } from 'next/server';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';

/**
 * Sample Report — renders a realistic demo report as HTML for preview.
 * Development/demo use only.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const screen = url.searchParams.get('screen') === '1';

  const config: any = {
    reportName: 'Sustainability Report 2025',
    reportYear: 2025,
    reportingPeriodStart: '2025-01-01',
    reportingPeriodEnd: '2025-12-31',
    audience: 'investors',
    standards: ['csrd', 'iso-14067', 'ghg-protocol'],
    sections: [
      'executive-summary', 'scope-1-2-3', 'ghg-inventory', 'carbon-origin',
      'key-findings', 'trends', 'product-footprints',
      'people-culture', 'governance', 'community-impact',
      'supply-chain', 'targets', 'transition-roadmap',
      'risks-and-opportunities', 'methodology', 'appendix',
    ],
    isMultiYear: true,
    reportYears: [2023, 2024, 2025],
    branding: {
      logo: null,
      primaryColor: '#ccff00',
      secondaryColor: '#10b981',
      // Picsum placeholder photos — replace with real uploads in production
      heroImages: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
        'https://images.unsplash.com/photo-1600018397736-cae2ad2b25b7?w=1200&q=80',
      ],
      leadership: {
        name: 'Emma Hague',
        title: 'Co-Founder & Commercial Director',
        message: 'Sustainability has always been woven into the fabric of how we brew. This year we reached three consecutive years of absolute emission reductions whilst growing our volume — proof that doing the right thing and building a great business are not competing goals. We remain committed to being net zero by 2035, and to bringing our entire supply chain with us on that journey.',
        photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80',
      },
    },
  };

  const data: any = {
    organization: {
      name: 'Thornbridge Brewery',
      industry_sector: 'Craft Brewing',
      description: 'An independent craft brewery based in Derbyshire, producing award-winning ales, lagers, and stouts distributed across the UK and exported to 30 countries.',
    },
    emissions: {
      scope1: 312.4,
      scope2: 187.6,
      scope3: 2840.2,
      total: 3340.2,
      year: 2025,
    },
    emissionsTrends: [
      { year: 2023, scope1: 378.1, scope2: 224.3, scope3: 3102.5, total: 3704.9, yoyChange: null },
      { year: 2024, scope1: 341.2, scope2: 203.8, scope3: 2980.4, total: 3525.4, yoyChange: '-4.8' },
      { year: 2025, scope1: 312.4, scope2: 187.6, scope3: 2840.2, total: 3340.2, yoyChange: '-5.2' },
    ],
    products: [
      { name: 'Jaipur IPA (330ml can)', functionalUnit: '1 can (330ml)', climateImpact: 0.312 },
      { name: 'Kipling Pale Ale (500ml bottle)', functionalUnit: '1 bottle (500ml)', climateImpact: 0.487 },
      { name: 'Wild Swan Golden Ale (keg, per litre)', functionalUnit: '1 litre', climateImpact: 0.198 },
      { name: 'Tzara Amber Ale (330ml can)', functionalUnit: '1 can (330ml)', climateImpact: 0.341 },
      { name: 'Brother Rabbit Lager (500ml bottle)', functionalUnit: '1 bottle (500ml)', climateImpact: 0.521 },
    ],
    facilities: [
      { name: 'Bakewell Brewery', type: 'Production', location: 'Bakewell, Derbyshire', totalEmissions: 210.3, unitsProduced: 850000, hasData: true },
      { name: 'Riverside Fermentation Hall', type: 'Production', location: 'Bakewell, Derbyshire', totalEmissions: 102.1, unitsProduced: 420000, hasData: true },
    ],
    suppliers: [
      { name: 'Crisp Malting Group', category: 'Raw Materials', emissionsData: { estimated_kgco2e: 412000 } },
      { name: 'Charles Faram', category: 'Raw Materials', emissionsData: { estimated_kgco2e: 128000 } },
      { name: 'Veolia UK', category: 'Waste & Water', emissionsData: { estimated_kgco2e: 38000 } },
      { name: 'DHL Supply Chain', category: 'Logistics', emissionsData: { estimated_kgco2e: 210000 } },
    ],
    standards: [
      { code: 'CSRD', name: 'Corporate Sustainability Reporting Directive', status: 'partial', detail: 'Materiality assessment required for full compliance.' },
      { code: 'ISO 14067', name: 'Product Carbon Footprint', status: 'compliant', detail: 'Five products assessed to ISO 14067:2018 standard.' },
      { code: 'GHG Protocol', name: 'GHG Protocol Corporate Standard', status: 'compliant', detail: 'Full Scope 1, 2, and 3 inventory prepared.' },
    ],
    dataQuality: {
      qualityTier: 'mixed',
      completeness: 0.84,
      confidenceScore: 78,
    },
    peopleCulture: {
      overallScore: 72,
      fairWorkScore: 68,
      diversityScore: 74,
      wellbeingScore: 80,
      trainingScore: 66,
      dataCompleteness: 0.88,
      livingWageCompliance: 1.0,
      genderPayGapMean: 8.2,
      ceoWorkerPayRatio: 14,
      trainingHoursPerEmployee: 22,
      engagementScore: 76,
      totalEmployees: 64,
      femalePercentage: 38,
      newHires: 12,
      departures: 7,
      turnoverRate: 10.9,
      deiActionsTotal: 8,
      deiActionsCompleted: 5,
      benefits: ['Health cash plan', 'Cycle to work scheme', 'Enhanced parental leave', 'Employee assistance programme', 'Staff discount scheme'],
    },
    governance: {
      missionStatement: 'To brew world-class beers that celebrate creativity, quality, and community whilst treading as lightly as possible on the planet.',
      visionStatement: 'A net zero brewery by 2040, with every product traceable from field to glass.',
      purposeStatement: null,
      isBenefitCorp: false,
      sdgCommitments: [2, 6, 7, 12, 13, 15],
      climateCommitments: ['Net Zero by 2040', 'SBTi Near-Term Target (in progress)', 'RE100 electricity by 2027', 'No deforestation supply chain'],
      boardMembers: [
        { name: 'Simon Webster', role: 'Co-Founder & CEO', gender: 'male', isIndependent: false, attendanceRate: 100 },
        { name: 'Emma Hague', role: 'Co-Founder & Commercial Director', gender: 'female', isIndependent: false, attendanceRate: 100 },
        { name: 'Dr. Rachel Hooper', role: 'Independent Non-Executive', gender: 'female', isIndependent: true, attendanceRate: 92 },
        { name: 'James Thornton', role: 'Independent Non-Executive', gender: 'male', isIndependent: true, attendanceRate: 88 },
      ],
      boardDiversityMetrics: { totalMembers: 4, femalePercentage: 50, independentPercentage: 50, averageAttendance: 95 },
      policies: [
        { name: 'Environmental Policy', type: 'environment', status: 'active', isPublic: true },
        { name: 'Supplier Code of Conduct', type: 'supply-chain', status: 'active', isPublic: true },
        { name: 'Diversity & Inclusion Policy', type: 'social', status: 'active', isPublic: false },
        { name: 'Modern Slavery Statement', type: 'social', status: 'active', isPublic: true },
        { name: 'Whistleblowing Policy', type: 'governance', status: 'active', isPublic: false },
        { name: 'Climate Risk Policy', type: 'environment', status: 'draft', isPublic: false },
      ],
      policyCompleteness: 0.82,
      ethicsTrainingRate: 0.94,
      ethicsIncidents: 0,
      lobbyingActivities: 0,
    },
    communityImpact: {
      overallScore: 68,
      givingScore: 74,
      localImpactScore: 82,
      volunteeringScore: 60,
      engagementScore: 56,
      dataCompleteness: 0.79,
      totalDonations: 28400,
      donationCount: 14,
      totalVolunteerHours: 312,
      volunteerActivities: 6,
      impactStories: [
        {
          title: 'Peak District Conservation Partnership',
          category: 'Environment',
          summary: 'Staff volunteered 120 hours on dry-stone wall restoration and rewilding projects in the Peak District National Park.',
          photo: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=80',
        },
        {
          title: 'Bakewell Schools Brewing Education',
          category: 'Education',
          summary: 'Hosted six school visits to the brewery covering fermentation science, sustainable agriculture, and careers in food and drink.',
          photo: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=600&q=80',
        },
        {
          title: 'Local Hop Growers Collaborative',
          category: 'Local Economy',
          summary: 'Contracted three Derbyshire hop growers to supply 12% of annual hop requirements, supporting local agricultural livelihoods.',
          photo: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&q=80',
        },
        {
          title: 'Food Bank Partnership',
          category: 'Community',
          summary: 'Donated 2,400 meals-worth of spent grain to Derbyshire food banks and supported a local food rescue charity with £8,500 in annual funding.',
        },
      ],
      localEmploymentRate: 0.71,
      localSourcingRate: 0.34,
    },
    keyFindings: [
      {
        title: 'Scope 3 remains the dominant challenge',
        narrative: 'Upstream agricultural emissions (barley and hops) account for 62% of total Scope 3, representing the single largest decarbonisation lever available to Thornbridge.',
        scope: 'scope3',
        direction: 'decrease',
        magnitude_pct: 4.7,
        confidence: 'medium',
      },
      {
        title: 'Energy transition delivering results',
        narrative: 'Scope 2 emissions fell 7.9% following the switch to a 100% renewable electricity tariff in March 2025, eliminating 16.2 tCO2e from the annual footprint.',
        scope: 'scope2',
        direction: 'decrease',
        magnitude_pct: 7.9,
        confidence: 'high',
      },
      {
        title: 'Fleet electrification programme on track',
        narrative: 'Three diesel delivery vehicles were replaced with electric equivalents in Q2, reducing Scope 1 transport emissions by an estimated 28 tCO2e annually.',
        scope: 'scope1',
        direction: 'decrease',
        magnitude_pct: 8.9,
        confidence: 'high',
      },
    ],
    transitionPlan: {
      plan_year: 2025,
      baseline_year: 2022,
      baseline_emissions_tco2e: 4120.8,
      sbti_aligned: true,
      sbti_target_year: 2035,
      targets: [
        { id: 't1', scope: 'scope1', targetYear: 2030, reductionPct: 50, absoluteTargetTco2e: 156, notes: 'Full fleet electrification + heat pump installation' },
        { id: 't2', scope: 'scope2', targetYear: 2027, reductionPct: 100, absoluteTargetTco2e: 0, notes: 'RE100 achievement via PPAs' },
        { id: 't3', scope: 'scope3', targetYear: 2035, reductionPct: 42, absoluteTargetTco2e: 1647, notes: 'Supplier engagement programme + low-carbon malt sourcing' },
        { id: 't4', scope: 'total', targetYear: 2040, reductionPct: 90, absoluteTargetTco2e: 334, notes: 'Net zero operational target' },
      ],
      milestones: [
        { id: 'm1', title: 'Full renewable electricity (RE100)', targetDate: '2027-12-31', status: 'in_progress', emissionsImpactTco2e: 188 },
        { id: 'm2', title: 'Fleet fully electrified', targetDate: '2028-06-30', status: 'in_progress', emissionsImpactTco2e: 140 },
        { id: 'm3', title: 'Low-carbon malt supplier approved', targetDate: '2026-03-31', status: 'complete', emissionsImpactTco2e: 320 },
        { id: 'm4', title: 'On-site solar PV installation (200kW)', targetDate: '2026-09-30', status: 'not_started', emissionsImpactTco2e: 85 },
        { id: 'm5', title: 'SBTi near-term target submitted', targetDate: '2026-06-30', status: 'in_progress', emissionsImpactTco2e: null },
        { id: 'm6', title: 'Scope 3 supplier engagement programme launched', targetDate: '2025-12-31', status: 'complete', emissionsImpactTco2e: null },
      ],
      risks_and_opportunities: [
        { id: 'r1', type: 'risk', category: 'Physical Risk', title: 'Water stress in hop-growing regions', description: 'Climate-driven drought in UK hop-growing counties (Herefordshire, Worcestershire) could reduce domestic hop availability and increase input costs by an estimated 15–25% by 2035.', likelihood: 'medium', impact: 'high', timeHorizon: 'medium', aiGenerated: true },
        { id: 'r2', type: 'risk', category: 'Transition Risk', title: 'Carbon border adjustment mechanism (CBAM)', description: 'EU CBAM expansion to food and beverages post-2030 could increase costs for exported products if embedded carbon is not disclosed and managed.', likelihood: 'medium', impact: 'medium', timeHorizon: 'long', aiGenerated: true },
        { id: 'r3', type: 'risk', category: 'Transition Risk', title: 'Mandatory CSRD reporting requirements', description: 'Thornbridge will likely fall within CSRD scope as a large undertaking by 2027, requiring audited double materiality assessment and ESRS disclosures.', likelihood: 'high', impact: 'medium', timeHorizon: 'short', aiGenerated: true },
        { id: 'o1', type: 'opportunity', category: 'Market Opportunity', title: 'Premium positioning on verified low-carbon products', description: 'ISO 14067-certified products command a price premium in on-trade and export markets, particularly in Scandinavian and German markets where sustainability labelling is valued.', likelihood: 'high', impact: 'high', timeHorizon: 'short', aiGenerated: true },
        { id: 'o2', type: 'opportunity', category: 'Operational Efficiency', title: 'Heat recovery from fermentation', description: 'Installing heat exchangers on fermentation vessels could recover an estimated 180 MWh/year of thermal energy, reducing gas consumption and Scope 1 emissions by ~36 tCO2e.', likelihood: 'high', impact: 'medium', timeHorizon: 'short', aiGenerated: true },
        { id: 'o3', type: 'opportunity', category: 'Supply Chain', title: 'Regenerative barley sourcing programme', description: 'Partnering with regenerative arable farmers in Lincolnshire could reduce malting barley Scope 3 emissions by up to 40% whilst supporting verified soil carbon sequestration.', likelihood: 'medium', impact: 'high', timeHorizon: 'medium', aiGenerated: true },
      ],
    },
    narratives: {
      executiveSummary: {
        primaryMessage: 'Thornbridge Brewery reduced absolute GHG emissions by 5.2% in 2025, delivering three consecutive years of decarbonisation whilst growing beer volume by 8% — demonstrating a credible decoupling of growth from carbon.',
        summaryText: 'Thornbridge Brewery recorded total GHG emissions of 3,340.2 tCO2e in 2025, a 5.2% reduction from 3,525.4 tCO2e in the prior year and a 9.9% reduction from the 2023 baseline. Scope 3 upstream agricultural emissions remain the dominant category at 85% of the total footprint, concentrated in barley and hop cultivation; the approval of a low-carbon malt supplier in Q4 marks a significant step towards addressing this. Scope 2 emissions fell 7.9% following a full switch to renewable electricity, and fleet electrification reduced Scope 1 transport emissions by 28 tCO2e. The primary near-term challenge is completing the SBTi near-term target submission and extending supplier engagement to cover the top 20 value chain contributors.',
        aiGenerated: true,
      },
      sections: {
        'scope-1-2-3': {
          headlineInsight: 'All three scopes declined in 2025, with Scope 2 showing the strongest improvement following the renewable electricity transition.',
          contextParagraph: 'Scope 1 fell 8.4% driven by the partial fleet electrification programme, whilst Scope 2 reduced 7.9% as a 100% renewable electricity tariff took effect from March. Scope 3 continues to dominate at 85% of total emissions, with agricultural raw materials — particularly barley malting — representing the most material upstream category. The three-year trend now shows 9.9% total reduction from the 2023 baseline, ahead of the linear trajectory needed to meet the 2030 interim target.',
          nextStepPrompt: 'Prioritise supplier-level engagement with the top five Scope 3 contributors to establish activity-based data collection by Q3 2026.',
          dataConfidenceStatement: 'Data quality is mixed: some figures are measured directly (Tier 1) whilst others are estimated (Tier 2/3). Data coverage: 84%.',
          methodologyFootnote: 'Methodology: GHG Protocol Corporate Standard. Data quality: Mixed (Tier 1-3).',
          aiGenerated: true,
        },
        'targets': {
          headlineInsight: 'Thornbridge has set a full-scope net zero target by 2040, with SBTi-aligned interim milestones across Scopes 1, 2, and 3.',
          contextParagraph: 'The 2030 Scope 1 target (50% reduction) and 2027 Scope 2 target (100% renewable electricity) are both on track based on current trajectories. The Scope 3 target of 42% reduction by 2035 is the most challenging and depends materially on the success of the supplier engagement programme and the uptake of regenerative sourcing. SBTi near-term target submission is expected by June 2026.',
          nextStepPrompt: 'Complete the SBTi submission and publish the full transition plan to demonstrate accountability to investors and customers.',
          dataConfidenceStatement: null,
          methodologyFootnote: 'Methodology: Science Based Targets initiative (SBTi) methodology. Data quality: Not assessed.',
          aiGenerated: true,
        },
        'people-culture': {
          headlineInsight: 'Thornbridge is a real living wage employer with a 50% female board, though a gender pay gap of 8.2% in mean hourly earnings warrants attention.',
          contextParagraph: 'All 64 employees are paid at or above the Real Living Wage, and the organisation offers an above-average benefits package including enhanced parental leave. The 8.2% mean gender pay gap is below the UK national average of 13.2% but has widened slightly from 7.6% in 2024, driven by a higher proportion of male employees in senior production roles. Five of eight DEI commitments have been actioned.',
          nextStepPrompt: 'Set a target to close the gender pay gap to below 5% by 2027, with a structured progression programme for production roles.',
          dataConfidenceStatement: null,
          methodologyFootnote: 'Methodology: Self-reported survey data and payroll records. Data quality: Not assessed.',
          aiGenerated: true,
        },
      },
    },
    dataAvailability: {
      hasOrganization: true,
      hasEmissions: true,
      hasProducts: true,
      hasFacilities: true,
      hasSuppliers: true,
      hasVineyards: false,
      hasPeopleCulture: true,
      hasGovernance: true,
      hasCommunityImpact: true,
    },
    materiality: {
      priority_topics: ['climate-mitigation', 'product-lifecycle', 'fair-wages', 'sustainability-governance', 'community-impact'],
      completed_at: '2025-11-15T10:30:00Z',
      topics: [
        { id: 'climate-mitigation', name: 'Climate Change Mitigation', category: 'Environmental', status: 'priority', esrsReference: 'ESRS E1', rationale: 'Material due to regulatory exposure, investor expectations, and direct operational cost impact of carbon pricing.' },
        { id: 'product-lifecycle', name: 'Product Environmental Impact', category: 'Environmental', status: 'priority', esrsReference: 'ISO 14067', rationale: 'Core to brand differentiation and customer transparency commitments.' },
        { id: 'fair-wages', name: 'Fair Wages & Employment Practices', category: 'Social', status: 'priority', esrsReference: 'ESRS S1', rationale: 'Foundational to employer brand and talent retention in a competitive labour market.' },
        { id: 'sustainability-governance', name: 'Sustainability Governance', category: 'Governance', status: 'priority', esrsReference: 'ESRS G1' },
        { id: 'community-impact', name: 'Community & Local Economic Impact', category: 'Social', status: 'priority', esrsReference: 'ESRS S3' },
        { id: 'water-use', name: 'Water Use & Stewardship', category: 'Environmental', status: 'material', esrsReference: 'ESRS E3' },
        { id: 'supply-chain-labour', name: 'Supply Chain Labour Standards', category: 'Social', status: 'material', esrsReference: 'ESRS S2' },
      ],
    },
    materialityComplete: true,
    csrdGatingWarning: false,
  };

  const html = renderSustainabilityReportHtml(config, data, { screenMode: screen });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
