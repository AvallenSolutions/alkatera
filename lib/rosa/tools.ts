/**
 * Rosa -- Tool library.
 *
 * Anthropic tool-use definitions Rosa can call during a conversation, plus a
 * dispatcher that executes each tool with an organisation-scoped service-role
 * client.
 *
 * Security model
 * ==============
 * The `organization_id` for every tool call comes from the caller's session,
 * NEVER from the model's arguments. Tools receive it as an implicit parameter
 * (via `ToolContext`) and the model cannot override it. This is the primary
 * defence against cross-org data leakage.
 *
 * Tools are additive and pure-read. Any future write tool must go through an
 * explicit confirmation flow in the UI, not the tool-use loop.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { runSafeSql, SAFE_SQL_ALLOWED_TABLES } from './safe-sql';
import { ALL_METRIC_KEYS, METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { listMemories, saveMemory, type MemoryScope } from './memory';
import { proposeAction } from './actions';
import { getBenchmarkForProductType } from '@/lib/industry-benchmarks';

export interface ToolContext {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  /** Optional conversation id for attaching pending actions. */
  conversationId?: string | null;
}

/** Tool names that create a pending action (user must confirm). */
export const ACTION_TOOL_NAMES = [
  'propose_log_utility_entry',
  'propose_set_target',
  'propose_add_supplier',
] as const;
export type ActionToolName = typeof ACTION_TOOL_NAMES[number];

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Tool schemas advertised to Claude. Keep descriptions action-oriented so the
 * model picks the right tool without extra prompting.
 */
