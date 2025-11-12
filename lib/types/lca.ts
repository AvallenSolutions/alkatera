/**
 * Shared Type Definitions for LCA API Contracts
 *
 * This file provides compile-time safety for data contracts between
 * the frontend and Edge Functions, ensuring consistency and reducing
 * integration errors.
 */

// ============================================================================
// OpenLCA Types
// ============================================================================

/**
 * Represents a process from the OpenLCA database
 */
export interface OpenLcaProcess {
  /** Unique identifier for the OpenLCA process */
  id: string;
  /** Human-readable name of the process */
  name: string;
  /** Category/classification of the process (e.g., "Packaging/Containers") */
  category: string;
}

/**
 * Request payload for querying OpenLCA processes
 */
export interface QueryOpenLcaProcessesRequest {
  /** Search term to query (minimum 3 characters) */
  searchTerm: string;
}

/**
 * Response from the query-openlca-processes Edge Function
 */
export interface QueryOpenLcaProcessesResponse {
  /** Array of matching processes */
  results: OpenLcaProcess[];
  /** Whether results were served from cache */
  cached?: boolean;
  /** Whether mock data was returned (dev mode) */
  mock?: boolean;
  /** Optional message for mock data mode */
  message?: string;
}

// ============================================================================
// Activity Data Point Types
// ============================================================================

/**
 * Source type classification for activity data points
 * Determines data quality tier for compliance reporting
 */
export type SourceType =
  | 'user_provided'       // Tier 3: Manual entry
  | 'supplier_provided'   // Tier 2: Direct supplier data
  | 'platform_estimate'   // Tier 3: Generic estimate from OpenLCA
  | 'linked_lca_report';  // Tier 1: Verified LCA report

/**
 * Request payload for creating an activity data point
 */
export interface CreateActivityDataPointRequest {
  /** Optional: Associated LCA report ID */
  lcaReportId?: string;
  /** Optional: Associated facility ID */
  facilityId?: string;
  /** Source classification (determines DQI tier) */
  sourceType: SourceType;
  /** Flexible metadata payload */
  dataPayload: {
    /** OpenLCA process ID (for platform estimates) */
    openLcaProcessId?: string;
    /** OpenLCA process name (for platform estimates) */
    openLcaProcessName?: string;
    /** OpenLCA category (for platform estimates) */
    openLcaCategory?: string;
    /** Additional metadata as needed */
    [key: string]: any;
  };
  /** Descriptive name for the data point */
  name: string;
  /** Emissions category (e.g., "Scope 1", "Packaging") */
  category: string;
  /** Numeric quantity */
  quantity: number;
  /** Unit of measurement */
  unit: string;
  /** Activity date (ISO 8601 format) */
  activityDate: string;
}

/**
 * Response from the create-activity-data-point Edge Function
 */
export interface CreateActivityDataPointResponse {
  /** Success indicator */
  success: boolean;
  /** Created activity data point record */
  dataPoint: ActivityDataPoint;
}

/**
 * Activity data point record from the database
 */
export interface ActivityDataPoint {
  /** Unique identifier */
  id: string;
  /** Organization that owns this data */
  organization_id: string;
  /** User who created this data */
  user_id: string;
  /** Descriptive name */
  name: string;
  /** Emissions category */
  category: string;
  /** Numeric quantity */
  quantity: number;
  /** Unit of measurement */
  unit: string;
  /** Source classification */
  source_type: SourceType;
  /** Flexible metadata payload */
  data_payload: Record<string, any>;
  /** Optional: Linked LCA report */
  linked_lca_report_id: string | null;
  /** Activity date */
  activity_date: string;
  /** Creation timestamp */
  created_at: string;
}

// ============================================================================
// Data Quality Types
// ============================================================================

/**
 * Data Quality Indicator (DQI) tier levels
 * Lower number = higher quality
 */
export enum DQITier {
  TIER_1 = 1,  // Verified LCA reports
  TIER_2 = 2,  // Direct supplier data
  TIER_3 = 3,  // Estimates and manual entries
}

/**
 * Maps source types to their corresponding DQI tier
 */
export const SOURCE_TYPE_TO_DQI_TIER: Record<SourceType, DQITier> = {
  'linked_lca_report': DQITier.TIER_1,
  'supplier_provided': DQITier.TIER_2,
  'user_provided': DQITier.TIER_3,
  'platform_estimate': DQITier.TIER_3,
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Standard error response from Edge Functions
 */
export interface EdgeFunctionError {
  /** Error message */
  error: string;
  /** Optional additional details */
  details?: string;
}
