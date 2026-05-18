'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sparkles, RefreshCw } from 'lucide-react';

export interface JourneyChoice {
  certification_type: 'new' | 'recertification';
  certification_start_date: string;
  ecgt_applicable: boolean;
  previous_bia_score?: number;
}

interface JourneySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choice: JourneyChoice) => Promise<void>;
}

export function JourneySelectionDialog({
  open,
  onOpenChange,
  onConfirm,
}: JourneySelectionDialogProps) {
  const [step, setStep] = useState<'choose' | 'recert'>('choose');
  const [ecgtApplicable, setEcgtApplicable] = useState<boolean | null>(null);
  const [previousScore, setPreviousScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const reset = () => {
    setStep('choose');
    setEcgtApplicable(null);
    setPreviousScore('');
  };

  const handleNew = async () => {
    setSubmitting(true);
    try {
      await onConfirm({
        certification_type: 'new',
        certification_start_date: today,
        ecgt_applicable: false,
      });
      onOpenChange(false);
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecertConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({
        certification_type: 'recertification',
        certification_start_date: today,
        ecgt_applicable: ecgtApplicable === true,
        previous_bia_score: previousScore
          ? Number(previousScore)
          : undefined,
      });
      onOpenChange(false);
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        {step === 'choose' ? (
          <>
            <DialogHeader>
              <DialogTitle>How would you like to begin?</DialogTitle>
              <DialogDescription>
                Choose the path that matches where your organisation is on its
                B Corp journey.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleNew}
                className="w-full rounded-lg border p-4 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-60"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  Certifying for the first time
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  We will guide you through the Foundation Requirements, then
                  the Impact Topics. Most organisations reach submission in 12
                  to 24 months.
                </p>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep('recert')}
                className="w-full rounded-lg border p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-60"
              >
                <div className="flex items-center gap-2 font-medium">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  Recertifying as an existing B Corp
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jump straight to the gap analysis against the 2026 standards.
                </p>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Recertification details</DialogTitle>
              <DialogDescription>
                A couple of questions so we can tailor your recertification.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label>
                  Does your organisation operate in the EU and use B Corp
                  certification in consumer-facing marketing or communications?
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={ecgtApplicable === true ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEcgtApplicable(true)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={ecgtApplicable === false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEcgtApplicable(false)}
                  >
                    No
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prev_bia">
                  Previous BIA score (optional, for reference)
                </Label>
                <Input
                  id="prev_bia"
                  type="number"
                  value={previousScore}
                  onChange={(e) => setPreviousScore(e.target.value)}
                  placeholder="e.g. 92.4"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep('choose')}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                onClick={handleRecertConfirm}
                disabled={submitting || ecgtApplicable === null}
              >
                {submitting ? 'Starting...' : 'Continue to gap analysis'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