export const ROSA_TOOLS: ToolDefinition[] = [
  {
    name: 'get_org_context',
    description:
      "Returns a compact snapshot of the caller's organisation: name, industry segment, facility count, product count, active targets, and report-defaults (fiscal year, timezone, currency). Call this first when a question needs org-level context.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_facilities',
    description:
      "Lists the organisation's facilities with id, name, country, type and primary-activity category. Use for site-level questions ('which site…?').",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_products',
    description:
      "Lists the organisation's products with id, name, product type, and whether a completed LCA exists. Filter with `only_with_lca` when you want just the assessed ones.",
    input_schema: {
      type: 'object',
      properties: {
        only_with_lca: {
          type: 'boolean',
          description: 'If true, returns only products with a completed LCA.',
        },
        limit: {
          type: 'number',
          description: 'Max rows to return (default 50, hard cap 200).',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_pulse_metrics',
    description:
      "Queries metric_snapshots time-series. Returns daily values for one metric over a date range. Use for trend, delta, and 'when did X change?' questions.",
    input_schema: {
      type: 'object',
      properties: {
        metric_key: {
          type: 'string',
          enum: ALL_METRIC_KEYS,
          description: 'The metric to query (e.g. total_co2e, water_consumption).',
        },
        start_date: {
          type: 'string',
          description: 'ISO date (YYYY-MM-DD), inclusive. Defaults to 90 days before end_date.',
        },
        end_date: {
          type: 'string',
          description: 'ISO date (YYYY-MM-DD), inclusive. Defaults to today.',
        },
      },
      required: ['metric_key'],
    },
  },
  {
    name: 'compare_facilities',
    description:
      "Compares one metric across the org's facilities for a window. Returns per-facility totals and ranks. Use when the user asks 'which site is worst for X' or 'rank our facilities by Y'.",
    input_schema: {
      type: 'object',
      properties: {
        metric_key: {
          type: 'string',
          enum: ALL_METRIC_KEYS,
          description: 'The metric to compare (e.g. total_co2e, water_consumption).',
        },
        days: {
          type: 'number',
          description: 'Window in days, ending today. Default 90, min 7, max 365.',
        },
      },
      required: ['metric_key'],
    },
  },
  {
    name: 'list_recent_anomalies',
    description:
      "Lists open anomalies the detector has flagged in the last N days. Returns metric, observed/expected, z-score, severity. Use to answer 'what changed' or 'what's flagged' questions.",
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Look-back window. Default 14, max 90.',
        },
        min_severity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Minimum severity to include. Default low.',
        },
      },
      required: [],
    },
  },
  {
    name: 'run_safe_sql',
    description:
      `Runs a read-only SELECT against a whitelist of org-scoped tables. The SQL you write MUST include a WHERE filter on organization_id (the dispatcher will also inject one as belt-and-braces). Allowed tables: ${SAFE_SQL_ALLOWED_TABLES.join(', ')}. Use this only when the purpose-built tools above can't express the question.`,
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description:
            'A single SELECT statement. No DDL, DML, transactions, CTEs that reference non-whitelisted tables, or functions. Must be <= 4000 chars.',
        },
        reason: {
          type: 'string',
          description:
            'One sentence explaining why the purpose-built tools were insufficient. Shown in the audit trail.',
        },
      },
      required: ['sql', 'reason'],
    },
  },
  // ───────────── Discovery tools ─────────────
  {
    name: 'list_suppliers',
    description:
      "Lists the organisation's suppliers with id, name, country, industry and contact. Use for supply-chain / Scope 3 questions.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows to return (default 50, hard cap 200).' },
      },
      required: [],
    },
  },
  {
    name: 'list_lcas',
    description:
      "Lists the organisation's product carbon footprints (LCAs): id, product name, status (draft|in_progress|completed), reference year, total CO2e where available. Use to answer 'which products have LCAs' or 'which are still draft'.",
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'in_progress', 'completed', 'any'],
          description: 'Filter by LCA status. Defaults to any.',
        },
        limit: { type: 'number', description: 'Max rows to return (default 50, hard cap 200).' },
      },
      required: [],
    },
  },
  {
    name: 'list_reports',
    description:
      "Lists sustainability reports generated by the org, with id, name, year, reporting period, audience, standards covered.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows to return (default 25, hard cap 100).' },
      },
      required: [],
    },
  },
  {
    name: 'list_insights',
    description:
      'Lists the latest Rosa/Pulse-generated daily insights (headlines + confidence). Use to surface what the overnight analysis flagged.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look-back window in days. Default 7, max 60.' },
        limit: { type: 'number', description: 'Max rows. Default 10, hard cap 30.' },
      },
      required: [],
    },
  },
  // ───────────── Deep-read tools ─────────────
  {
    name: 'get_product_footprint',
    description:
      "Returns the most recent completed LCA footprint for a product: total CO2e per functional unit, life-cycle stage breakdown, methodology. Use when the user asks 'what is product X's carbon footprint?'.",
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'The product UUID (from list_products.id).' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'get_lca_summary',
    description:
      "Returns a one-page summary of an LCA: id, product, status, methodology, scope, CO2e total, any completeness flags, data quality summary.",
    input_schema: {
      type: 'object',
      properties: {
        lca_id: { type: 'string', description: 'The product_carbon_footprints UUID.' },
      },
      required: ['lca_id'],
    },
  },
  // ───────────── Knowledge / coaching tools ─────────────
  {
    name: 'search_knowledge_bank',
    description:
      "Search the curated sustainability knowledge base (ISO 14044, ISO 14067, VSME, CSRD, UK Green Claims Code, GHG Protocol, BIER benchmarks, pedigree matrix, etc.). Returns entries with title, content, source_url you MUST cite.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search query.' },
        category: {
          type: 'string',
          description: "Optional filter: iso_methodology | reporting_framework | regulation | benchmark | definition.",
        },
        limit: { type: 'number', description: 'Max entries. Default 5, max 15.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'explain_methodology',
    description:
      "Look up a named sustainability methodology, standard, or regulation (ISO 14044, ISO 14067, VSME, CSRD ESRS E1, UK Green Claims Code, GHG Protocol, pedigree matrix, cradle-to-gate, Scope 1/2/3). Returns the definitive entry from the knowledge base with a source_url you MUST include in your answer.",
    input_schema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'The standard, regulation, or term to explain.' },
      },
      required: ['term'],
    },
  },
  {
    name: 'compare_to_benchmark',
    description:
      "Compares a product's current LCA footprint against the published industry benchmark (BIER, ecoinvent, published LCA studies) for its product type. Returns % above/below and a short interpretation. Use when the user asks 'how do we compare?'.",
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product UUID.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'suggest_data_gaps',
    description:
      "Identifies the single next most-valuable data-capture step for this org (e.g. 'add a supplier', 'complete the canning facility allocation', 'close reporting period X'). Use when the user asks 'what should I do next?'.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  // ───────────── Memory tools ─────────────
  {
    name: 'list_memories',
    description:
      'Lists what Rosa has previously remembered about this user and organisation. Useful at the start of a conversation to ground your context.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'save_memory',
    description:
      "Save a stable fact or preference so Rosa remembers it in future conversations. Use sparingly: only for facts the user states explicitly or that you'd want to carry forward (e.g. 'prefers brief answers', 'primary bottler is contract', 'reports to VSME not CSRD'). Do NOT save ephemeral session state.",
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['user', 'org'],
          description: "user = personal to this user; org = shared across the whole organisation.",
        },
        key: { type: 'string', description: 'Short snake_case identifier, e.g. response_style, primary_framework.' },
        value: { type: 'string', description: 'The fact or preference in one short sentence.' },
      },
      required: ['scope', 'key', 'value'],
    },
  },
  // ───────────── Action tools (confirmation-gated) ─────────────
  {
    name: 'propose_log_utility_entry',
    description:
      "Propose logging a utility meter reading or bill (electricity, gas, water, fuel) for a facility. The user MUST confirm before the row is written. Use when the user says something like 'log 2,400 kWh at our distillery for October'. Always include all required fields; ask the user for missing ones first.",
    input_schema: {
      type: 'object',
      properties: {
        facility_id: { type: 'string', description: 'Facility UUID (from list_facilities).' },
        utility_type: {
          type: 'string',
          description: "electricity | natural_gas | water_intake | fuel_diesel | fuel_petrol | lpg | other",
        },
        quantity: { type: 'number', description: 'Numeric quantity.' },
        unit: { type: 'string', description: 'Unit string, e.g. kWh, m3, litres.' },
        reporting_period_start: { type: 'string', description: 'ISO date (YYYY-MM-DD) start of the period this reading covers.' },
        reporting_period_end: { type: 'string', description: 'ISO date (YYYY-MM-DD) end of period.' },
        activity_date: { type: 'string', description: 'Optional invoice or meter-read date.' },
        notes: { type: 'string', description: 'Optional free-text notes.' },
      },
      required: ['facility_id', 'utility_type', 'quantity', 'unit', 'reporting_period_start', 'reporting_period_end'],
    },
  },
  {
    name: 'propose_set_target',
    description:
      "Propose creating a new sustainability target (e.g. 'cut Scope 1+2 by 30% by 2030'). Writes to sustainability_targets after user confirmation. Pair baseline with target so progress is measurable.",
    input_schema: {
      type: 'object',
      properties: {
        metric_key: { type: 'string', description: 'Metric key, e.g. total_co2e, water_consumption.' },
        baseline_value: { type: 'number', description: 'Baseline numeric value.' },
        baseline_date: { type: 'string', description: 'ISO date of the baseline.' },
        target_value: { type: 'number', description: 'Target numeric value.' },
        target_date: { type: 'string', description: 'ISO date by which to hit the target.' },
        scope: { type: 'string', description: "Optional scope descriptor, e.g. 'scope_1_2' or 'scope_3'." },
        methodology: { type: 'string', description: 'Optional methodology note, e.g. SBTi aligned.' },
        notes: { type: 'string', description: 'Optional notes.' },
      },
      required: ['metric_key', 'baseline_value', 'baseline_date', 'target_value', 'target_date'],
    },
  },
  {
    name: 'propose_add_supplier',
    description:
      "Propose adding a new supplier record. Writes to suppliers after user confirmation. Useful when the user mentions a partner by name that isn't on the list yet.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Supplier company name.' },
        contact_name: { type: 'string', description: 'Optional contact person.' },
        contact_email: { type: 'string', description: 'Optional contact email.' },
        industry_sector: { type: 'string', description: 'Optional industry sector.' },
        country: { type: 'string', description: 'Optional country.' },
        website: { type: 'string', description: 'Optional website URL.' },
        annual_spend: { type: 'number', description: 'Optional annual spend in GBP.' },
        notes: { type: 'string', description: 'Optional notes.' },
      },
      required: ['name'],
    },
  },
];

