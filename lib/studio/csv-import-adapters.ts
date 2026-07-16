// Per-family adapters for components/studio/csv-paste-import.tsx — the
// generalised "paste a spreadsheet" flow (tasks/data-revolution-plan.md
// Pillar 2, "CSV anything"). Each adapter describes the columns worth
// mapping and turns one mapped row into the payload the family's existing
// create API already accepts — the SAME endpoint the quick-add row and the
// full dialog both post to, so there is exactly one write path per family.

import type { ColumnFieldSpec } from '@/components/shared/column-mapper';
import { slugifyEnum } from './quick-add-configs';

export interface CsvImportAdapter<Key extends string = string> {
  key: string;
  /** Plural, lower case — used in copy like "Import 12 board members". */
  label: string;
  endpoint: string;
  fields: ColumnFieldSpec<Key>[];
  aliases: Record<Key, string[]>;
  buildPayload: (row: Record<Key, string>) => Record<string, unknown>;
}

const num = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const bool = (v: string | undefined): boolean => {
  if (!v) return false;
  return ['true', 'yes', 'y', '1'].includes(v.trim().toLowerCase());
};

// ── Board members ───────────────────────────────────────────────────────

type BoardKey =
  | 'member_name' | 'role' | 'member_type' | 'gender' | 'age_bracket'
  | 'ethnicity' | 'appointment_date' | 'is_independent' | 'meeting_attendance_rate';

export const boardCsvAdapter: CsvImportAdapter<BoardKey> = {
  key: 'board',
  label: 'board members',
  endpoint: '/api/governance/board',
  fields: [
    { key: 'member_name', label: 'Name', required: true },
    { key: 'role', label: 'Role', required: true, hint: 'chair, vice_chair, director, secretary or treasurer' },
    { key: 'member_type', label: 'Member type', required: true, hint: 'executive, non_executive or independent' },
    { key: 'gender', label: 'Gender', required: false },
    { key: 'age_bracket', label: 'Age bracket', required: false },
    { key: 'ethnicity', label: 'Ethnicity', required: false },
    { key: 'appointment_date', label: 'Appointment date', required: false },
    { key: 'is_independent', label: 'Independent director', required: false },
    { key: 'meeting_attendance_rate', label: 'Attendance rate (%)', required: false },
  ],
  aliases: {
    member_name: ['name', 'member name', 'full name', 'director'],
    role: ['role', 'position', 'board role'],
    member_type: ['member type', 'type', 'category'],
    gender: ['gender', 'sex'],
    age_bracket: ['age bracket', 'age band', 'age'],
    ethnicity: ['ethnicity', 'ethnic background'],
    appointment_date: ['appointment date', 'appointed', 'start date', 'date appointed'],
    is_independent: ['independent', 'is independent', 'independent director'],
    meeting_attendance_rate: ['attendance', 'attendance rate', 'meeting attendance'],
  },
  buildPayload: (row) => ({
    member_name: row.member_name,
    role: slugifyEnum(row.role || ''),
    member_type: slugifyEnum(row.member_type || ''),
    gender: row.gender ? slugifyEnum(row.gender) : null,
    age_bracket: row.age_bracket ? slugifyEnum(row.age_bracket) : null,
    ethnicity: row.ethnicity || null,
    appointment_date: row.appointment_date || null,
    is_independent: bool(row.is_independent),
    meeting_attendance_rate: num(row.meeting_attendance_rate),
  }),
};

// ── Compensation records ────────────────────────────────────────────────

type CompensationKey =
  | 'role_title' | 'department' | 'employment_type' | 'annual_salary'
  | 'hourly_rate' | 'work_country' | 'work_region' | 'gender' | 'role_level';

