import { OWNER_USER_ID, REFERENCE_YEAR, type SeedCtx } from './shared';

const BCORP_FRAMEWORK_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/** Targets (emissions / water / LCA coverage), an SBTi FLAG target and a carbon budget. */
async function seedTargets(ctx: SeedCtx): Promise<Record<string, string>> {
  const { svc, orgId } = ctx;

  await svc.from('sustainability_targets').delete().eq('organization_id', orgId);
  const { data: targets, error } = await svc
    .from('sustainability_targets')
    .insert([
      { organization_id: orgId, metric_key: 'total_co2e', baseline_value: 21000, baseline_date: '2024-12-31', target_value: 12180, target_date: '2030-12-31', status: 'active', scope: '1+2', methodology: 'SBTi 1.5°C aligned (-42% absolute by 2030)', notes: 'Board-approved near-term science-based target.' },
      { organization_id: orgId, metric_key: 'water_consumption', baseline_value: 9000, baseline_date: '2024-12-31', target_value: 6300, target_date: '2028-12-31', status: 'active', scope: 'operations', methodology: '-30% absolute water intake', notes: 'Driven by CIP optimisation and rainwater harvesting.' },
      { organization_id: orgId, metric_key: 'lca_completeness_pct', baseline_value: 30, baseline_date: '2025-06-30', target_value: 100, target_date: '2027-12-31', status: 'active', scope: 'portfolio', methodology: 'Full product LCA coverage', notes: 'Every SKU carries a verified cradle-to-gate footprint.' },
    ])
    .select('id, metric_key');
  if (error) throw new Error(`sustainability_targets: ${error.message}`);

  await svc.from('flag_targets').delete().eq('organization_id', orgId);
  await svc.from('flag_targets').insert({
    organization_id: orgId, target_type: 'absolute', scope: 'flag', base_year: 2024, target_year: 2030,
    reduction_percentage: 30.3, base_year_emissions_co2e: 9400, meets_sbti_minimum: true, sbti_pathway: 'flag_1_5c',
    commodity_coverage: ['grapes', 'apples', 'barley'], status: 'validated',
    methodology_notes: 'FLAG science-based target covering self-grown grapes and apples and purchased malting barley.',
  });

  await svc.from('carbon_budgets').delete().eq('organization_id', orgId);
  await svc.from('carbon_budgets').insert([
    { organization_id: orgId, scope: 'all', period: 'annual', budget_tco2e: 18, effective_from: '2026-01-01', notes: 'Group-wide annual carbon budget aligned to the SBTi trajectory.' },
    { organization_id: orgId, scope: 'scope_1', period: 'annual', budget_tco2e: 7.5, effective_from: '2026-01-01' },
  ]);

  ctx.report.targets = `${targets?.length ?? 0} targets + FLAG target + 2 carbon budgets`;
  const map: Record<string, string> = {};
  for (const t of targets ?? []) map[(t as any).metric_key] = (t as any).id;
  return map;
}

interface InitiativeSeed {
  title: string;
  description: string;
  lever_id: string | null;
  status: 'draft' | 'pending_approval' | 'active' | 'completed';
  percent_complete: number;
  owner_name: string;
  budget_estimated_gbp?: number;
  expected_annual_reduction_value?: number;
  linkMetric?: string;
}

