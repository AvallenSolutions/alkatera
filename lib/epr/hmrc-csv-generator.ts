/**
 * EPR Compliance Tool — HMRC Registration CSV Generators
 *
 * Generates the three HMRC registration template CSVs:
 *   1. Organisation Details (78 columns)
 *   2. Brand Details (4 columns)
 *   3. Partner Details (6 columns)
 */

import type {
  HMRCOrgDetails,
  HMRCAddress,
  HMRCContact,
  HMRCBrand,
  HMRCPartner,
  EPROrganizationSettings,
} from './types';
import {
  HMRC_ORG_DETAILS_CSV_HEADERS,
  HMRC_BRAND_DETAILS_CSV_HEADERS,
  HMRC_PARTNER_DETAILS_CSV_HEADERS,
} from './constants';

// =============================================================================
// Types
// =============================================================================

export interface OrganisationCSVInput {
  orgDetails: HMRCOrgDetails;
  addresses: HMRCAddress[];
  contacts: HMRCContact[];
  eprSettings: EPROrganizationSettings;
  orgName: string;
  tradingName?: string;
}

// =============================================================================
// Template 1: Organisation Details CSV (78 columns)
// =============================================================================

export function generateOrganisationCSV(input: OrganisationCSVInput): string {
  const { orgDetails, addresses, contacts, eprSettings, orgName, tradingName } = input;

  const addr = (type: string) =>
    addresses.find(a => a.address_type === type);
  const contact = (type: string) =>
    contacts.find(c => c.contact_type === type);

  const registered = addr('registered');
  const audit = addr('audit');
  const serviceOfNotice = addr('service_of_notice');
  const principal = addr('principal');

  const approved = contact('approved_person');
  const delegated = contact('delegated_person');
  const primary = contact('primary_contact');
  const secondary = contact('secondary_contact');

  // Derive organisation size from obligation size
  const orgSize = eprSettings.obligation_size === 'large' ? 'L'
    : eprSettings.obligation_size === 'small' ? 'S'
    : '';

  // Turnover in millions with 2dp
  const turnover = eprSettings.annual_turnover_gbp != null
    ? (eprSettings.annual_turnover_gbp / 1_000_000).toFixed(2)
    : '';

  // Total tonnage as whole number
  const tonnage = eprSettings.estimated_annual_packaging_tonnage != null
    ? Math.round(eprSettings.estimated_annual_packaging_tonnage).toString()
    : '';

  const row = [
    escapeCSV(eprSettings.rpd_organization_id ?? ''),
    escapeCSV(eprSettings.rpd_subsidiary_id ?? ''),
    escapeCSV(orgName),
    escapeCSV(tradingName ?? ''),
    escapeCSV(orgDetails.companies_house_number ?? ''),
    escapeCSV(orgDetails.home_nation_code ?? ''),
    escapeCSV(orgDetails.main_activity_sic ?? ''),
    escapeCSV(orgDetails.organisation_type_code ?? ''),
    escapeCSV(orgDetails.organisation_sub_type_code ?? ''),
    // Packaging activity flags
    escapeCSV(orgDetails.activity_so ?? 'No'),
    escapeCSV(orgDetails.activity_pf ?? 'No'),
    escapeCSV(orgDetails.activity_im ?? 'No'),
    escapeCSV(orgDetails.activity_se ?? 'No'),
    escapeCSV(orgDetails.activity_hl ?? 'No'),
    escapeCSV(orgDetails.activity_om ?? 'No'),
    escapeCSV(orgDetails.activity_sl ?? 'No'),
    escapeCSV(orgDetails.registration_type_code ?? ''),
    turnover,
    tonnage,
    boolToYN(orgDetails.produce_blank_packaging_flag),
    boolToYN(orgDetails.liable_for_disposal_costs_flag),
    boolToYN(orgDetails.meet_reporting_requirements_flag),
    // Registered address
    escapeCSV(registered?.line_1 ?? ''),
    escapeCSV(registered?.line_2 ?? ''),
    escapeCSV(registered?.city ?? ''),
    escapeCSV(registered?.county ?? ''),
    escapeCSV(registered?.postcode ?? ''),
    escapeCSV(registered?.country ?? ''),
    escapeCSV(registered?.phone ?? ''),
    // Audit address
    escapeCSV(audit?.line_1 ?? ''),
    escapeCSV(audit?.line_2 ?? ''),
    escapeCSV(audit?.city ?? ''),
    escapeCSV(audit?.county ?? ''),
    escapeCSV(audit?.postcode ?? ''),
    escapeCSV(audit?.country ?? ''),
    // Service of notice address
    escapeCSV(serviceOfNotice?.line_1 ?? ''),
    escapeCSV(serviceOfNotice?.line_2 ?? ''),
    escapeCSV(serviceOfNotice?.city ?? ''),
    escapeCSV(serviceOfNotice?.county ?? ''),
    escapeCSV(serviceOfNotice?.postcode ?? ''),
    escapeCSV(serviceOfNotice?.country ?? ''),
    escapeCSV(serviceOfNotice?.phone ?? ''),
    // Principal address
    escapeCSV(principal?.line_1 ?? ''),
    escapeCSV(principal?.line_2 ?? ''),
    escapeCSV(principal?.city ?? ''),
    escapeCSV(principal?.county ?? ''),
    escapeCSV(principal?.postcode ?? ''),
    escapeCSV(principal?.country ?? ''),
    escapeCSV(principal?.phone ?? ''),
    // Sole trader
    escapeCSV(orgDetails.sole_trader_first_name ?? ''),
    escapeCSV(orgDetails.sole_trader_last_name ?? ''),
    escapeCSV(orgDetails.sole_trader_phone ?? ''),
    escapeCSV(orgDetails.sole_trader_email ?? ''),
    // Approved person
    escapeCSV(approved?.first_name ?? ''),
    escapeCSV(approved?.last_name ?? ''),
    escapeCSV(approved?.phone ?? ''),
    escapeCSV(approved?.email ?? ''),
    escapeCSV(approved?.job_title ?? ''),
    // Delegated person
    escapeCSV(delegated?.first_name ?? ''),
    escapeCSV(delegated?.last_name ?? ''),
    escapeCSV(delegated?.phone ?? ''),
    escapeCSV(delegated?.email ?? ''),
    escapeCSV(delegated?.job_title ?? ''),
    // Primary contact
    escapeCSV(primary?.first_name ?? ''),
    escapeCSV(primary?.last_name ?? ''),
    escapeCSV(primary?.phone ?? ''),
    escapeCSV(primary?.email ?? ''),
    escapeCSV(primary?.job_title ?? ''),
    // Secondary contact
    escapeCSV(secondary?.first_name ?? ''),
    escapeCSV(secondary?.last_name ?? ''),
    escapeCSV(secondary?.phone ?? ''),
    escapeCSV(secondary?.email ?? ''),
    escapeCSV(secondary?.job_title ?? ''),
    // Size & leaver/joiner
    orgSize,
    escapeCSV(orgDetails.leaver_code ?? ''),
    escapeCSV(orgDetails.leaver_date ?? ''),
    escapeCSV(orgDetails.organisation_change_reason ?? ''),
    escapeCSV(orgDetails.joiner_date ?? ''),
  ];

  const rows: string[] = [];
  rows.push(HMRC_ORG_DETAILS_CSV_HEADERS.join(','));
  rows.push(row.join(','));

  return rows.join('\r\n') + '\r\n';
}

