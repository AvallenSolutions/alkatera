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
import { toast } from 'sonner';
import {
  RISK_TOOL_QUESTIONS,
  RISK_DIMENSION_LABELS,
  type RiskDimension,
} from '@/lib/certifications/risk-tool-questions';

interface RiskToolWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => Promise<void> | void;
}

const DIMENSION_ORDER: RiskDimension[] = [
  'sector',
  'geographic',
  'supply_chain',
  'workforce',
];

export function RiskToolWizard({
  open,
  onOpenChange,
  onCompleted,
}: RiskToolWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const dimension = DIMENSION_ORDER[stepIndex];
  const questions = RISK_TOOL_QUESTIONS.filter(
    (q) => q.dimension === dimension,
  );
  const isLastStep = stepIndex === DIMENSION_ORDER.length - 1;
  const stepComplete = questions.every((q) => !!responses[q.id]);

  const reset = () => {
    setStepIndex(0);
    setResponses({});
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/certifications/risk-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      if (!res.ok) {
        throw new Error('Failed to submit Risk Tool');
      }
      toast.success('Risk Tool completed');
      onOpenChange(false);
      reset();
      await onCompleted();
    } catch (err) {
      console.error(err);
      toast.error('Could not submit the Risk Tool. Please try again.');
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Risk Tool — {RISK_DIMENSION_LABELS[dimension]}
          </DialogTitle>
          <DialogDescription>
            Step {stepIndex + 1} of {DIMENSION_ORDER.length}. Your answers
            determine which requirements warrant elevated focus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm font-medium">{q.prompt}</Label>
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const selected = responses[q.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setResponses((r) => ({ ...r, [q.id]: opt.value }))
                      }
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          {stepIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => setStepIndex((i) => i - 1)}
              disabled={submitting}
            >
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={!stepComplete || submitting}
            >
              {submitting ? 'Submitting...' : 'Complete Risk Tool'}
            </Button>
          ) : (
            <Button
              onClick={() => setStepIndex((i) => i + 1)}
              disabled={!stepComplete}
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