/** Reduction initiatives across the workflow, linked to abatement levers + targets. */
async function seedInitiatives(ctx: SeedCtx, targetIds: Record<string, string>): Promise<void> {
  const { svc, orgId } = ctx;
  const seeds: InitiativeSeed[] = [
    { title: 'Switch to 100% REGO-backed renewable electricity', description: 'Move all owned sites onto a certified renewable tariff, eliminating market-based Scope 2.', lever_id: 'renewable-electricity', status: 'completed', percent_complete: 100, owner_name: 'Operations', budget_estimated_gbp: 4000, expected_annual_reduction_value: 5200, linkMetric: 'total_co2e' },
    { title: 'Lightweight the wine & spirits glass bottles', description: 'Reduce flint glass from 530g to 420g across the range, cutting embodied packaging emissions.', lever_id: 'lightweight-glass', status: 'active', percent_complete: 55, owner_name: 'Packaging', budget_estimated_gbp: 12000, expected_annual_reduction_value: 3100, linkMetric: 'total_co2e' },
    { title: 'Air-source heat pumps at the brewery', description: 'Replace the gas boiler for low-grade process heat with high-COP heat pumps.', lever_id: 'heat-pumps', status: 'active', percent_complete: 30, owner_name: 'Engineering', budget_estimated_gbp: 85000, expected_annual_reduction_value: 6800, linkMetric: 'total_co2e' },
    { title: 'Divert process waste from landfill to anaerobic digestion', description: 'Send spent grain and pomace to AD instead of landfill.', lever_id: 'waste-diversion', status: 'active', percent_complete: 70, owner_name: 'Sustainability', budget_estimated_gbp: 6000, expected_annual_reduction_value: 1400 },
    { title: 'Switch the distillery boilers to HVO', description: 'Replace fossil diesel/gas thermal fuel with hydrotreated vegetable oil.', lever_id: 'hvo-fuel', status: 'pending_approval', percent_complete: 0, owner_name: 'Engineering', budget_estimated_gbp: 22000, expected_annual_reduction_value: 4200, linkMetric: 'total_co2e' },
    { title: 'On-site solar PV at the brewery', description: 'Install a 250 kWp rooftop array to self-generate ~20% of site electricity.', lever_id: 'solar-onsite', status: 'pending_approval', percent_complete: 0, owner_name: 'Operations', budget_estimated_gbp: 180000, expected_annual_reduction_value: 3600 },
    { title: 'Roll out the paper bottle across the Calvados range', description: 'Extend the Frugalpac paper bottle from a pilot SKU to the full Calvados line.', lever_id: null, status: 'draft', percent_complete: 0, owner_name: 'Packaging', expected_annual_reduction_value: 900 },
  ];

  await svc.from('reduction_initiatives').delete().eq('organization_id', orgId);
  const rows = seeds.map((s) => ({
    organization_id: orgId, title: s.title, description: s.description, lever_id: s.lever_id, status: s.status,
    percent_complete: s.percent_complete, owner_name: s.owner_name, budget_estimated_gbp: s.budget_estimated_gbp ?? null,
    expected_annual_reduction_value: s.expected_annual_reduction_value ?? null, expected_annual_reduction_unit: 'kg CO2e',
    progress_notes: s.status === 'active' || s.status === 'completed' ? 'On track; progress reviewed quarterly.' : null,
    progress_updated_at: s.status === 'active' || s.status === 'completed' ? new Date().toISOString() : null,
    start_date: s.status === 'draft' ? null : '2025-01-15',
  }));
  const { data: inserted, error } = await svc.from('reduction_initiatives').insert(rows).select('id, title');
  if (error) throw new Error(`reduction_initiatives: ${error.message}`);

  // Link emissions initiatives to the emissions target.
  const links: Record<string, unknown>[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const tgt = s.linkMetric ? targetIds[s.linkMetric] : undefined;
    const id = (inserted ?? [])[i] as any;
    if (tgt && id) links.push({ initiative_id: id.id, target_id: tgt });
  }
  if (links.length) await svc.from('initiative_target_links').upsert(links, { onConflict: 'initiative_id,target_id' });

  ctx.report.initiatives = `${rows.length} initiatives (draft→completed) + ${links.length} target links`;
}

/** B Corp 2026 certification record, score history and a small evidence set. */
async function seedBCorp(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  await svc.from('organization_certifications').upsert(
    {
      organization_id: orgId, framework_id: BCORP_FRAMEWORK_ID, status: 'in_progress',
      score_achieved: 74.5, readiness_score: 68, data_completeness: 72, target_date: '2027-06-30', last_assessment_date: '2026-05-31',
      notes: 'Pursuing B Corp certification under the 2026 standard; foundation requirements largely met, impact topics in progress.',
    },
    { onConflict: 'organization_id,framework_id' },
  );

  // progress over the last ~15 months
  await svc.from('certification_score_history').delete().eq('organization_id', orgId).eq('framework_id', BCORP_FRAMEWORK_ID);
  const history = [
    { score_date: '2025-03-31', overall_score: 41.0, requirements_met: 38, requirements_partial: 22, requirements_not_met: 60, data_completeness: 35 },
    { score_date: '2025-09-30', overall_score: 58.0, requirements_met: 62, requirements_partial: 28, requirements_not_met: 30, data_completeness: 54 },
    { score_date: '2026-05-31', overall_score: 74.5, requirements_met: 84, requirements_partial: 18, requirements_not_met: 18, data_completeness: 72 },
  ].map((h) => ({ organization_id: orgId, framework_id: BCORP_FRAMEWORK_ID, total_requirements: 120, ...h }));
  await svc.from('certification_score_history').insert(history);

  // a couple of evidence documents + suggestions against real requirements
  await svc.from('evidence_documents').delete().eq('organization_id', orgId);
  const { data: docs, error: docErr } = await svc
    .from('evidence_documents')
    .insert([
      { organization_id: orgId, title: 'Carbon Reduction Plan 2026', document_name: 'carbon-reduction-plan-2026.pdf', tags: ['climate', 'emissions'], storage_object_path: `${orgId}/demo/carbon-reduction-plan-2026.pdf`, mime_type: 'application/pdf', uploaded_by: OWNER_USER_ID },
      { organization_id: orgId, title: 'Employee Handbook & Code of Conduct', document_name: 'employee-handbook.pdf', tags: ['governance', 'workers'], storage_object_path: `${orgId}/demo/employee-handbook.pdf`, mime_type: 'application/pdf', uploaded_by: OWNER_USER_ID },
    ])
    .select('id, title');
  if (docErr) ctx.warnings.push(`evidence_documents: ${docErr.message}`);

  const { data: reqs } = await svc
    .from('framework_requirements')
    .select('id')
    .eq('framework_id', BCORP_FRAMEWORK_ID)
    .limit(4);
  if (docs && docs.length && reqs && reqs.length) {
    const suggestions: Record<string, unknown>[] = [];
    const half = Math.ceil(reqs.length / 2);
    reqs.slice(0, half).forEach((r: any) => suggestions.push({ organization_id: orgId, evidence_document_id: (docs[0] as any).id, requirement_id: r.id, confidence: 0.82, reasoning: 'Document directly addresses this requirement (demo suggestion).', status: 'pending' }));
    reqs.slice(half).forEach((r: any) => suggestions.push({ organization_id: orgId, evidence_document_id: (docs[1] as any).id, requirement_id: r.id, confidence: 0.76, reasoning: 'Policy evidence relevant to this requirement (demo suggestion).', status: 'pending' }));
    await svc.from('evidence_suggestions').upsert(suggestions, { onConflict: 'evidence_document_id,requirement_id' });
    ctx.report.bcorp = `B Corp record + 3 score-history points + ${docs.length} docs + ${suggestions.length} evidence suggestions`;
  } else {
    ctx.report.bcorp = 'B Corp record + score history + evidence docs (no requirements matched for suggestions)';
  }
}

