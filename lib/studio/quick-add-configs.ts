// Per-family configs for components/studio/quick-add-row.tsx — the
// composer-style row that replaces "Add X" as the visible add path for the
// three worst one-dialog-per-record offenders (tasks/data-revolution-plan.md
// Pillar 2). Each config posts straight through the family's existing
// create API, the same one its full dialog uses.

import type { QuickAddConfig } from '@/components/studio/quick-add-row';

/** Best-effort enum normaliser for spreadsheet/typed values against a fixed
 *  select vocabulary — "Non-Executive" / "non-executive" → "non_executive". */
export function slugifyEnum(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export const boardQuickAddConfig: QuickAddConfig = {
  nameField: { key: 'member_name', placeholder: 'Name, e.g. Jane Smith' },
  fields: [
    {
      key: 'role',
      type: 'select',
      placeholder: 'Role',
      options: [
        { value: 'chair', label: 'Chair' },
        { value: 'vice_chair', label: 'Vice Chair' },
        { value: 'director', label: 'Director' },
        { value: 'secretary', label: 'Secretary' },
        { value: 'treasurer', label: 'Treasurer' },
      ],
    },
    {
      key: 'member_type',
      type: 'select',
      placeholder: 'Type',
      options: [
        { value: 'executive', label: 'Executive' },
        { value: 'non_executive', label: 'Non-Executive' },
        { value: 'independent', label: 'Independent' },
      ],
    },
  ],
  endpoint: '/api/governance/board',
  buildPayload: (v) => ({
    member_name: v.member_name,
    role: v.role,
    member_type: v.member_type,
  }),
  addLabel: 'Add',
  successMessage: 'Board member added.',
};

export const compensationQuickAddConfig: QuickAddConfig = {
  nameField: { key: 'role_title', placeholder: 'Role, e.g. Software Engineer' },
  fields: [
    {
      key: 'employment_type',
      type: 'select',
      placeholder: 'Employment type',
      options: [
        { value: 'full_time', label: 'Full Time' },
        { value: 'part_time', label: 'Part Time' },
        { value: 'contractor', label: 'Contractor' },
        { value: 'intern', label: 'Intern' },
      ],
    },
    {
      key: 'annual_salary',
      type: 'number',
      placeholder: 'Annual salary (£)',
      widthClassName: 'w-36',
    },
  ],
  endpoint: '/api/people-culture/compensation',
  buildPayload: (v) => ({
    role_title: v.role_title,
    employment_type: v.employment_type || 'full_time',
    annual_salary: v.annual_salary ? parseFloat(v.annual_salary) : null,
  }),
  addLabel: 'Add',
  successMessage: 'Compensation record added.',
};

export const donationQuickAddConfig: QuickAddConfig = {
  nameField: { key: 'donation_name', placeholder: 'Donation, e.g. Charity Gala Sponsorship' },
  fields: [
    {
      key: 'donation_type',
      type: 'select',
      placeholder: 'Type',
      options: [
        { value: 'cash', label: 'Cash' },
        { value: 'in_kind', label: 'In-Kind' },
        { value: 'time', label: 'Time' },
        { value: 'pro_bono', label: 'Pro Bono' },
      ],
    },
    {
      key: 'recipient_name',
      type: 'text',
      placeholder: 'Recipient, e.g. Local Food Bank',
      widthClassName: 'w-48',
    },
  ],
  endpoint: '/api/community-impact/donations',
  buildPayload: (v) => ({
    donation_name: v.donation_name,
    donation_type: v.donation_type || 'cash',
    recipient_name: v.recipient_name,
  }),
  addLabel: 'Log',
  successMessage: 'Donation logged.',
};