export const compensationCsvAdapter: CsvImportAdapter<CompensationKey> = {
  key: 'compensation',
  label: 'compensation records',
  endpoint: '/api/people-culture/compensation',
  fields: [
    { key: 'role_title', label: 'Role title', required: false },
    { key: 'department', label: 'Department', required: false },
    { key: 'employment_type', label: 'Employment type', required: true, hint: 'full_time, part_time, contractor or intern' },
    { key: 'annual_salary', label: 'Annual salary', required: false, hint: 'Either this or hourly rate is required' },
    { key: 'hourly_rate', label: 'Hourly rate', required: false },
    { key: 'work_country', label: 'Country', required: false },
    { key: 'work_region', label: 'Region', required: false },
    { key: 'gender', label: 'Gender', required: false },
    { key: 'role_level', label: 'Role level', required: false },
  ],
  aliases: {
    role_title: ['role', 'role title', 'job title', 'title'],
    department: ['department', 'team'],
    employment_type: ['employment type', 'contract', 'employment'],
    annual_salary: ['annual salary', 'salary', 'yearly salary'],
    hourly_rate: ['hourly rate', 'rate per hour', 'hourly pay'],
    work_country: ['country', 'work country'],
    work_region: ['region', 'work region', 'location'],
    gender: ['gender', 'sex'],
    role_level: ['role level', 'level', 'seniority'],
  },
  buildPayload: (row) => ({
    role_title: row.role_title || null,
    department: row.department || null,
    employment_type: row.employment_type ? slugifyEnum(row.employment_type) : 'full_time',
    annual_salary: num(row.annual_salary),
    hourly_rate: num(row.hourly_rate),
    work_country: row.work_country || 'United Kingdom',
    work_region: row.work_region || null,
    gender: row.gender ? slugifyEnum(row.gender) : null,
    role_level: row.role_level ? slugifyEnum(row.role_level) : null,
  }),
};

// ── Donations ────────────────────────────────────────────────────────────

type DonationKey =
  | 'donation_name' | 'donation_type' | 'recipient_name' | 'recipient_type'
  | 'recipient_cause' | 'donation_amount' | 'estimated_value' | 'hours_donated'
  | 'donation_date' | 'beneficiaries_count' | 'description';

export const donationCsvAdapter: CsvImportAdapter<DonationKey> = {
  key: 'donations',
  label: 'donations',
  endpoint: '/api/community-impact/donations',
  fields: [
    { key: 'donation_name', label: 'Donation name', required: true },
    { key: 'donation_type', label: 'Type', required: true, hint: 'cash, in_kind, time or pro_bono' },
    { key: 'recipient_name', label: 'Recipient', required: true },
    { key: 'recipient_type', label: 'Recipient type', required: false },
    { key: 'recipient_cause', label: 'Cause', required: false },
    { key: 'donation_amount', label: 'Amount (£)', required: false },
    { key: 'estimated_value', label: 'Estimated value (£)', required: false },
    { key: 'hours_donated', label: 'Hours donated', required: false },
    { key: 'donation_date', label: 'Date', required: false },
    { key: 'beneficiaries_count', label: 'Beneficiaries', required: false },
    { key: 'description', label: 'Description', required: false },
  ],
  aliases: {
    donation_name: ['donation', 'donation name', 'name'],
    donation_type: ['type', 'donation type'],
    recipient_name: ['recipient', 'recipient name', 'charity', 'beneficiary organisation'],
    recipient_type: ['recipient type'],
    recipient_cause: ['cause', 'category'],
    donation_amount: ['amount', 'donation amount', 'value'],
    estimated_value: ['estimated value', 'in-kind value', 'in kind value'],
    hours_donated: ['hours', 'hours donated'],
    donation_date: ['date', 'donation date'],
    beneficiaries_count: ['beneficiaries', 'beneficiaries reached', 'people reached'],
    description: ['description', 'notes'],
  },
  buildPayload: (row) => ({
    donation_name: row.donation_name,
    donation_type: slugifyEnum(row.donation_type || 'cash'),
    recipient_name: row.recipient_name,
    recipient_type: row.recipient_type ? slugifyEnum(row.recipient_type) : null,
    recipient_cause: row.recipient_cause ? slugifyEnum(row.recipient_cause) : null,
    donation_amount: num(row.donation_amount),
    estimated_value: num(row.estimated_value),
    hours_donated: num(row.hours_donated),
    donation_date: row.donation_date || null,
    beneficiaries_count: row.beneficiaries_count ? Math.round(num(row.beneficiaries_count) || 0) : null,
    description: row.description || null,
  }),
};
