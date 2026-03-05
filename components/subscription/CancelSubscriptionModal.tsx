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
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, ArrowDown, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelled: () => void;
  onDowngradeInstead: () => void;
  organizationId: string;
  currentTierDisplayName: string;
  canDowngrade: boolean;
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onCancelled,
  onDowngradeInstead,
  organizationId,
  currentTierDisplayName,
  canDowngrade,
}: CancelSubscriptionModalProps) {
  const [step, setStep] = useState<'confirm' | 'final'>('confirm');
  const [processing, setProcessing] = useState(false);

  function handleClose() {
    setStep('confirm');
    onClose();
  }

  async function handleCancelSubscription() {
    setProcessing(true);
    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      const cancelDate = data.cancelAt
        ? new Date(data.cancelAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : null;

      toast.success(
        cancelDate
          ? `Subscription will be cancelled on ${cancelDate}`
          : 'Subscription cancellation scheduled'
      );

      setStep('confirm');
      onCancelled();
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast.error(error.message || 'Failed to cancel subscription');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        {step === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Cancel Your Subscription?
              </DialogTitle>
              <DialogDescription>
                We&apos;re sorry to see you thinking about leaving.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Before you cancel your <strong>{currentTierDisplayName}</strong> plan,
                would you consider downgrading instead? You&apos;ll keep access to core
                features at a lower price.
              </p>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  What happens if you cancel
                </h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1.5">
                  <li>• Your subscription will remain active until the end of your current billing period</li>
                  <li>• After that, your account will revert to the free Seed plan</li>
                  <li>• Your data will be preserved, but access to paid features will be restricted</li>
                  <li>• You can resubscribe at any time</li>
                </ul>
              </div>
            </div>

            <Separator />

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              {canDowngrade && (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    handleClose();
                    onDowngradeInstead();
                  }}
                >
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Downgrade Instead
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                Keep My Subscription
              </Button>
              <Button
                variant="ghost"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                onClick={() => setStep('final')}
              >
                I still want to cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Confirm Cancellation
              </DialogTitle>
              <DialogDescription>
                This will cancel your {currentTierDisplayName} subscription at the end of the current billing period.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure? Your subscription will remain active until the end of your
                current billing period, after which you&apos;ll be moved to the free Seed plan.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setStep('confirm')}
                disabled={processing}
              >
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelSubscription}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel My Subscription'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
