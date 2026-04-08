-- Merge external_expert and external_panel into a single 'external' review type
-- Impact Focus will handle all independent third-party reviews

-- Update existing rows to the new value
UPDATE lca_critical_reviews
SET review_type = 'external'
WHERE review_type IN ('external_expert', 'external_panel');

-- Drop the old constraint and add the updated one
ALTER TABLE lca_critical_reviews
  DROP CONSTRAINT IF EXISTS lca_critical_reviews_review_type_check;

ALTER TABLE lca_critical_reviews
  ADD CONSTRAINT lca_critical_reviews_review_type_check
  CHECK (review_type IN ('internal', 'external'));

-- Update reviewer_type constraint to remove panel roles
UPDATE lca_reviewers
SET reviewer_type = 'external_expert'
WHERE reviewer_type IN ('panel_chair', 'panel_member');

ALTER TABLE lca_reviewers
  DROP CONSTRAINT IF EXISTS lca_reviewers_reviewer_type_check;

ALTER TABLE lca_reviewers
  ADD CONSTRAINT lca_reviewers_reviewer_type_check
  CHECK (reviewer_type IN ('internal', 'external_expert'));
