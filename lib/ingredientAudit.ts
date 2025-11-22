import { supabase } from './supabaseClient';

export interface LogIngredientSelectionParams {
  organizationId: string;
  lcaId: string;
  ingredientName: string;
  dataSource: 'openlca' | 'supplier' | 'primary';
  sourceIdentifier?: string;
  sourceName?: string;
  alternativesShown?: Array<{
    type: 'supplier' | 'database' | 'primary';
    name: string;
    source?: string;
    id?: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  organization_id: string;
  product_lca_id: string;
  user_id: string;
  ingredient_name: string;
  data_source: 'openlca' | 'supplier' | 'primary';
  source_identifier: string | null;
  source_name: string | null;
  alternatives_shown: any[];
  confirmation_timestamp: string;
  session_metadata: Record<string, any>;
  created_at: string;
}

export interface AuditSummary {
  total_decisions: number;
  openlca_count: number;
  supplier_count: number;
  primary_count: number;
  unique_users: number;
  data_quality_score: number;
}

export async function logIngredientSelection(params: LogIngredientSelectionParams) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', params.organizationId)
      .maybeSingle();

    if (membershipError) {
      throw new Error(`Membership verification failed: ${membershipError.message}`);
    }

    if (!membership) {
      throw new Error("User not authorized for this organization");
    }

    const sessionMetadata = {
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const { data, error } = await supabase
      .from('ingredient_selection_audit')
      .insert({
        organization_id: params.organizationId,
        product_lca_id: params.lcaId,
        user_id: user.id,
        ingredient_name: params.ingredientName,
        data_source: params.dataSource,
        source_identifier: params.sourceIdentifier || null,
        source_name: params.sourceName || null,
        alternatives_shown: params.alternativesShown || [],
        confirmation_timestamp: new Date().toISOString(),
        session_metadata: sessionMetadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create audit log: ${error.message}`);
    }

    console.log('[ingredientAudit] Logged ingredient selection:', {
      auditId: data.id,
      ingredient: params.ingredientName,
      source: params.dataSource,
      alternativesCount: params.alternativesShown?.length || 0,
    });

    return { success: true, auditId: data.id };
  } catch (error) {
    console.error('[logIngredientSelection] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to log ingredient selection";
    return { success: false, error: message };
  }
}

export async function getIngredientAuditTrail(lcaId: string, organizationId: string) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!membership) {
      throw new Error("User not authorized for this organization");
    }

    const { data, error } = await supabase
      .from('ingredient_selection_audit')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('product_lca_id', lcaId)
      .eq('organization_id', organizationId)
      .order('confirmation_timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch audit trail: ${error.message}`);
    }

    return {
      success: true,
      auditTrail: data as unknown as AuditLogEntry[],
    };
  } catch (error) {
    console.error('[getIngredientAuditTrail] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to fetch audit trail";
    return {
      success: false,
      error: message,
      auditTrail: [],
    };
  }
}

export async function getAuditSummary(lcaId: string) {
  try {
    const { data, error } = await supabase
      .rpc('get_ingredient_audit_summary', { p_lca_id: lcaId });

    if (error) {
      throw new Error(`Failed to fetch audit summary: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        summary: {
          total_decisions: 0,
          openlca_count: 0,
          supplier_count: 0,
          primary_count: 0,
          unique_users: 0,
          data_quality_score: 0,
        } as AuditSummary,
      };
    }

    return {
      success: true,
      summary: data[0] as AuditSummary,
    };
  } catch (error) {
    console.error('[getAuditSummary] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to fetch audit summary";
    return {
      success: false,
      error: message,
      summary: null,
    };
  }
}

export function calculateDataQualityLabel(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 85) {
    return {
      label: 'Excellent',
      color: 'text-green-600',
      description: 'High proportion of primary and supplier data',
    };
  } else if (score >= 70) {
    return {
      label: 'Good',
      color: 'text-blue-600',
      description: 'Balanced mix of supplier and database data',
    };
  } else if (score >= 50) {
    return {
      label: 'Fair',
      color: 'text-amber-600',
      description: 'Consider adding more supplier-specific data',
    };
  } else {
    return {
      label: 'Needs Improvement',
      color: 'text-grey-600',
      description: 'Mostly generic database data - seek supplier inputs',
    };
  }
}
