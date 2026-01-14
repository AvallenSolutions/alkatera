'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, ArrowRight, Check, X, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceLimit {
  resourceType: string;
  currentUsage: number;
  newLimit: number;
  overLimit: boolean;
  excessCount: number;
}

interface ProrationInfo {
  currentPlanCredit: number;
  newPlanCost: number;
  netAmount: number;
  currency: string;
  isUpgrade: boolean;
  immediateCharge: number;
  credit: number;
}

interface DowngradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentTier: string;
  newTier: string;
  currentTierDisplayName: string;
  newTierDisplayName: string;
  organizationId: string;
  priceId: string;
  isProcessing?: boolean;
}

const RESOURCE_LABELS: Record<string, string> = {
  facilities: 'Facilities',
  products: 'Products',
  team_members: 'Team Members',
  lcas: 'LCAs',
  suppliers: 'Suppliers',
};

export function DowngradeConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  currentTier,
  newTier,
  currentTierDisplayName,
  newTierDisplayName,
  organizationId,
  priceId,
  isProcessing = false,
}: DowngradeConfirmationModalProps) {
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<ResourceLimit[]>([]);
  const [proration, setProration] = useState<ProrationInfo | null>(null);
  const [hasOverLimit, setHasOverLimit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDowngradeInfo();
    }
  }, [isOpen, organizationId, newTier, priceId]);

  async function fetchDowngradeInfo() {
    setLoading(true);
    setError(null);

    try {
      // Fetch both limit check and proration in parallel
      const [limitsResponse, prorationResponse] = await Promise.all([
        fetch('/api/stripe/check-downgrade-limits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, newTier }),
        }),
        fetch('/api/stripe/proration-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, newPriceId: priceId }),
        }),
      ]);

      if (limitsResponse.ok) {
        const limitsData = await limitsResponse.json();
        setResources(limitsData.resources || []);
        setHasOverLimit(limitsData.hasOverLimit || false);
      }

      if (prorationResponse.ok) {
        const prorationData = await prorationResponse.json();
        setProration(prorationData.proration || null);
      }
    } catch (err: any) {
      console.error('Error fetching downgrade info:', err);
      setError('Failed to load downgrade information');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number, currency: string = 'gbp') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount / 100);
  };

  const overLimitResources = resources.filter((r) => r.overLimit);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasOverLimit && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            Confirm Plan Change
          </DialogTitle>
          <DialogDescription>
            Review the changes before switching to {newTierDisplayName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">{error}</div>
        ) : (
          <div className="space-y-4">
            {/* Plan Comparison */}
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <Badge variant="outline" className="mb-2">
                  Current
                </Badge>
                <p className="font-semibold">{currentTierDisplayName}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <Badge variant="secondary" className="mb-2">
                  New
                </Badge>
                <p className="font-semibold">{newTierDisplayName}</p>
              </div>
            </div>

            <Separator />

            {/* Limit Changes */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Plan Limits</h4>
              <div className="space-y-2">
                {resources.map((resource) => (
                  <div
                    key={resource.resourceType}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md',
                      resource.overLimit
                        ? 'bg-red-50 dark:bg-red-950/30'
                        : 'bg-muted/50'
                    )}
                  >
                    <span className="text-sm">
                      {RESOURCE_LABELS[resource.resourceType] || resource.resourceType}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          resource.overLimit && 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {resource.currentUsage} / {resource.newLimit}
                      </span>
                      {resource.overLimit ? (
                        <X className="h-4 w-4 text-red-500" />
                      ) : (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grace Period Warning */}
            {hasOverLimit && (
              <>
                <Separator />
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        7-Day Grace Period
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Your current usage exceeds the new plan limits. You'll have{' '}
                        <strong>7 days</strong> to reduce your usage. After that, the
                        oldest excess items will be automatically removed:
                      </p>
                      <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-1">
                        {overLimitResources.map((resource) => (
                          <li key={resource.resourceType}>
                            • {resource.excessCount}{' '}
                            {RESOURCE_LABELS[resource.resourceType]?.toLowerCase() ||
                              resource.resourceType}{' '}
                            will be removed
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Proration Info */}
            {proration && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3">Billing Adjustment</h4>
                  <div className="space-y-2 text-sm">
                    {proration.currentPlanCredit > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Credit from current plan
                        </span>
                        <span className="text-green-600">
                          +{formatCurrency(proration.currentPlanCredit, proration.currency)}
                        </span>
                      </div>
                    )}
                    {proration.newPlanCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Cost for new plan (prorated)
                        </span>
                        <span>
                          {formatCurrency(proration.newPlanCost, proration.currency)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>
                        {proration.netAmount >= 0 ? 'Amount due today' : 'Credit applied'}
                      </span>
                      <span
                        className={cn(
                          proration.netAmount < 0 && 'text-green-600'
                        )}
                      >
                        {proration.netAmount < 0 && '+'}
                        {formatCurrency(Math.abs(proration.netAmount), proration.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant={hasOverLimit ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : hasOverLimit ? (
              'Confirm Downgrade'
            ) : (
              'Change Plan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