/** Shape returned by the dispatcher. `is_error=true` lets Claude self-correct. */
export interface ToolResult {
  is_error: boolean;
  content: string;
  /** Structured data stored in gaia_messages.data_sources for audit. */
  audit: Record<string, unknown>;
}

/** Central tool execution. Narrow the input then dispatch. */
export async function executeTool(
  ctx: ToolContext,
  name: string,
  input: unknown,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_org_context':
        return await toolGetOrgContext(ctx);
      case 'list_facilities':
        return await toolListFacilities(ctx);
      case 'list_products':
        return await toolListProducts(ctx, input as { only_with_lca?: boolean; limit?: number });
      case 'query_pulse_metrics':
        return await toolQueryPulseMetrics(
          ctx,
          input as { metric_key: MetricKey; start_date?: string; end_date?: string },
        );
      case 'compare_facilities':
        return await toolCompareFacilities(
          ctx,
          input as { metric_key: MetricKey; days?: number },
        );
      case 'list_recent_anomalies':
        return await toolListRecentAnomalies(
          ctx,
          input as { days?: number; min_severity?: 'low' | 'medium' | 'high' },
        );
      case 'run_safe_sql':
        return await toolRunSafeSql(ctx, input as { sql: string; reason: string });
      case 'list_suppliers':
        return await toolListSuppliers(ctx, input as { limit?: number });
      case 'list_lcas':
        return await toolListLcas(ctx, input as { status?: string; limit?: number });
      case 'list_reports':
        return await toolListReports(ctx, input as { limit?: number });
      case 'list_insights':
        return await toolListInsights(ctx, input as { days?: number; limit?: number });
      case 'get_product_footprint':
        return await toolGetProductFootprint(ctx, input as { product_id: string });
      case 'get_lca_summary':
        return await toolGetLcaSummary(ctx, input as { lca_id: string });
      case 'search_knowledge_bank':
        return await toolSearchKnowledgeBank(ctx, input as { query: string; category?: string; limit?: number });
      case 'explain_methodology':
        return await toolExplainMethodology(ctx, input as { term: string });
      case 'compare_to_benchmark':
        return await toolCompareToBenchmark(ctx, input as { product_id: string });
      case 'suggest_data_gaps':
        return await toolSuggestDataGaps(ctx);
      case 'list_memories':
        return await toolListMemories(ctx);
      case 'save_memory':
        return await toolSaveMemory(ctx, input as { scope: MemoryScope; key: string; value: string });
      case 'propose_log_utility_entry':
      case 'propose_set_target':
      case 'propose_add_supplier':
        return await toolProposeAction(ctx, name as ActionToolName, input as Record<string, unknown>);
      default:
        return {
          is_error: true,
          content: `Unknown tool: ${name}`,
          audit: { tool: name, error: 'unknown_tool' },
        };
    }
  } catch (err: any) {
    return {
      is_error: true,
      content: `Tool ${name} threw: ${err?.message ?? 'unknown error'}`,
      audit: { tool: name, error: err?.message ?? 'unknown' },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual tool implementations. Kept small and boring: pull data, shape it
// for a language model (labels + units + small arrays), return JSON text.
// ─────────────────────────────────────────────────────────────────────────────

async function toolGetOrgContext(ctx: ToolContext): Promise<ToolResult> {
  const { supabase, organizationId } = ctx;
  const [org, facilityCount, productCount, targets] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, industry_segment, report_defaults')
      .eq('id', organizationId)
      .maybeSingle(),
    supabase
      .from('facilities')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('sustainability_targets')
      .select('metric_key, target_value, target_date, status')
      .eq('organization_id', organizationId)
      .eq('status', 'active'),
  ]);

  const payload = {
    organization: org.data ?? null,
    facility_count: facilityCount.count ?? 0,
    product_count: productCount.count ?? 0,
    active_targets: (targets.data ?? []).map(t => ({
      ...t,
      metric_label: METRIC_DEFINITIONS[t.metric_key as MetricKey]?.label ?? t.metric_key,
    })),
  };

  return {
    is_error: false,
    content: JSON.stringify(payload),
    audit: { tool: 'get_org_context', row_counts: {
      facilities: payload.facility_count,
      products: payload.product_count,
      targets: payload.active_targets.length,
    } },
  };
}

