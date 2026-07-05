'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UserCircle, ArrowRight } from 'lucide-react';
import {
  getProfileCompleteness,
  type ProfileCompletenessInput,
} from '@/lib/suppliers/profile-completeness';

/** Supplier-facing nudge to finish their profile. Hidden once complete. */
export function ProfileCompletenessCard({ profile }: { profile: ProfileCompletenessInput }) {
  const { percent, missing } = getProfileCompleteness(profile);
  if (percent >= 100) return null;

  return (
    <Card className="rounded-[6px] border border-border bg-card">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <UserCircle className="h-5 w-5 text-studio-cobalt flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Your profile is {percent}% complete</p>
              <p className="text-sm text-muted-foreground">
                Add the rest so buyers can find and trust you
                {missing.length > 0 ? `: ${missing.slice(0, 3).join(', ')}` : ''}.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="flex-shrink-0">
            <Link href="/supplier-portal/profile">
              Complete profile
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
        <Progress value={percent} className="h-2" />
      </CardContent>
    </Card>
  );
}
