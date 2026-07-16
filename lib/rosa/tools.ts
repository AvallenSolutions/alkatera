/**
 * Rosa -- Tool library.
 *
 * Gemini function declarations Rosa can call during a conversation, plus a
 * dispatcher that executes each tool with an organisation-scoped service-role
 * client. Tool schemas are kept in JSON Schema form here and converted to
 * Gemini's FunctionDeclarationSchema in lib/ai/gemini.ts.
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
import { sanitizePostgrestSearch } from '@/lib/utils/sanitize-search';
import { runSafeSql, SAFE_SQL_ALLOWED_TABLES } from './safe-sql';
import { ALL_METRIC_KEYS, METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { listMemories, saveMemory, type MemoryScope } from './memory';
import { proposeAction } from './actions';
import { loadAttachment, extractStructured } from './document-extraction';
import { buildOrgSignalPack } from './priority-signals';
import { getBenchmarkForProductType } from '@/lib/industry-benchmarks';
import { gatherGrowthIngredients, scoreFromIngredients, computeGrowthSignals } from '@/lib/desk/growth-score';
import { logRosaTelemetry } from './budget';

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
  'propose_approve_exception',
  'propose_reject_exception',
  'propose_match_emission_factor',
  'propose_apply_proxy',
  'propose_create_lca_draft',
  'propose_dismiss_anomaly',
  'propose_set_progress_tracker',
  'propose_save_bcorp_answer',
  'propose_support_ticket',
  'propose_log_service_volume',
  'propose_log_hospitality_waste',
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
    name: 'get_data_readiness',
    description:
      "Returns the organisation's layered data readiness: foundation (facility utility data + agricultural farm linkage), recipes (ingredient and packaging matching), and LCAs. Also returns next_layer_to_address (foundation / recipes / lcas / targets) and a one-sentence why_this_layer reason. ALWAYS call this BEFORE recommending any next step. The platform's data waterfall is foundation → recipes → LCAs → targets / decarbonisation. Never recommend higher-layer work when a lower layer is incomplete. An LCA built on stale facility data is not trustworthy; say so plainly.",
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
  {
    name: 'get_setup_next_steps',
    description:
      "Returns the organisation's growth score (0-100) and, for each of the six bands (foundations, production, measurement, network, evidence, stewardship), the setup items still undone with a label and href. This is the SAME data the on-screen checklists and the forest read, so your answer to 'what should I do next?', 'what's left to set up?' or 'how do I get started here?' always matches what the user sees on the page. Prefer this for onboarding/setup questions; use get_data_readiness for questions about data quality once the basics exist.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_bcorp_readiness',
    description:
      "Returns the org's B Corp 2026 certification readiness: submit-readiness % (Year 0) and whole-programme %, whether they can submit, the blocking-requirement count, the prioritised next actions (each with what it needs and why), and — for recertifying orgs — the count of new / changed / carried-over requirements. Use for the OVERALL picture: 'are we ready to certify?', 'what's our biggest gap?', 'what's changed for recertification?'. For help ANSWERING ONE specific requirement, use get_bcorp_requirement instead.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_bcorp_requirement',
    description:
      "Deep-dives ONE B Corp requirement and drafts its answer from the org's own alkatera data. Returns the requirement code/name/section/status, plain-English guidance and pitfalls, the real data points already on the platform (emissions tonnes, wage figures, target dates, policies), the evidence on file, a confidence level, and the gap still to close. Use whenever the user wants to understand or ANSWER a specific requirement: 'help me answer IT5-Y0-001', 'draft my climate action answer', 'what do I write for Fair Work living wage?', 'how do I meet the mission requirement?'. Accepts a requirement code (e.g. 'IT5-Y0-001') or a topic/phrase (e.g. 'living wage', 'climate'). Ground your explanation and any draft in the returned data points; never invent figures.",
    input_schema: {
      type: 'object',
      properties: {
        requirement: {
          type: 'string',
          description:
            "A B Corp requirement code (e.g. 'IT5-Y0-001') or a topic/phrase to match (e.g. 'living wage', 'net zero', 'Fair Work').",
        },
      },
      required: ['requirement'],
    },
  },
  {
    name: 'propose_save_bcorp_answer',
    description:
      "Saves a drafted answer onto a B Corp requirement as evidence (a note), so it is captured against that requirement in alkatera. It is saved UNVERIFIED (pending human review) and never marks the requirement as met on its own. Use after you have drafted an answer with get_bcorp_requirement and the user asks to save/keep/record it. Pass the exact requirement code returned by get_bcorp_requirement. This is a change, so it is confirmation-gated: propose it, tell the user what you will save, and wait for them to click Confirm.",
    input_schema: {
      type: 'object',
      properties: {
        requirement_code: {
          type: 'string',
          description: "The exact B Corp requirement code, e.g. 'CA1.1' or 'PSG1.1'.",
        },
        answer: {
          type: 'string',
          description: 'The drafted answer text to save against the requirement.',
        },
      },
      required: ['requirement_code', 'answer'],
    },
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
    name: 'propose_set_progress_tracker',
    description:
      "Propose changing the single number the user watches over time on their /rosa/ hub. Use when the user asks 'what should I track?' or 'change my progress chart'. Stages a pending action; the user clicks Confirm to actually save it. Pick the tracker_id that matches what they care about most given their persona, focus areas, and the org's data foundation.",
    input_schema: {
      type: 'object',
      properties: {
        tracker_id: {
          type: 'string',
          enum: [
            'total_emissions',
            'water_use',
            'lca_coverage',
            'supplier_esg_signal',
            'target_progress',
            'custom_rosa',
          ],
          description:
            "The tracker to set. total_emissions = absolute scope 1+2 trend. water_use = water intake trend. lca_coverage = % of products with completed LCAs. supplier_esg_signal = % of suppliers with submitted ESG. target_progress = actual vs linear path against a chosen target. custom_rosa = let Rosa pick the most-feasible tracker each refresh.",
        },
        target_id: {
          type: 'string',
          description:
            "Optional. Required only when tracker_id='target_progress'. The sustainability_targets.id to track against. If omitted, the route picks the earliest-due target.",
        },
        reason: {
          type: 'string',
          description:
            'Short Rosa-voiced explanation of why this tracker fits the user, shown on the confirm card. Plain English.',
        },
      },
      required: ['tracker_id'],
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
    name: 'extract_from_document',
    description:
      "Extract structured fields from a document the user has attached (utility bill, supplier spec sheet, LCA report, invoice, meter reading photo). Pass the file_id the user uploaded and the list of field names you want. Returns a flat JSON object. Use this when the user says 'read this bill' or 'pull the numbers out of this PDF', then pair with a propose_* action to actually log what you extracted.",
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'The file_id returned from the upload (e.g. "org/user/uuid-bill.pdf").' },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: "Field names to extract. For a utility bill: ['supplier_name','account_number','period_start','period_end','quantity_value','quantity_unit','utility_type','total_cost']. Empty array = let Rosa pick.",
        },
        document_kind: {
          type: 'string',
          description: "Human-readable hint for the extractor, e.g. 'utility bill', 'supplier spec sheet', 'LCA report'.",
        },
      },
      required: ['file_id'],
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
  {
    name: 'propose_approve_exception',
    description:
      "Propose approving an item from the agent queue (a parsed bill, supplier impact, etc. waiting the user's sign-off). Stages a pending action; the user clicks Confirm to actually write the underlying entries. Use after `list_recent_anomalies` or when the user says things like 'approve those bills' or 'sign off on the queue'.",
    input_schema: {
      type: 'object',
      properties: {
        exception_id: {
          type: 'string',
          description: 'The agent_exceptions.id to approve.',
        },
        facility_id: {
          type: 'string',
          description: 'For utility/water/waste bills: the facility the entries belong to. Use the suggested_facility_id from the exception if there is one.',
        },
      },
      required: ['exception_id'],
    },
  },
  {
    name: 'propose_reject_exception',
    description:
      'Propose rejecting an item from the agent queue. Stages a pending action; the user must click Confirm to actually mark it rejected. Use when the user says "reject", "not relevant", "wrong facility", etc.',
    input_schema: {
      type: 'object',
      properties: {
        exception_id: { type: 'string', description: 'The agent_exceptions.id to reject.' },
        reason: { type: 'string', description: 'Optional one-line reason recorded on the row.' },
      },
      required: ['exception_id'],
    },
  },
  {
    name: 'propose_match_emission_factor',
    description:
      "Propose applying a confirmed emission factor to a recipe ingredient. Use after the user picks (or you've recommended) a specific factor by name and source for a single ingredient. Stages a pending action; the user clicks Confirm to write it.",
    input_schema: {
      type: 'object',
      properties: {
        ingredient_id: { type: 'string', description: 'The recipe_ingredients.id to update.' },
        factor_name: {
          type: 'string',
          description: "The matched factor's name as recorded by the source (e.g. 'sugar, refined' from Agribalyse).",
        },
        factor_source: {
          type: 'string',
          enum: ['ecoinvent', 'agribalyse', 'defra', 'platform'],
          description: 'Which library the factor comes from.',
        },
        justification: {
          type: 'string',
          description: 'One short sentence the user will see, explaining why this factor.',
        },
      },
      required: ['ingredient_id', 'factor_name', 'factor_source', 'justification'],
    },
  },
  {
    name: 'propose_apply_proxy',
    description:
      "Propose applying a proxy emission factor (closest reasonable match) to an ingredient that has no direct factor. Stages a pending action; the user clicks Confirm. Use when there is no exact match and you've identified a reasonable proxy with a confidence level.",
    input_schema: {
      type: 'object',
      properties: {
        ingredient_id: { type: 'string', description: 'The recipe_ingredients.id to update.' },
        proxy_factor_name: {
          type: 'string',
          description: "Name of the proxy factor (e.g. 'sugar, refined' as a proxy for maple syrup).",
        },
        proxy_factor_source: {
          type: 'string',
          enum: ['ecoinvent', 'agribalyse', 'defra', 'platform'],
          description: 'Which library the proxy factor comes from.',
        },
        confidence_pct: {
          type: 'number',
          description: 'Estimated confidence (0-100) that this proxy is reasonable for this ingredient.',
        },
        justification: {
          type: 'string',
          description: 'One short sentence explaining why this proxy is appropriate.',
        },
      },
      required: ['ingredient_id', 'proxy_factor_name', 'proxy_factor_source', 'confidence_pct', 'justification'],
    },
  },
  {
    name: 'propose_create_lca_draft',
    description:
      "Propose creating a draft LCA for a product so the user has somewhere to start the wizard. Stages a pending action; the user clicks Confirm to actually create the draft.",
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'The products.id to create an LCA for.' },
        system_boundary: {
          type: 'string',
          enum: ['cradle-to-gate', 'cradle-to-grave', 'gate-to-gate'],
          description: 'Default system boundary; the user can change it in the wizard.',
        },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'propose_dismiss_anomaly',
    description:
      "Propose dismissing a flagged anomaly when it's an explainable one-off rather than a real problem. Stages a pending action; the user clicks Confirm to mark it dismissed.",
    input_schema: {
      type: 'object',
      properties: {
        anomaly_id: { type: 'string', description: 'The dashboard_anomalies.id to dismiss.' },
        reason: { type: 'string', description: 'One short sentence recorded on the row.' },
      },
      required: ['anomaly_id', 'reason'],
    },
  },
  {
    name: 'propose_support_ticket',
    description:
      "Propose filing a support ticket for a human to pick up, landing in the user's support desk (Settings > Feedback). Only use this AFTER trying to resolve the question yourself with search_knowledge_bank, explain_methodology, or the page context, and the user is still stuck, or they explicitly ask for a human / to raise a ticket. This conversation is attached automatically so support starts with full context. Stages a pending action; the user clicks Confirm to actually file it.",
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'A short one-line subject for the ticket.' },
        summary_of_issue: {
          type: 'string',
          description: 'Plain-English summary of what the user is stuck on or asking for.',
        },
        what_was_tried: {
          type: 'string',
          description: 'What you already looked up or explained before escalating. Optional but preferred.',
        },
      },
      required: ['subject', 'summary_of_issue'],
    },
  },
  {
    name: 'get_hospitality_summary',
    description:
      "Returns a compact snapshot of the organisation's hospitality operations: venue count, how many meals/drinks/rooms exist, how many have a calculated footprint, the latest service-volume period, and whether hospitality counts toward the company total. Call this for questions about the restaurant/bar/rooms side of the business before proposing hospitality actions.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_hospitality_products',
    description:
      "Lists the organisation's hospitality recipes (meals, made-drinks and room-nights) with id, name and kind. Use to resolve a recipe name the user mentions to its product id before proposing a service-volume entry.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'propose_log_service_volume',
    description:
      "Propose recording how many of a hospitality meal/drink/room were sold in a period — the throughput that scales its per-serving footprint into the company total. Use when the user says e.g. 'we sold 320 beef ragùs in October'. Resolve the recipe to a product_id via list_hospitality_products first. The user MUST confirm before the row is written.",
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', description: 'Hospitality product id (from list_hospitality_products).' },
        units_sold: { type: 'number', description: 'Number of individual servings/covers/room-nights sold in the period.' },
        period_start: { type: 'string', description: 'ISO date (YYYY-MM-DD) start of the period.' },
        period_end: { type: 'string', description: 'ISO date (YYYY-MM-DD) end of the period.' },
        note: { type: 'string', description: 'Optional free-text note.' },
      },
      required: ['product_id', 'units_sold', 'period_start', 'period_end'],
    },
  },
  {
    name: 'propose_log_hospitality_waste',
    description:
      "Propose logging a hospitality food/dry waste entry (mass + treatment route) for a period. Feeds Scope 3 Category 5. Use when the user reports kitchen or bar waste. The user MUST confirm before the row is written.",
    input_schema: {
      type: 'object',
      properties: {
        waste_stream: { type: 'string', enum: ['food', 'dry'], description: 'food or dry.' },
        treatment_method: {
          type: 'string',
          enum: ['composting', 'anaerobic_digestion', 'recycling', 'reuse', 'incineration_with_recovery', 'incineration_without_recovery', 'landfill'],
          description: 'How the waste was treated.',
        },
        mass_kg: { type: 'number', description: 'Mass in kilograms.' },
        period_start: { type: 'string', description: 'ISO date (YYYY-MM-DD) start of the period.' },
        period_end: { type: 'string', description: 'ISO date (YYYY-MM-DD) end of the period.' },
        venue_id: { type: 'string', description: 'Optional venue UUID.' },
        note: { type: 'string', description: 'Optional free-text note.' },
      },
      required: ['waste_stream', 'treatment_method', 'mass_kg', 'period_start', 'period_end'],
    },
  },
  {
    name: 'generate_export',
    description:
      "Generates a CSV the user can download from inside the chat. Use when they ask for a list, a CSV, a download, or to send something to a colleague. Read-only, no side effects: returns a download URL the chat renders as a clickable chip. Pick the kind that fits the user's question.",
    input_schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['products_without_lca', 'unmatched_ingredients', 'recent_approvals'],
          description:
            "What to export. 'products_without_lca' = list of products lacking a completed LCA. 'unmatched_ingredients' = recipe ingredients without an emission factor matched. 'recent_approvals' = items approved in the agent queue in the last 30 days.",
        },
      },
      required: ['kind'],
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
      case 'get_data_readiness':
        return await toolGetDataReadiness(ctx);
      case 'list_facilities':
        return await toolListFacilities(ctx);
      case 'list_products':
        return await toolListProducts(ctx, input as { only_with_lca?: boolean; limit?: number });
      case 'get_hospitality_summary':
        return await toolGetHospitalitySummary(ctx);
      case 'list_hospitality_products':
        return await toolListHospitalityProducts(ctx);
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
      case 'get_setup_next_steps':
        return await toolGetSetupNextSteps(ctx);
      case 'get_bcorp_readiness':
        return await toolGetBcorpReadiness(ctx);
      case 'get_bcorp_requirement':
        return await toolGetBcorpRequirement(ctx, input as { requirement?: string });
      case 'list_memories':
        return await toolListMemories(ctx);
      case 'save_memory':
        return await toolSaveMemory(ctx, input as { scope: MemoryScope; key: string; value: string });
      case 'propose_log_utility_entry':
      case 'propose_set_target':
      case 'propose_add_supplier':
      case 'propose_approve_exception':
      case 'propose_reject_exception':
      case 'propose_match_emission_factor':
      case 'propose_apply_proxy':
      case 'propose_create_lca_draft':
      case 'propose_dismiss_anomaly':
      case 'propose_set_progress_tracker':
      case 'propose_save_bcorp_answer':
      case 'propose_support_ticket':
      case 'propose_log_service_volume':
      case 'propose_log_hospitality_waste':
        return await toolProposeAction(ctx, name as ActionToolName, input as Record<string, unknown>);
      case 'extract_from_document':
        return await toolExtractFromDocument(ctx, input as { file_id: string; fields?: string[]; document_kind?: string });
      case 'generate_export':
        return await toolGenerateExport(ctx, input as { kind: 'products_without_lca' | 'unmatched_ingredients' | 'recent_approvals' });
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

async function toolGetDataReadiness(ctx: ToolContext): Promise<ToolResult> {
  try {
    const pack = await buildOrgSignalPack(ctx.supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      snoozedKinds: [],
    });
    const payload = {
      readiness: pack.readiness,
      // Useful raw numbers Rosa often wants alongside the structured view.
      raw: {
        facility_count: pack.org.facility_count,
        product_count: pack.org.product_count,
        completed_lcas: pack.lcas.completed_count,
        unmatched_materials: pack.unmatched.product_materials_count,
        stale_facilities: pack.facilities.stale_count,
      },
    };
    return {
      is_error: false,
      content: JSON.stringify(payload),
      audit: {
        tool: 'get_data_readiness',
        next_layer: pack.readiness.next_layer_to_address,
        facility_status: pack.readiness.foundation.facility_data,
        recipes_status: pack.readiness.recipes.status,
        lcas_status: pack.readiness.lcas.status,
      },
    };
  } catch (err: any) {
    const message = err?.message ?? 'Failed to build readiness pack';
    return {
      is_error: true,
      content: message,
      audit: { tool: 'get_data_readiness', error: message },
    };
  }
}

async function toolGetBcorpReadiness(ctx: ToolContext): Promise<ToolResult> {
  // Dynamic imports keep the server-only readiness module out of any client bundle.
  const { calculateCertificationReadiness } = await import('@/lib/certifications/readiness');
  const { topActions } = await import('@/lib/certifications/roadmap');
  const { getRequirementGuidance } = await import('@/lib/certifications/requirement-guidance');
  const { getRecertDelta } = await import('@/lib/certifications/recert-deltas');

  const r = await calculateCertificationReadiness(ctx.supabase, ctx.organizationId);
  if (!r.hasCertification) {
    return {
      is_error: false,
      content: JSON.stringify({
        hasCertification: false,
        note: 'No B Corp certification has been started for this organisation yet. They can begin from the Certifications page.',
      }),
      audit: { tool: 'get_bcorp_readiness', hasCertification: false },
    };
  }

  const nextActions = topActions(r, 5).map((a) => ({
    code: a.code,
    name: a.name,
    bucket: a.bucket,
    mandatory: a.mandatory,
    reason: a.reason,
    whatYouNeed: getRequirementGuidance(a.code, a.topicArea).summary,
  }));

  const summary: Record<string, unknown> = {
    hasCertification: true,
    certificationType: r.certificationType,
    currentYearBand: r.currentYearBand,
    readyToSubmit: r.isReadyToSubmit,
    year0ReadinessPct: r.year0ReadinessPct,
    programmeReadinessPct: r.programmeReadinessPct,
    blockingCount: r.blockingRequirements.length,
    nextActions,
  };

  if (r.certificationType === 'recertification') {
    const counts: Record<string, number> = { new: 0, changed: 0, carried_over: 0 };
    for (const rs of r.requirementStatuses.filter((x) => x.applicable !== false)) {
      counts[getRecertDelta(rs.code, rs.topicArea, rs.applicableFromYear).kind] += 1;
    }
    summary.recertDeltas = counts;
  }

  return {
    is_error: false,
    content: JSON.stringify(summary),
    audit: { tool: 'get_bcorp_readiness', year0ReadinessPct: r.year0ReadinessPct, readyToSubmit: r.isReadyToSubmit },
  };
}

async function toolGetBcorpRequirement(
  ctx: ToolContext,
  input: { requirement?: string },
): Promise<ToolResult> {
  const query = (input?.requirement ?? '').toString().trim();
  if (!query) {
    return {
      is_error: true,
      content:
        'Tell me which requirement — a code like IT5-Y0-001, or a topic like "living wage" or "climate".',
      audit: { tool: 'get_bcorp_requirement', error: 'no_query' },
    };
  }

  const { buildRequirementAnswerForCode } = await import(
    '@/lib/certifications/answer-key'
  );
  const detail = await buildRequirementAnswerForCode(
    ctx.supabase,
    ctx.organizationId,
    query,
  );

  if (!detail) {
    return {
      is_error: false,
      content: JSON.stringify({
        found: false,
        note: `No B Corp requirement matched "${query}". Either no certification has been started, or try a requirement code (e.g. IT5-Y0-001) or a broader topic. Call get_bcorp_readiness for the list of next actions with their codes.`,
      }),
      audit: { tool: 'get_bcorp_requirement', found: false, query },
    };
  }

  const payload = {
    found: true,
    code: detail.code,
    name: detail.name,
    section: detail.section,
    applicableFromYear: detail.applicableFromYear,
    status: detail.status,
    whatItNeeds: detail.guidance.summary,
    evidenceThatWorks: detail.guidance.evidence,
    pitfalls: detail.guidance.pitfalls ?? [],
    starterTemplate: detail.guidance.template ?? null,
    // The org's real data behind an answer — ground the draft in these.
    yourDataPoints: detail.synthesis.dataPoints,
    dataSource: detail.synthesis.dataSource,
    confidence: detail.synthesis.confidence,
    gapToClose: detail.synthesis.gap,
    evidenceOnFile: detail.evidenceOnFile,
    otherMatches: detail.otherMatches,
  };

  return {
    is_error: false,
    content: JSON.stringify(payload),
    audit: {
      tool: 'get_bcorp_requirement',
      code: detail.code,
      confidence: detail.synthesis.confidence,
    },
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

const HOSPITALITY_PRODUCT_KINDS = ['hospitality_meal', 'hospitality_drink', 'hospitality_room_night'];
const HOSPITALITY_KIND_LABEL: Record<string, string> = {
  hospitality_meal: 'meal',
  hospitality_drink: 'drink',
  hospitality_room_night: 'room',
};

async function toolListHospitalityProducts(ctx: ToolContext): Promise<ToolResult> {
  const { data, error } = await ctx.supabase
    .from('products')
    .select('id, name, product_kind')
    .eq('organization_id', ctx.organizationId)
    .in('product_kind', HOSPITALITY_PRODUCT_KINDS)
    .order('name', { ascending: true });
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'list_hospitality_products', error: error.message } };
  }
  const rows = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    kind: HOSPITALITY_KIND_LABEL[p.product_kind] ?? p.product_kind,
  }));
  return {
    is_error: false,
    content: JSON.stringify(rows),
    audit: { tool: 'list_hospitality_products', row_count: rows.length },
  };
}

async function toolGetHospitalitySummary(ctx: ToolContext): Promise<ToolResult> {
  const { count: venueCount } = await ctx.supabase
    .from('hospitality_venues')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'active');

  const { data: products } = await ctx.supabase
    .from('products')
    .select('id, product_kind')
    .eq('organization_id', ctx.organizationId)
    .in('product_kind', HOSPITALITY_PRODUCT_KINDS);
  const productList = products ?? [];
  const byKind: Record<string, number> = { meal: 0, drink: 0, room: 0 };
  for (const p of productList) {
    const label = HOSPITALITY_KIND_LABEL[(p as any).product_kind];
    if (label) byKind[label] = (byKind[label] ?? 0) + 1;
  }
  const productIds = productList.map((p: any) => p.id);

  let recipesWithImpact = 0;
  if (productIds.length > 0) {
    const { data: pcfs } = await ctx.supabase
      .from('product_carbon_footprints')
      .select('product_id')
      .in('product_id', productIds)
      .eq('status', 'completed');
    recipesWithImpact = new Set((pcfs ?? []).map((r: any) => r.product_id)).size;
  }

  const { data: latestVol } = await ctx.supabase
    .from('hospitality_service_volumes')
    .select('period_start, period_end')
    .eq('organization_id', ctx.organizationId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('report_defaults')
    .eq('id', ctx.organizationId)
    .maybeSingle();
  const includedInTotal = (org?.report_defaults as any)?.include_hospitality !== false;

  const summary = {
    venues: venueCount ?? 0,
    recipes: { total: productList.length, ...byKind },
    recipes_with_impact: recipesWithImpact,
    latest_volume_period: latestVol ? { start: latestVol.period_start, end: latestVol.period_end } : null,
    counts_toward_company_total: includedInTotal,
  };
  return {
    is_error: false,
    content: JSON.stringify(summary),
    audit: { tool: 'get_hospitality_summary', venues: summary.venues, recipes: productList.length },
  };
}

async function toolQueryPulseMetrics(
  ctx: ToolContext,
  input: { metric_key: MetricKey; start_date?: string; end_date?: string },
): Promise<ToolResult> {
  if (!(await hasPulseBeta(ctx))) {
    return {
      is_error: false,
      content: JSON.stringify({ points: [], note: 'Pulse is not enabled for this organisation yet.' }),
      audit: { tool: 'query_pulse_metrics', pulse_disabled: true },
    };
  }
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
  if (!(await hasPulseBeta(ctx))) {
    return {
      is_error: false,
      content: JSON.stringify({ anomalies: [], note: 'Pulse is not enabled for this organisation yet.' }),
      audit: { tool: 'list_recent_anomalies', pulse_disabled: true },
    };
  }
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
  if (!(await hasPulseBeta(ctx))) {
    return {
      is_error: false,
      content: JSON.stringify({ entries: [], note: 'Pulse is not enabled for this organisation yet.' }),
      audit: { tool: 'list_insights', pulse_disabled: true },
    };
  }
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

// Pulse is GA for every tier — these tools are available to all orgs. Kept as a
// helper (rather than deleting the three call-site guards) so the Pulse Rosa
// tools keep an obvious, single on/off point if access ever needs narrowing.
async function hasPulseBeta(_ctx: ToolContext): Promise<boolean> {
  return true;
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
  const safeQuery = sanitizePostgrestSearch(query);
  let q = ctx.supabase
    .from('gaia_knowledge_base')
    .select('id, entry_type, title, content, category, tags, source_url, priority')
    .eq('is_active', true)
    .or(`title.ilike.%${safeQuery}%,content.ilike.%${safeQuery}%`)
    .order('priority', { ascending: false })
    .limit(limit);
  if (input?.category) q = q.eq('category', input.category);
  const { data, error } = await q;
  if (error) {
    return { is_error: true, content: error.message, audit: { tool: 'search_knowledge_bank', error: error.message } };
  }
  // Support-deflection measurement (Phase 4): a knowledge-bank search is a
  // question Rosa is trying to answer in place, before it ever becomes a
  // ticket. Best-effort, never blocks the tool result.
  await logRosaTelemetry(ctx.supabase, ctx.organizationId, ctx.userId, 'support.knowledge_search', {
    query,
    row_count: data?.length ?? 0,
  });
  // Learning capture (Pillar 4 step 1): zero results is a wiki/knowledge
  // gap the weekly curation sweep should look at. Best-effort.
  if ((data?.length ?? 0) === 0) {
    await logRosaTelemetry(ctx.supabase, ctx.organizationId, ctx.userId, 'learning.knowledge_miss', {
      query,
      tool: 'search_knowledge_bank',
    });
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
  const safeTerm = sanitizePostgrestSearch(term);
  const { data } = await ctx.supabase
    .from('gaia_knowledge_base')
    .select('id, title, content, category, source_url, priority')
    .eq('is_active', true)
    .or(`title.ilike.%${safeTerm}%,content.ilike.%${safeTerm}%`)
    .order('priority', { ascending: false })
    .limit(3);
  if (!data || data.length === 0) {
    // Learning capture (Pillar 4 step 1): same knowledge-gap signal as
    // search_knowledge_bank's zero-result case. Best-effort.
    await logRosaTelemetry(ctx.supabase, ctx.organizationId, ctx.userId, 'learning.knowledge_miss', {
      query: term,
      tool: 'explain_methodology',
    });
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

/**
 * Reads the same growth-score ingredients as GET /api/growth, so Rosa's
 * "what should I do next" answer always matches the room checklists and the
 * forest on screen (see lib/desk/growth-score.ts and lib/onboarding/room-guides.ts).
 */