async function toolListFacilities(ctx: ToolContext): Promise<ToolResult> {
  const { data, error } = await ctx.supabase
    .from('facilities')
    .select('id, name, facility_type, location_country_code, address_country, primary_activity')
    .eq('organization_id', ctx.organizationId)
    .order('name');
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'list_facilities', error: error.message } };
  }
  return {
    is_error: false,
    content: JSON.stringify(data ?? []),
    audit: { tool: 'list_facilities', row_count: data?.length ?? 0 },
  };
}

async function toolListProducts(
  ctx: ToolContext,
  input: { only_with_lca?: boolean; limit?: number },
): Promise<ToolResult> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const { data: products, error } = await ctx.supabase
    .from('products')
    .select('id, name, product_type, created_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'list_products', error: error.message } };
  }

  const productIds = (products ?? []).map(p => p.id);
  const assessed = new Set<string>();
  if (productIds.length > 0) {
    const { data: pcfs } = await ctx.supabase
      .from('product_carbon_footprints')
      .select('product_id')
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'completed')
      .in('product_id', productIds);
    for (const p of pcfs ?? []) if ((p as any).product_id) assessed.add((p as any).product_id);
  }

  let rows = (products ?? []).map(p => ({ ...p, has_completed_lca: assessed.has(p.id) }));
  if (input?.only_with_lca) rows = rows.filter(r => r.has_completed_lca);

  return {
    is_error: false,
    content: JSON.stringify(rows),
    audit: { tool: 'list_products', row_count: rows.length, filtered: Boolean(input?.only_with_lca) },
  };
}

async function toolQueryPulseMetrics(
  ctx: ToolContext,
  input: { metric_key: MetricKey; start_date?: string; end_date?: string },
): Promise<ToolResult> {
  if (!input?.metric_key || !(input.metric_key in METRIC_DEFINITIONS)) {
    return {
      is_error: true,
      content: `Unknown metric_key. Allowed: ${ALL_METRIC_KEYS.join(', ')}`,
      audit: { tool: 'query_pulse_metrics', error: 'bad_metric_key' },
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  const endDate = input.end_date ?? today;
  const startDate =
    input.start_date ??
    new Date(new Date(endDate).getTime() - 90 * 86400_000).toISOString().slice(0, 10);

  const { data, error } = await ctx.supabase
    .from('metric_snapshots')
    .select('snapshot_date, value, unit, scope, dimensions')
    .eq('organization_id', ctx.organizationId)
    .eq('metric_key', input.metric_key)
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: true });

  if (error) {
    return {
      is_error: true,
      content: error.message,
      audit: { tool: 'query_pulse_metrics', error: error.message },
    };
  }

  const def = METRIC_DEFINITIONS[input.metric_key];
  return {
    is_error: false,
    content: JSON.stringify({
      metric_key: input.metric_key,
      metric_label: def.label,
      unit: def.unit,
      start_date: startDate,
      end_date: endDate,
      points: data ?? [],
    }),
    audit: {
      tool: 'query_pulse_metrics',
      metric_key: input.metric_key,
      point_count: data?.length ?? 0,
    },
  };
}

/**
 * Compare a single metric across facilities. Sums facility_activity_entries
 * for the chosen metric over the window and ranks by total. Returns clean
 * tabular data the model can summarise verbally.
 */