/** Round out the social pillars: compensation, community stories/engagements, ethics. */
async function seedSocial(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  await svc.from('people_employee_compensation').delete().eq('organization_id', orgId);
  const comp = [
    { role_title: 'Head Distiller', role_level: 'Senior', department: 'Production', annual_salary: 48000, work_region: 'South West' },
    { role_title: 'Cellar Operative', role_level: 'Junior', department: 'Production', annual_salary: 26500, work_region: 'South West' },
    { role_title: 'Sustainability Manager', role_level: 'Mid', department: 'Sustainability', annual_salary: 42000, work_region: 'South West' },
    { role_title: 'Brand Marketing Lead', role_level: 'Mid', department: 'Marketing', annual_salary: 39000, work_region: 'South West' },
    { role_title: 'Finance Assistant', role_level: 'Junior', department: 'Finance', annual_salary: 27000, work_region: 'South West' },
    { role_title: 'Tasting Room Host', role_level: 'Junior', department: 'Hospitality', annual_salary: 24500, work_region: 'South West' },
  ];
  await svc.from('people_employee_compensation').insert(
    comp.map((c) => ({ organization_id: orgId, employment_type: 'full_time', reporting_year: REFERENCE_YEAR, work_country: 'United Kingdom', currency: 'GBP', hours_per_week: 37.5, is_active: true, ...c })),
  );

  await svc.from('community_impact_stories').delete().eq('organization_id', orgId);
  await svc.from('community_impact_stories').insert([
    { organization_id: orgId, title: 'Replanting native hedgerows around the vineyard', is_published: true, story_type: 'environment', summary: 'Working with a local conservation trust to plant 1.8km of native hedgerow, supporting pollinators and farmland birds.', content: 'Over the winter the team and 30 volunteers planted hawthorn, blackthorn and hazel along the vineyard margins...', impact_metrics: { hedgerow_km: 1.8, volunteers: 30 }, published_at: '2026-02-10T00:00:00Z' },
    { organization_id: orgId, title: 'Spent-grain donations to a community farm', is_published: true, story_type: 'community', summary: 'Brewery spent grain now feeds livestock at a nearby care farm instead of going to waste.', content: 'Each week the brewery diverts around 2 tonnes of spent grain to a local care farm...', impact_metrics: { tonnes_per_year: 95 }, published_at: '2026-04-22T00:00:00Z' },
  ]);

  await svc.from('community_engagements').delete().eq('organization_id', orgId);
  await svc.from('community_engagements').insert([
    { organization_id: orgId, engagement_name: 'Local schools sustainability workshops', engagement_type: 'education', description: 'Quarterly workshops on farming, fermentation and carbon for secondary schools.', start_date: '2025-09-01', stakeholder_group: 'Local community', participants_count: 240, outcome_summary: 'Reached six schools across the county.' },
    { organization_id: orgId, engagement_name: 'Supplier sustainability roundtable', engagement_type: 'supply_chain', description: 'Annual roundtable bringing key suppliers together on shared decarbonisation goals.', start_date: '2026-03-12', stakeholder_group: 'Suppliers', participants_count: 14, outcome_summary: 'Agreed a shared packaging-lightweighting roadmap.' },
  ]);

  await svc.from('governance_ethics_records').delete().eq('organization_id', orgId);
  await svc.from('governance_ethics_records').insert([
    { organization_id: orgId, record_type: 'training', record_name: 'Annual Code of Conduct training', record_date: '2026-01-20', description: 'All-staff ethics and anti-bribery training.', participants: 52, completion_rate: 98.0, status: 'completed' },
    { organization_id: orgId, record_type: 'policy', record_name: 'Whistleblowing policy review', record_date: '2025-11-05', description: 'Annual review of the confidential whistleblowing procedure.', status: 'completed' },
  ]);

  ctx.report.social = `${comp.length} compensation rows + 2 stories + 2 engagements + 2 ethics records`;
}

export async function seedProgramme(ctx: SeedCtx): Promise<void> {
  const targetIds = await seedTargets(ctx);
  await seedInitiatives(ctx, targetIds);
  await seedBCorp(ctx);
  await seedSocial(ctx);
}
