/** Shared supplier profile-completeness calculation, used by the supplier
 *  dashboard nudge and the brand's supplier detail indicator so both agree. */

export interface ProfileCompletenessInput {
  name?: string | null;
  description?: string | null;
  industry_sector?: string | null;
  country?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

const FIELDS: { key: keyof ProfileCompletenessInput; label: string }[] = [
  { key: 'name', label: 'Business name' },
  { key: 'description', label: 'What you supply' },
  { key: 'industry_sector', label: 'Sector' },
  { key: 'country', label: 'Location' },
  { key: 'website', label: 'Website' },
  { key: 'logo_url', label: 'Logo' },
];

export interface ProfileCompleteness {
  percent: number;
  filled: number;
  total: number;
  missing: string[];
}

export function getProfileCompleteness(p: ProfileCompletenessInput | null | undefined): ProfileCompleteness {
  const missing: string[] = [];
  let filled = 0;
  for (const f of FIELDS) {
    const v = p?.[f.key];
    if (typeof v === 'string' && v.trim() !== '') filled += 1;
    else missing.push(f.label);
  }
  const total = FIELDS.length;
  return { percent: Math.round((filled / total) * 100), filled, total, missing };
}