async function toolCompareFacilities(
  ctx: ToolContext,
  input: { metric_key: MetricKey; days?: number },
): Promise<ToolResult> {
  if (!input?.metric_key || !(input.metric_key in METRIC_DEFINITIONS)) {
    return {
      is_error: true,
      content: `Unknown metric_key. Allowed: ${ALL_METRIC_KEYS.join(', ')}`,
      audit: { tool: 'compare_facilities', error: 'bad_metric_key' },
    };
  }

  const days = Math.max(7, Math.min(365, Number(input.days ?? 90)));
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Reuse the same category->metric mapping as the waterfall API.
  const categoriesForMetric = (m: MetricKey): string[] => {
    if (m === 'total_co2e') {
      return [
        'utility_electricity', 'utility_gas', 'utility_fuel', 'utility_other',
        'waste_general', 'waste_hazardous',
      ];
    }
    if (m === 'water_consumption') return ['water_intake'];
    return [];
  };
  const valueColumn = (m: MetricKey): 'calculated_emissions_kg_co2e' | 'quantity' =>
    m === 'total_co2e' ? 'calculated_emissions_kg_co2e' : 'quantity';

  const cats = categoriesForMetric(input.metric_key);
  if (cats.length === 0) {
    return {
      is_error: false,
      content: JSON.stringify({
        metric_key: input.metric_key,
        rows: [],
        note: 'Per-facility breakdown not available for this metric yet.',
      }),
      audit: { tool: 'compare_facilities', metric_key: input.metric_key, row_count: 0 },
    };
  }

  const col = valueColumn(input.metric_key);
  const [{ data: facilities }, { data: entries }] = await Promise.all([
    ctx.supabase
      .from('facilities')
      .select('id, name')
      .eq('organization_id', ctx.organizationId),
    ctx.supabase
      .from('facility_activity_entries')
      .select(`facility_id, ${col}`)
      .eq('organization_id', ctx.organizationId)
      .in('activity_category', cats)
      .gte('activity_date', fmt(start))
      .lt('activity_date', fmt(end)),
  ]);

  // emissions stored in kg, presented in tonnes for total_co2e
  const scale = input.metric_key === 'total_co2e' ? 1 / 1000 : 1;
  const sums = new Map<string, number>();
  for (const row of (entries ?? []) as Array<Record<string, unknown>>) {
    const fid = row.facility_id as string | null;
    if (!fid) continue;
    const v = Number(row[col] ?? 0);
    if (Number.isFinite(v)) sums.set(fid, (sums.get(fid) ?? 0) + v * scale);
  }
  const def = METRIC_DEFINITIONS[input.metric_key];
  const rows = (facilities ?? [])
    .map(f => ({
      facility_id: f.id,
      facility_name: f.name,
      total: sums.get(f.id) ?? 0,
    }))
    .filter(r => Math.abs(r.total) > 1e-9)
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return {
    is_error: false,
    content: JSON.stringify({
      metric_key: input.metric_key,
      metric_label: def.label,
      unit: def.unit,
      window_days: days,
      window_start: fmt(start),
      window_end: fmt(end),
      rows,
    }),
    audit: {
      tool: 'compare_facilities',
      metric_key: input.metric_key,
      window_days: days,
      row_count: rows.length,
    },
  };
}

async function toolListRecentAnomalies(
  ctx: ToolContext,
  input: { days?: number; min_severity?: 'low' | 'medium' | 'high' },
): Promise<ToolResult> {
  const days = Math.max(1, Math.min(90, Number(input?.days ?? 14)));
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sevOrder = { low: 0, medium: 1, high: 2 } as const;
  const minSev = input?.min_severity ?? 'low';

  const { data, error } = await ctx.supabase
    .from('dashboard_anomalies')
    .select('id, metric_key, detected_at, severity, observed, expected, z_score, status')
    .eq('organization_id', ctx.organizationId)
    .gte('detected_at', since.toISOString())
    .order('detected_at', { ascending: false })
    .limit(50);

  if (error) {
    return {
      is_error: true,
      content: error.message,
      audit: { tool: 'list_recent_anomalies', error: error.message },
    };
  }

  const filtered = (data ?? []).filter(
    r => sevOrder[(r.severity as keyof typeof sevOrder) ?? 'low'] >= sevOrder[minSev],
  );
  const enriched = filtered.map(r => ({
    ...r,
    metric_label:
      METRIC_DEFINITIONS[r.metric_key as MetricKey]?.label ?? r.metric_key,
  }));

  return {
    is_error: false,
    content: JSON.stringify({
      window_days: days,
      min_severity: minSev,
      anomalies: enriched,
    }),
    audit: {
      tool: 'list_recent_anomalies',
      window_days: days,
      row_count: enriched.length,
    },
  };
}

async function toolRunSafeSql(
  ctx: ToolContext,
  input: { sql: string; reason: string },
): Promise<ToolResult> {
  const res = await runSafeSql(ctx.supabase, ctx.organizationId, input?.sql ?? '');
  return {
    is_error: !res.ok,
    content: res.ok
      ? JSON.stringify({ row_count: res.rows.length, rows: res.rows })
      : res.error,
    audit: {
      tool: 'run_safe_sql',
      ok: res.ok,
      reason: input?.reason ?? null,
      sql_preview: (input?.sql ?? '').slice(0, 400),
      row_count: res.ok ? res.rows.length : 0,
      error: res.ok ? null : res.error,
    },
  };
}

// ─── Discovery tools ─────────────────────────────────────────────────────────

async function toolListSuppliers(
  ctx: ToolContext,
  input: { limit?: number },
): Promise<ToolResult> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const { data, error } = await ctx.supabase
    .from('suppliers')
    .select('id, name, industry_sector, country, contact_email, annual_spend')
    .eq('organization_id', ctx.organizationId)
    .order('name')
    .limit(limit);
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'list_suppliers', error: error.message } };
  }
  return {
    is_error: false,
    content: JSON.stringify(data ?? []),
    audit: { tool: 'list_suppliers', row_count: data?.length ?? 0 },
  };
}

