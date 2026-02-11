// ============================================================================
// Platform Dashboard TypeScript Interfaces
// ============================================================================

export interface PlatformStats {
  users: {
    total: number;
    new_this_month: number;
    new_this_week: number;
  };
  organizations: {
    total: number;
    new_this_month: number;
    with_products: number;
    with_facilities: number;
  };
  content: {
    total_products: number;
    total_facilities: number;
    total_suppliers: number;
    total_lcas: number;
  };
  subscriptions: {
    by_tier: {
      seed: number;
      blossom: number;
      canopy: number;
      none: number;
    };
    by_status: {
      active: number;
      trial: number;
      pending: number;
      suspended: number;
      cancelled: number;
    };
    with_stripe: number;
    recent_signups_7d: number;
  };
  pending_approvals: {
    activity_data: number;
    facilities: number;
    products: number;
    suppliers: number;
  };
  verification: {
    unverified_supplier_products: number;
  };
  generated_at: string;
}

export interface FeatureAdoption {
  products_module: { organizations_using: number; adoption_rate: number };
  facilities_module: { organizations_using: number; adoption_rate: number };
  suppliers_module: { organizations_using: number; adoption_rate: number };
  lca_module: { organizations_using: number; adoption_rate: number };
  total_organizations: number;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  product_count: number;
  facility_count: number;
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  lca_count: number;
  supplier_count: number;
  onboarding_completed: boolean;
  onboarding_current_step: string | null;
  last_activity_at: string | null;
}

// Growth Trends (Improvement 1)
export interface GrowthTrendPoint {
  week: string;
  users: number;
  organizations: number;
  lcas: number;
  products: number;
}

export interface GrowthTrends {
  trends: GrowthTrendPoint[];
  period_days: number;
}

// Onboarding Analytics (Improvement 2)
export interface OnboardingAnalytics {
  total_orgs: number;
  with_onboarding: number;
  completed: number;
  dismissed: number;
  in_progress: number;
  completion_rate: number;
  phases: {
    welcome: number;
    quick_wins: number;
    core_setup: number;
    first_insights: number;
    power_features: number;
  };
  conversion: {
    trial_count: number;
    paid_count: number;
    conversion_rate: number;
  };
  avg_completion_days: number | null;
}

// Platform Insights (Improvement 4)
export interface PlatformInsights {
  ai_usage: {
    total_conversations: number;
    active_this_week: number;
    avg_messages_per_conversation: number;
    total_messages: number;
    organizations_using: number;
  };
  data_quality: {
    total_documents: number;
    verified: number;
    unverified: number;
    rejected: number;
    verification_rate: number;
  };
  supplier_engagement: {
    total_org_suppliers: number;
    organizations_with_suppliers: number;
    platform_suppliers_total: number;
    platform_suppliers_verified: number;
  };
}

// Platform Alerts (Improvement 5)
export interface ExpiringTrialAlert {
  org_id: string;
  org_name: string;
  expires_at: string;
  days_remaining: number;
}

export interface ApproachingLimitAlert {
  org_id: string;
  org_name: string;
  tier: string;
  current_products: number;
  max_products: number;
  usage_pct: number;
}

export interface InactiveOrgAlert {
  org_id: string;
  org_name: string;
  last_activity: string | null;
  days_inactive: number;
}

export interface PlatformAlerts {
  expiring_trials: ExpiringTrialAlert[];
  approaching_limits: ApproachingLimitAlert[];
  inactive_orgs: InactiveOrgAlert[];
  verification_backlog: number;
}
