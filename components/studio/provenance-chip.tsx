import type { Provenance } from '@/lib/provenance';
import { StateChip } from './state-chip';

const TONE: Record<Provenance, 'quiet' | 'attention' | 'good'> = {
  estimated: 'quiet',
  drafted: 'attention',
  confirmed: 'good',
};

const LABEL: Record<Provenance, string> = {
  estimated: 'Estimated.',
  drafted: 'From your documents.',
  confirmed: 'Confirmed.',
};

/** Shorter label for tight spaces (table cells, inline with a value). */
const COMPACT_LABEL: Record<Provenance, string> = {
  estimated: 'Estimated.',
  drafted: 'Drafted.',
  confirmed: 'Confirmed.',
};

interface ProvenanceChipProps {
  provenance: Provenance;
  /** Use the shorter "Drafted." label instead of "From your documents." */
  compact?: boolean;
  className?: string;
}

/**
 * Renders a Provenance value in studio language, using the shared
 * `StateChip` tones: estimated sits quiet (nobody has looked at it yet),
 * drafted draws the eye (it's waiting on a person), confirmed reads as
 * settled. Not mounted anywhere yet — later phases retrofit this onto the
 * surfaces that already carry a legacy status/quality field, via the
 * `lib/provenance` mappers.
 */
export function ProvenanceChip({ provenance, compact = false, className }: ProvenanceChipProps) {
  const label = compact ? COMPACT_LABEL[provenance] : LABEL[provenance];
  return (
    <StateChip tone={TONE[provenance]} className={className}>
      {label}
    </StateChip>
  );
}