async function toolListLcas(
  ctx: ToolContext,
  input: { status?: string; limit?: number },
): Promise<ToolResult> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  let q = ctx.supabase
    .from('product_carbon_footprints')
    .select('id, product_name, product_id, status, reference_year, lca_scope_type, lca_methodology, updated_at')
    .eq('organization_id', ctx.organizationId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (input?.status && input.status !== 'any') {
    q = q.eq('status', input.status);
  }
  const { data, error } = await q;
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'list_lcas', error: error.message } };
  }
  return {
    is_error: false,
    content: JSON.stringify(data ?? []),
    audit: { tool: 'list_lcas', row_count: data?.length ?? 0, status: input?.status ?? 'any' },
  };
}

async function toolListReports(
  ctx: ToolContext,
  input: { limit?: number },
): Promise<ToolResult> {
  const limit = Math.min(Math.max(input?.limit ?? 25, 1), 100);
  const { data, error } = await ctx.supabase
    .from('generated_reports')
    .select('id, report_name, report_year, reporting_period_start, reporting_period_end, audience, standards, created_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'list_reports', error: error.message } };
  }
  return {
    is_error: false,
    content: JSON.stringify(data ?? []),
    audit: { tool: 'list_reports', row_count: data?.length ?? 0 },
  };
}

async function toolListInsights(
  ctx: ToolContext,
  input: { days?: number; limit?: number },
): Promise<ToolResult> {
  const days = Math.min(Math.max(input?.days ?? 7, 1), 60);
  const limit = Math.min(Math.max(input?.limit ?? 10, 1), 30);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await ctx.supabase
    .from('dashboard_insights')
    .select('id, generated_at, period, headline, narrative_md, confidence, supporting_metrics')
    .eq('organization_id', ctx.organizationId)
    .gte('generated_at', since.toISOString())
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'list_insights', error: error.message } };
  }
  return {
    is_error: false,
    content: JSON.stringify(data ?? []),
    audit: { tool: 'list_insights', row_count: data?.length ?? 0, days },
  };
}

// ─── Deep-read tools ────────────────────────────────────────────────────────

async function toolGetProductFootprint(
  ctx: ToolContext,
  input: { product_id: string },
): Promise<ToolResult> {
  if (!input?.product_id) {
    return { is_error: true, content: 'product_id is required', audit: { tool: 'get_product_footprint', error: 'missing_product_id' } };
  }

  // product_id in product_carbon_footprints is bigint; look up numeric bigint id for the product UUID
  const { data: product } = await ctx.supabase
    .from('products')
    .select('id, name, product_type')
    .eq('organization_id', ctx.organizationId)
    .eq('id', input.product_id)
    .maybeSingle();

  if (!product) {
    return { is_error: true, content: 'Product not found in this organisation', audit: { tool: 'get_product_footprint', error: 'not_found' } };
  }

  const { data: pcf } = await ctx.supabase
    .from('product_carbon_footprints')
    .select('id, product_name, status, reference_year, functional_unit, lca_scope_type, lca_methodology, aggregated_impacts, data_quality_summary, updated_at')
    .eq('organization_id', ctx.organizationId)
    .eq('product_id', (product as any).id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pcf) {
    return {
      is_error: false,
      content: JSON.stringify({
        product: { id: (product as any).id, name: (product as any).name, product_type: (product as any).product_type },
        footprint: null,
        note: 'No completed LCA found for this product.',
      }),
      audit: { tool: 'get_product_footprint', product_id: input.product_id, has_lca: false },
    };
  }

  return {
    is_error: false,
    content: JSON.stringify({
      product: { id: (product as any).id, name: (product as any).name, product_type: (product as any).product_type },
      footprint: pcf,
    }),
    audit: { tool: 'get_product_footprint', product_id: input.product_id, lca_id: (pcf as any).id, has_lca: true },
  };
}

async function toolGetLcaSummary(
  ctx: ToolContext,
  input: { lca_id: string },
): Promise<ToolResult> {
  if (!input?.lca_id) {
    return { is_error: true, content: 'lca_id is required', audit: { tool: 'get_lca_summary', error: 'missing_lca_id' } };
  }
  const { data, error } = await ctx.supabase
    .from('product_carbon_footprints')
    .select('id, product_name, product_id, status, reference_year, functional_unit, lca_scope_type, lca_methodology, aggregated_impacts, data_quality_summary, ingredients_complete, packaging_complete, production_complete, csrd_compliant, updated_at')
    .eq('organization_id', ctx.organizationId)
    .eq('id', input.lca_id)
    .maybeSingle();
  if (error || !data) {
    return { is_error: true, content: error?.message || 'LCA not found', audit: { tool: 'get_lca_summary', error: error?.message || 'not_found' } };
  }
  return {
    is_error: false,
    content: JSON.stringify(data),
    audit: { tool: 'get_lca_summary', lca_id: input.lca_id, status: (data as any).status },
  };
}

// ─── Knowledge / coaching tools ─────────────────────────────────────────────

