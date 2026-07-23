'use client';

import { useEffect, useState } from 'react';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { TheWalk } from '@/components/onboarding/TheWalk';

/**
 * The desk's first-visit orientation, for everyone the arrival ritual doesn't
 * catch, above all migrated/existing customers at cutover: they already have
 * data and a paid plan, so the ritual is skipped and they land straight on the
 * desk with no idea what the seven colour rooms mean. This gives them the same
 * walk a new signup gets after checkout.
 *
 * Gate:
 *   - introSeen already true → nothing auto-shows; the walk is offered as a
 *     quiet "Show me around" re-run instead. The flag is persisted server-side
 *     (onboarding_state via markRoomIntroSeen), so a returning user never sees
 *     it again, on any device.
 *   - the arrival wizard is open (a fresh signup mid-ritual) → wait; that user
 *     sees the walk post-checkout, which sets introSeen, so this stays quiet.
 *   - otherwise (migrated user, first desk visit) → auto-play the walk once,
 *     then mark it seen.
 *
 * Replaces the old DeskWelcome popover tour as the desk's orientation, so the
 * walk is the single, consistent way the house is taught, new or migrated.
 */
export function DeskArrivalWalk() {
  const { state, isLoading, shouldShowOnboarding, markRoomIntroSeen } = useOnboarding();
  const introSeen = state.rooms?.desk?.introSeen ?? false;

  const [decided, setDecided] = useState(false);
  const [autoWalking, setAutoWalking] = useState(false);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    if (isLoading || decided) return;
    if (introSeen) {
      setDecided(true);
      return;
    }
    if (shouldShowOnboarding) {
      // The arrival wizard is still on screen (a fresh signup). They see the
      // walk post-checkout; don't decide yet, re-evaluate when it closes.
      return;
    }
    // Migrated / existing user, first desk visit, no ritual to teach them.
    setDecided(true);
    setAutoWalking(true);
  }, [isLoading, decided, introSeen, shouldShowOnboarding]);

  const walking = autoWalking || replaying;

  if (walking) {
    return (
      <TheWalk
        onDone={() => {
          setAutoWalking(false);
          setReplaying(false);
          if (!introSeen) markRoomIntroSeen('desk');
        }}
      />
    );
  }

  // Once the walk has been seen, keep it one tap away, never in the user's face.
  if (!isLoading && decided) {
    return (
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setReplaying(true)}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Show me around
        </button>
      </div>
    );
  }

  return null;
}