// =============================================================================
// Template 2: Brand Details CSV (4 columns)
// =============================================================================

export function generateBrandsCSV(
  brands: HMRCBrand[],
  orgId: string,
  subsidiaryId?: string | null
): string {
  const rows: string[] = [];
  rows.push(HMRC_BRAND_DETAILS_CSV_HEADERS.join(','));

  for (const brand of brands) {
    rows.push([
      escapeCSV(orgId),
      escapeCSV(subsidiaryId ?? ''),
      escapeCSV(brand.brand_name),
      escapeCSV(brand.brand_type_code),
    ].join(','));
  }

  return rows.join('\r\n') + '\r\n';
}

// =============================================================================
// Template 3: Partner Details CSV (6 columns)
// =============================================================================

export function generatePartnersCSV(
  partners: HMRCPartner[],
  orgId: string,
  subsidiaryId?: string | null
): string {
  const rows: string[] = [];
  rows.push(HMRC_PARTNER_DETAILS_CSV_HEADERS.join(','));

  for (const partner of partners) {
    rows.push([
      escapeCSV(orgId),
      escapeCSV(subsidiaryId ?? ''),
      escapeCSV(partner.first_name),
      escapeCSV(partner.last_name),
      escapeCSV(partner.phone ?? ''),
      escapeCSV(partner.email ?? ''),
    ].join(','));
  }

  return rows.join('\r\n') + '\r\n';
}

// =============================================================================
// Helpers
// =============================================================================

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function boolToYN(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}