async function toolSearchKnowledgeBank(
  ctx: ToolContext,
  input: { query: string; category?: string; limit?: number },
): Promise<ToolResult> {
  const query = (input?.query ?? '').trim();
  const limit = Math.min(Math.max(input?.limit ?? 5, 1), 15);
  if (!query) {
    return { is_error: true, content: 'query is required', audit: { tool: 'search_knowledge_bank', error: 'missing_query' } };
  }
  // Simple ilike search across title+content+tags. Good enough for Phase 1;
  // swap to embeddings later via lib/gaia/knowledge-search.ts.
  let q = ctx.supabase
    .from('gaia_knowledge_base')
    .select('id, entry_type, title, content, category, tags, source_url, priority')
    .eq('is_active', true)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('priority', { ascending: false })
    .limit(limit);
  if (input?.category) q = q.eq('category', input.category);
  const { data, error } = await q;
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'search_knowledge_bank', error: error.message } };
  }
  return {
    is_error: false,
    content: JSON.stringify({
      query,
      category: input?.category ?? null,
      entries: (data ?? []).map((e: any) => ({
        id: e.id,
        title: e.title,
        content: e.content,
        category: e.category,
        tags: e.tags,
        source_url: e.source_url,
      })),
    }),
    audit: { tool: 'search_knowledge_bank', query, row_count: data?.length ?? 0 },
  };
}

async function toolExplainMethodology(
  ctx: ToolContext,
  input: { term: string },
): Promise<ToolResult> {
  const term = (input?.term ?? '').trim();
  if (!term) {
    return { is_error: true, content: 'term is required', audit: { tool: 'explain_methodology', error: 'missing_term' } };
  }
  const { data } = await ctx.supabase
    .from('gaia_knowledge_base')
    .select('id, title, content, category, source_url, priority')
    .eq('is_active', true)
    .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
    .order('priority', { ascending: false })
    .limit(3);
  if (!data || data.length === 0) {
    return {
      is_error: false,
      content: JSON.stringify({ term, entries: [], note: 'No matching methodology found in the knowledge base.' }),
      audit: { tool: 'explain_methodology', term, row_count: 0 },
    };
  }
  return {
    is_error: false,
    content: JSON.stringify({ term, entries: data }),
    audit: { tool: 'explain_methodology', term, row_count: data.length },
  };
}

async function toolCompareToBenchmark(
  ctx: ToolContext,
  input: { product_id: string },
): Promise<ToolResult> {
  if (!input?.product_id) {
    return { is_error: true, content: 'product_id is required', audit: { tool: 'compare_to_benchmark', error: 'missing_product_id' } };
  }
  const { data: product } = await ctx.supabase
    .from('products')
    .select('id, name, product_type, volume_ml')
    .eq('organization_id', ctx.organizationId)
    .eq('id', input.product_id)
    .maybeSingle();
  if (!product) {
    return { is_error: true, content: 'Product not found', audit: { tool: 'compare_to_benchmark', error: 'not_found' } };
  }

  const { data: pcf } = await ctx.supabase
    .from('product_carbon_footprints')
    .select('id, aggregated_impacts, functional_unit')
    .eq('organization_id', ctx.organizationId)
    .eq('product_id', (product as any).id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { benchmark } = getBenchmarkForProductType((product as any).product_type ?? null);

  let productCo2ePerLitre: number | null = null;
  if (pcf && (pcf as any).aggregated_impacts) {
    const impacts = (pcf as any).aggregated_impacts as Record<string, any>;
    const total = Number(impacts?.total_co2e_kg ?? impacts?.co2e_kg ?? impacts?.total_kg_co2e ?? NaN);
    const volumeMl = Number((product as any).volume_ml ?? 750);
    if (Number.isFinite(total) && volumeMl > 0) {
      productCo2ePerLitre = total / (volumeMl / 1000);
    }
  }

  const payload: any = {
    product: { id: (product as any).id, name: (product as any).name, product_type: (product as any).product_type },
    benchmark: {
      value_kg_co2e_per_litre: benchmark.kgCO2ePerLitre,
      source: benchmark.sourceName,
      source_url: benchmark.sourceUrl,
    },
    product_co2e_per_litre: productCo2ePerLitre,
  };
  if (productCo2ePerLitre !== null && benchmark.kgCO2ePerLitre > 0) {
    const deltaPct = ((productCo2ePerLitre - benchmark.kgCO2ePerLitre) / benchmark.kgCO2ePerLitre) * 100;
    payload.delta_pct = Number(deltaPct.toFixed(1));
    payload.interpretation = deltaPct < -5
      ? 'Below industry average.'
      : deltaPct > 5
        ? 'Above industry average.'
        : 'Roughly at industry average.';
  } else {
    payload.note = 'Not enough data to compute delta — either no completed LCA or missing volume.';
  }

  return {
    is_error: false,
    content: JSON.stringify(payload),
    audit: { tool: 'compare_to_benchmark', product_id: input.product_id, has_delta: payload.delta_pct !== undefined },
  };
}

async function toolSuggestDataGaps(ctx: ToolContext): Promise<ToolResult> {
  const { supabase, organizationId } = ctx;
  const [products, facilities, suppliers, completedLcas] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('facilities').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('product_carbon_footprints').select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId).eq('status', 'completed'),
  ]);

  const p = products.count ?? 0;
  const f = facilities.count ?? 0;
  const s = suppliers.count ?? 0;
  const lc = completedLcas.count ?? 0;

  let next: { step: string; why: string; href: string };
  if (p === 0) {
    next = { step: 'Add your first product', why: 'Rosa needs at least one product to calculate an LCA for.', href: '/products' };
  } else if (f === 0) {
    next = { step: 'Add a facility', why: 'Footprints need to know where production happens so we can allocate energy and water.', href: '/company/facilities' };
  } else if (s === 0) {
    next = { step: 'Add a supplier', why: 'Scope 3 (the biggest chunk of a drinks footprint) needs supplier data.', href: '/suppliers' };
  } else if (lc === 0) {
    next = { step: 'Complete your first LCA', why: 'An LCA makes the rest of Rosa come alive: benchmarks, hotspots, reports.', href: '/products' };
  } else {
    // Find the oldest in-progress LCA or product missing an LCA.
    const { data: drafts } = await supabase
      .from('product_carbon_footprints')
      .select('id, product_name, status, updated_at')
      .eq('organization_id', organizationId)
      .in('status', ['draft', 'in_progress'])
      .order('updated_at', { ascending: true })
      .limit(1);
    if (drafts && drafts.length > 0) {
      next = {
        step: `Finish the LCA for ${(drafts[0] as any).product_name}`,
        why: 'Draft/in-progress LCAs block reporting and compliance claims.',
        href: `/products`,
      };
    } else {
      next = {
        step: 'Set a reduction target',
        why: 'You have a baseline now. Next lever is committing to a reduction target you can report against.',
        href: '/performance',
      };
    }
  }

  return {
    is_error: false,
    content: JSON.stringify({ counts: { products: p, facilities: f, suppliers: s, completed_lcas: lc }, next }),
    audit: { tool: 'suggest_data_gaps', next_step: next.step },
  };
}

