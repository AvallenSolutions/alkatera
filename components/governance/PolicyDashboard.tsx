'use client';

import { ExternalLink } from 'lucide-react';
import { Policy, PolicyMetrics } from '@/hooks/data/usePolicies';
import { getPolicyDocumentUrl } from '@/lib/governance/policies';

import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { Panel } from '@/components/studio/panel';
import { Section, SummaryRow } from '@/components/social';
import type { WorkingTone } from '@/components/studio/theme';

interface PolicyDashboardProps {
  policies: Policy[];
  metrics: PolicyMetrics;
  isLoading?: boolean;
  onEditPolicy?: (policy: Policy) => void;
}

const STATUS_TONES: Record<string, WorkingTone> = {
  active: 'good',
  draft: 'quiet',
  under_review: 'attention',
  archived: 'stale',
};

function PolicyCard({ policy, onEdit }: { policy: Policy; onEdit?: (policy: Policy) => void }) {
  const typeLabels: Record<string, string> = {
    ethics: 'Ethics',
    environmental: 'Environmental',
    social: 'Social',
    governance: 'Governance',
    compliance: 'Compliance',
  };

  const isReviewOverdue = policy.review_date && new Date(policy.review_date) < new Date();

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium truncate">{policy.policy_name}</h3>
            {policy.policy_code && (
              <span className="text-xs text-muted-foreground">({policy.policy_code})</span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StateChip tone={STATUS_TONES[policy.status] ?? 'quiet'}>
              {policy.status.replace('_', ' ')}
            </StateChip>
            <StateChip tone="quiet">
              {typeLabels[policy.policy_type] || policy.policy_type}
            </StateChip>
            {policy.is_public ? (
              <StateChip tone="good">Public</StateChip>
            ) : (
              <StateChip tone="quiet">Internal</StateChip>
            )}
          </div>

          {policy.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {policy.description}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {policy.owner_name && (
              <span>Owner: {policy.owner_name}</span>
            )}
            {policy.effective_date && (
              <span>Effective: {new Date(policy.effective_date).toLocaleDateString()}</span>
            )}
            {policy.review_date && (
              <span className={isReviewOverdue ? 'font-medium text-studio-stale' : ''}>
                {isReviewOverdue
                  ? 'Review overdue'
                  : `Review: ${new Date(policy.review_date).toLocaleDateString()}`}
              </span>
            )}
          </div>

          {policy.attachments && policy.attachments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                Attachments ({policy.attachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {policy.attachments.map((attachment, index) => (
                  <PillButton
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const url = await getPolicyDocumentUrl(attachment.path);
                      if (url) {
                        window.open(url, '_blank');
                      }
                    }}
                  >
                    {attachment.name}
                  </PillButton>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {policy.public_url && (
            <a
              href={policy.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-studio-dim transition-colors hover:text-foreground"
              aria-label="Open public policy page"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {onEdit && (
            <PillButton variant="ghost" size="sm" onClick={() => onEdit(policy)}>
              Edit
            </PillButton>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function PolicyDashboard({
  policies,
  metrics,
  isLoading,
  onEditPolicy,
}: PolicyDashboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-6" aria-hidden="true">
        <div className="h-24 animate-pulse rounded-[6px] bg-studio-cream" />
        <div className="h-40 animate-pulse rounded-[6px] bg-studio-cream" />
        <div className="h-40 animate-pulse rounded-[6px] bg-studio-cream" />
      </div>
    );
  }

  const activePolicies = policies.filter(p => p.status === 'active');
  const draftPolicies = policies.filter(p => p.status === 'draft');

  return (
    <div className="space-y-8">
      <SummaryRow
        figures={[
          { value: metrics.total_policies, label: 'Total policies' },
          { value: metrics.active_policies, label: 'Active', tone: 'good' },
          {
            value: metrics.due_for_review,
            label: 'Due for review',
            tone: metrics.due_for_review > 0 ? 'attention' : 'ink',
          },
          { value: metrics.public_policies, label: 'Public' },
        ]}
      />

      {Object.keys(metrics.by_type).length > 0 && (
        <Section label="POLICY COVERAGE" blurb="Policies by type.">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(metrics.by_type).map(([type, count]) => (
              <StateChip key={type} tone="quiet">
                {type}: {count}
              </StateChip>
            ))}
          </div>
        </Section>
      )}

      {activePolicies.length > 0 && (
        <Section label={`ACTIVE POLICIES (${activePolicies.length})`}>
          <div className="space-y-3">
            {activePolicies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} onEdit={onEditPolicy} />
            ))}
          </div>
        </Section>
      )}

      {draftPolicies.length > 0 && (
        <Section label={`DRAFT POLICIES (${draftPolicies.length})`}>
          <div className="space-y-3">
            {draftPolicies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} onEdit={onEditPolicy} />
            ))}
          </div>
        </Section>
      )}

      {policies.length === 0 && (
        <div className="border-t border-studio-hairline pt-6 text-sm text-muted-foreground">
          No policies yet. Add your first policy to track governance and compliance.
        </div>
      )}
    </div>
  );
}
