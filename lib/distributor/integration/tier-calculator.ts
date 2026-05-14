export interface TierInput {
  /** True if the brand has at least one row in brand_document_submissions. */
  has_submission: boolean;
  /** True if a brand_distributor_links row exists. */
  is_linked: boolean;
  /** brand_distributor_links.confirmed_by_brand. */
  link_confirmed: boolean;
  /** True if the alkatera org has subscription_status='active' (loosely "full account"). */
  alkatera_full_account: boolean;
}

export type AlkateraTier = 1 | 2 | 3 | 4;

/**
 * Pure tier-rules calculator from the Phase 6 spec.
 *
 * Tier table:
 *   1: no submission, no alkatera link
 *   2: a submission exists OR an alkatera link is pending brand confirmation
 *   3: brand-confirmed alkatera link, standard plan
 *   4: brand-confirmed alkatera link, full account
 */
export function calculateAlkateraTier(input: TierInput): AlkateraTier {
  if (input.is_linked && input.link_confirmed) {
    return input.alkatera_full_account ? 4 : 3;
  }
  if (input.has_submission || (input.is_linked && !input.link_confirmed)) {
    return 2;
  }
  return 1;
}