// ─── Memory tools ───────────────────────────────────────────────────────────

async function toolListMemories(ctx: ToolContext): Promise<ToolResult> {
  const entries = await listMemories(ctx.supabase, ctx.organizationId, ctx.userId);
  return {
    is_error: false,
    content: JSON.stringify({
      entries: entries.map(e => ({ scope: e.scope, key: e.key, value: e.value, updated_at: e.updated_at })),
    }),
    audit: { tool: 'list_memories', row_count: entries.length },
  };
}

async function toolSaveMemory(
  ctx: ToolContext,
  input: { scope: MemoryScope; key: string; value: string },
): Promise<ToolResult> {
  const scope = input?.scope === 'org' ? 'org' : 'user';
  const res = await saveMemory(ctx.supabase, ctx.organizationId, ctx.userId, scope, input?.key ?? '', input?.value ?? '');
  if (!res.ok) {
    return { is_error: true, content: res.error, audit: { tool: 'save_memory', error: res.error } };
  }
  return {
    is_error: false,
    content: JSON.stringify({ saved: true, id: res.id, scope, key: input.key }),
    audit: { tool: 'save_memory', scope, key: input.key },
  };
}

// ─── Action proposers ───────────────────────────────────────────────────────

function buildActionPreview(toolName: ActionToolName, p: Record<string, unknown>): string {
  switch (toolName) {
    case 'propose_log_utility_entry': {
      const qty = p.quantity;
      const unit = p.unit;
      const ut = p.utility_type;
      const start = p.reporting_period_start;
      const end = p.reporting_period_end;
      return `Log ${qty} ${unit} of ${ut} for the period ${start} to ${end}.`;
    }
    case 'propose_set_target': {
      return `Set target: ${p.metric_key} from ${p.baseline_value} (${p.baseline_date}) to ${p.target_value} by ${p.target_date}.`;
    }
    case 'propose_add_supplier': {
      return `Add supplier "${p.name}"${p.country ? ` (${p.country})` : ''}${p.contact_email ? `, contact ${p.contact_email}` : ''}.`;
    }
    default:
      return `Perform action: ${toolName}`;
  }
}

async function toolProposeAction(
  ctx: ToolContext,
  toolName: ActionToolName,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const missing = validateActionInput(toolName, input);
  if (missing.length > 0) {
    return {
      is_error: true,
      content: `Missing required fields for ${toolName}: ${missing.join(', ')}`,
      audit: { tool: toolName, error: 'missing_fields', missing },
    };
  }

  const preview = buildActionPreview(toolName, input);
  const res = await proposeAction(ctx.supabase, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    conversationId: ctx.conversationId ?? null,
    toolName,
    payload: input,
    preview,
  });
  if (!res.ok) {
    return {
      is_error: true,
      content: `Could not queue action: ${res.error}`,
      audit: { tool: toolName, error: res.error },
    };
  }
  return {
    is_error: false,
    content: JSON.stringify({
      proposed: true,
      pending_action_id: res.id,
      preview,
      note: 'Tell the user what you are about to do and wait for them to click Confirm. Do not claim the action is done.',
    }),
    audit: { tool: toolName, pending_action_id: res.id, preview },
  };
}

function validateActionInput(toolName: ActionToolName, input: Record<string, unknown>): string[] {
  const required: Record<ActionToolName, string[]> = {
    propose_log_utility_entry: ['facility_id', 'utility_type', 'quantity', 'unit', 'reporting_period_start', 'reporting_period_end'],
    propose_set_target: ['metric_key', 'baseline_value', 'baseline_date', 'target_value', 'target_date'],
    propose_add_supplier: ['name'],
  };
  const missing: string[] = [];
  for (const f of required[toolName]) {
    const v = input?.[f];
    if (v === undefined || v === null || v === '') missing.push(f);
  }
  return missing;
}