async function toolGetSetupNextSteps(ctx: ToolContext): Promise<ToolResult> {
  const ingredients = await gatherGrowthIngredients(ctx.supabase, ctx.organizationId);
  const { score, bands } = scoreFromIngredients(ingredients);
  const signals = computeGrowthSignals(ingredients);

  const undoneByBand: Record<string, Array<{ label: string; href: string }>> = {};
  for (const band of Object.keys(signals) as Array<keyof typeof signals>) {
    const undone = signals[band].filter((s) => !s.done).map((s) => ({ label: s.label, href: s.href }));
    if (undone.length > 0) undoneByBand[band] = undone;
  }

  // Support-deflection measurement (Phase 4): Rosa answering "what's next"
  // is a support interaction resolved in place. Best-effort, non-blocking.
  await logRosaTelemetry(ctx.supabase, ctx.organizationId, ctx.userId, 'support.next_steps', { score });

  return {
    is_error: false,
    content: JSON.stringify({ score, bands, undone_by_band: undoneByBand }),
    audit: { tool: 'get_setup_next_steps', score },
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
    case 'propose_approve_exception': {
      return `Approve queue item ${String(p.exception_id).slice(0, 8)} and write the underlying entries${p.facility_id ? ` to facility ${String(p.facility_id).slice(0, 8)}` : ''}.`;
    }
    case 'propose_reject_exception': {
      return `Reject queue item ${String(p.exception_id).slice(0, 8)}${p.reason ? ` (reason: ${String(p.reason)})` : ''}.`;
    }
    case 'propose_match_emission_factor': {
      return `Apply factor "${p.factor_name}" (${p.factor_source}) to this ingredient. ${p.justification}`;
    }
    case 'propose_apply_proxy': {
      return `Use "${p.proxy_factor_name}" (${p.proxy_factor_source}) as a proxy for this ingredient at ${p.confidence_pct}% confidence. ${p.justification}`;
    }
    case 'propose_create_lca_draft': {
      return `Start a draft LCA for this product${p.system_boundary ? ` with boundary ${p.system_boundary}` : ''}.`;
    }
    case 'propose_dismiss_anomaly': {
      return `Dismiss anomaly ${String(p.anomaly_id).slice(0, 8)} (reason: ${p.reason}).`;
    }
    case 'propose_set_progress_tracker': {
      const id = String(p.tracker_id);
      const reason = p.reason ? ` Reason: ${p.reason}` : '';
      return `Set the user's hub progress tracker to "${id}".${reason}`;
    }
    case 'propose_save_bcorp_answer': {
      const code = String(p.requirement_code);
      const ans = String(p.answer ?? '');
      const snippet = ans.length > 140 ? `${ans.slice(0, 140)}…` : ans;
      return `Save this answer to B Corp requirement ${code} as a note (pending verification): "${snippet}"`;
    }
    case 'propose_support_ticket': {
      return `File a support ticket: "${p.subject}". ${p.summary_of_issue}`;
    }
    case 'propose_log_service_volume': {
      return `Record ${p.units_sold} servings sold for the period ${p.period_start} to ${p.period_end}.`;
    }
    case 'propose_log_hospitality_waste': {
      return `Log ${p.mass_kg} kg of ${p.waste_stream} waste (${p.treatment_method}) for ${p.period_start} to ${p.period_end}.`;
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

// ─── Document intelligence ──────────────────────────────────────────────────

async function toolExtractFromDocument(
  ctx: ToolContext,
  input: { file_id: string; fields?: string[]; document_kind?: string },
): Promise<ToolResult> {
  if (!input?.file_id) {
    return { is_error: true, content: 'file_id is required', audit: { tool: 'extract_from_document', error: 'missing_file_id' } };
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { is_error: true, content: 'Gemini API key not configured', audit: { tool: 'extract_from_document', error: 'no_api_key' } };
  }
  const attachment = await loadAttachment(ctx.supabase, input.file_id, ctx.organizationId, ctx.userId);
  if (!attachment) {
    return { is_error: true, content: 'File not found or not accessible', audit: { tool: 'extract_from_document', error: 'not_found', file_id: input.file_id } };
  }
  const res = await extractStructured(apiKey, attachment, input.fields ?? [], input.document_kind);
  if (!res.ok) {
    return { is_error: true, content: res.error, audit: { tool: 'extract_from_document', error: res.error, file_id: input.file_id } };
  }
  return {
    is_error: false,
    content: JSON.stringify({
      file_id: input.file_id,
      filename: attachment.filename,
      media_type: attachment.media_type,
      extracted: res.data,
    }),
    audit: {
      tool: 'extract_from_document',
      file_id: input.file_id,
      field_count: Object.keys(res.data).length,
    },
  };
}

// ─── Exports (read-only deliverables) ────────────────────────────────────────

const EXPORT_KIND_LABELS: Record<string, string> = {
  products_without_lca: 'Products without a completed LCA',
  unmatched_ingredients: 'Recipe ingredients without an emission factor',
  recent_approvals: 'Items I approved in the last 30 days',
};

/**
 * Wraps the `/api/rosa/exports` endpoint and returns a tool_preview the
 * client renders as an inline download chip. No side effects: the actual
 * data is fetched lazily by the user's browser when they click the chip,
 * scoped to the same auth + org as the rest of their session.
 */
async function toolGenerateExport(
  ctx: ToolContext,
  input: { kind: 'products_without_lca' | 'unmatched_ingredients' | 'recent_approvals' },
): Promise<ToolResult> {
  const kind = input?.kind;
  if (!kind || !(kind in EXPORT_KIND_LABELS)) {
    return {
      is_error: true,
      content: `Unknown export kind. Valid: ${Object.keys(EXPORT_KIND_LABELS).join(', ')}`,
      audit: { tool: 'generate_export', error: 'unknown_kind' },
    };
  }
  const url = `/api/rosa/exports?kind=${encodeURIComponent(kind)}&format=csv`;
  const filename = `${kind.replace(/_/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  // The SSE pipeline emits tool_preview on tool_result events; the
  // useRosaConversation hook picks up download_url and renders an
  // attachment chip under the assistant turn.
  const preview = {
    download_url: url,
    filename,
    expires_at: null,
    label: EXPORT_KIND_LABELS[kind],
  };
  return {
    is_error: false,
    content: JSON.stringify({
      preview,
      message: `Prepared a CSV: ${EXPORT_KIND_LABELS[kind]}.`,
    }),
    audit: { tool: 'generate_export', kind, url },
  };
}

function validateActionInput(toolName: ActionToolName, input: Record<string, unknown>): string[] {
  const required: Record<ActionToolName, string[]> = {
    propose_log_utility_entry: ['facility_id', 'utility_type', 'quantity', 'unit', 'reporting_period_start', 'reporting_period_end'],
    propose_set_target: ['metric_key', 'baseline_value', 'baseline_date', 'target_value', 'target_date'],
    propose_add_supplier: ['name'],
    propose_approve_exception: ['exception_id'],
    propose_reject_exception: ['exception_id'],
    propose_match_emission_factor: ['ingredient_id', 'factor_name', 'factor_source', 'justification'],
    propose_apply_proxy: ['ingredient_id', 'proxy_factor_name', 'proxy_factor_source', 'confidence_pct', 'justification'],
    propose_create_lca_draft: ['product_id'],
    propose_dismiss_anomaly: ['anomaly_id', 'reason'],
    propose_set_progress_tracker: ['tracker_id'],
    propose_save_bcorp_answer: ['requirement_code', 'answer'],
    propose_support_ticket: ['subject', 'summary_of_issue'],
    propose_log_service_volume: ['product_id', 'units_sold', 'period_start', 'period_end'],
    propose_log_hospitality_waste: ['waste_stream', 'treatment_method', 'mass_kg', 'period_start', 'period_end'],
  };
  const missing: string[] = [];
  for (const f of required[toolName]) {
    const v = input?.[f];
    if (v === undefined || v === null || v === '') missing.push(f);
  }
  return missing;
}
