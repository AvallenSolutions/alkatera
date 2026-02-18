"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import {
  getAllTiers,
  formatPrice,
  calculateAnnualSavings,
  type TierPricing,
  type BillingInterval,
} from "@/lib/stripe-config";
import { calculateUsagePercentage, getUsageStatusColor } from "@/lib/subscription-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, CreditCard, FileText, Zap, TrendingUp, AlertCircle } from "lucide-react";

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);

  useEffect(() => {
    // Check for success/cancel in URL
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated successfully!");
      router.replace("/settings/billing");
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout cancelled");
      router.replace("/settings/billing");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (currentOrganization) {
      fetchBillingData();
    }
  }, [currentOrganization]);

  async function fetchBillingData() {
    if (!currentOrganization) return;

    try {
      setLoading(true);

      // Fetch organization data
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", currentOrganization.id)
        .single();

      if (orgError) throw orgError;
      setOrganizationData(org);

      // Fetch usage data using RPC function
      const { data: usage, error: usageError } = await supabase.rpc("get_organization_usage", {
        p_organization_id: currentOrganization.id,
      });

      if (usageError) throw usageError;
      setUsageData(usage);
    } catch (error: any) {
      console.error("Error fetching billing data:", error);
      toast.error("Failed to load billing information");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(priceId: string, tierName: string) {
    if (!currentOrganization) return;

    try {
      setProcessingCheckout(true);

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          organizationId: currentOrganization.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      toast.error(error.message || "Failed to start checkout");
      setProcessingCheckout(false);
    }
  }

  async function handleManageSubscription() {
    if (!organizationData?.stripe_customer_id) {
      toast.error("No active subscription to manage");
      return;
    }

    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error opening portal:', error);
      toast.error(error.message || 'Failed to open billing portal');
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const currentTier = organizationData?.subscription_tier || "seed";
  const subscriptionStatus = organizationData?.subscription_status || "active";
  const allTiers = getAllTiers();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and access invoices
        </p>
      </div>

      {/* Current Subscription Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>
                {allTiers.find((t) => t.tier === currentTier)?.displayName} Plan
              </CardDescription>
            </div>
            <Badge
              variant={
                subscriptionStatus === "active"
                  ? "default"
                  : subscriptionStatus === "trial"
                  ? "secondary"
                  : "destructive"
              }
            >
              {subscriptionStatus.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-lg font-semibold">
                {allTiers.find((t) => t.tier === currentTier)?.displayName}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing</p>
              <p className="text-lg font-semibold capitalize">{billingInterval}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Started</p>
              <p className="text-lg font-semibold">
                {organizationData?.subscription_started_at
                  ? new Date(organizationData.subscription_started_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>

          {organizationData?.stripe_customer_id && (
            <div className="mt-4">
              <Button onClick={handleManageSubscription} variant="outline">
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Payment Method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Section */}
      {usageData && (
        <Card>
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>Track your usage against plan limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageItem
              label="Products"
              current={usageData.usage.products.current}
              max={usageData.usage.products.max}
              isUnlimited={usageData.usage.products.is_unlimited}
            />
            <UsageItem
              label="LCAs"
              current={usageData.usage.lcas.current}
              max={usageData.usage.lcas.max}
              isUnlimited={usageData.usage.lcas.is_unlimited}
            />
            <UsageItem
              label="Team Members"
              current={usageData.usage.team_members.current}
              max={usageData.usage.team_members.max}
              isUnlimited={usageData.usage.team_members.is_unlimited}
            />
            <UsageItem
              label="Facilities"
              current={usageData.usage.facilities.current}
              max={usageData.usage.facilities.max}
              isUnlimited={usageData.usage.facilities.is_unlimited}
            />
            <UsageItem
              label="Reports this month"
              current={usageData.usage.reports_monthly.current}
              max={usageData.usage.reports_monthly.max}
              isUnlimited={usageData.usage.reports_monthly.is_unlimited}
              resetInfo={
                usageData.usage.reports_monthly.resets_at
                  ? `Resets ${new Date(usageData.usage.reports_monthly.resets_at).toLocaleDateString()}`
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Upgrade Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold">Available Plans</h2>
              <Badge variant="outline" className="border-neon-lime/50 bg-neon-lime/10 text-neon-lime text-[10px] uppercase tracking-widest">
                Founding Partner Pricing
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Lock in exclusive founding partner rates — honoured for the lifetime of your subscription.
            </p>
          </div>
          <Tabs value={billingInterval} onValueChange={(v) => setBillingInterval(v as BillingInterval)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">
                Annual
                <Badge variant="secondary" className="ml-2">
                  Save 2 months
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allTiers.map((tier) => (
            <TierCard
              key={tier.tier}
              tier={tier}
              billingInterval={billingInterval}
              currentTier={currentTier}
              onUpgrade={handleUpgrade}
              processing={processingCheckout}
            />
          ))}
        </div>
      </div>

      {/* Invoice History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>View and download your past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No invoices yet. Invoices will appear here after your first payment.
          </p>
          {/* TODO: Implement invoice fetching from Stripe API */}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function UsageItem({
  label,
  current,
  max,
  isUnlimited,
  resetInfo,
}: {
  label: string;
  current: number;
  max: number | null;
  isUnlimited: boolean;
  resetInfo?: string;
}) {
  const percentage = isUnlimited ? 0 : calculateUsagePercentage(current, max);
  const statusColor = getUsageStatusColor(percentage);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {current} / {isUnlimited ? "Unlimited" : max}
        </span>
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${
          statusColor === "green"
            ? "bg-green-100"
            : statusColor === "yellow"
            ? "bg-yellow-100"
            : "bg-red-100"
        }`}
      />
      {resetInfo && <p className="text-xs text-muted-foreground">{resetInfo}</p>}
      {percentage >= 80 && !isUnlimited && (
        <div className="flex items-center gap-2 text-sm text-orange-600">
          <AlertCircle className="h-4 w-4" />
          <span>Approaching limit - consider upgrading</span>
        </div>
      )}
    </div>
  );
}

function TierCard({
  tier,
  billingInterval,
  currentTier,
  onUpgrade,
  processing,
}: {
  tier: TierPricing;
  billingInterval: BillingInterval;
  currentTier: string;
  onUpgrade: (priceId: string, tierName: string) => void;
  processing: boolean;
}) {
  const isCurrent = tier.tier === currentTier;
  const price = billingInterval === "monthly" ? tier.monthlyPrice : tier.annualPrice;
  const priceId =
    billingInterval === "monthly" ? tier.monthlyPriceId : tier.annualPriceId;
  const savings = billingInterval === "annual" ? calculateAnnualSavings(tier.tier) : 0;

  const handleClick = () => {
    onUpgrade(priceId, tier.displayName);
  };

  return (
    <Card className={isCurrent ? "border-primary border-2" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{tier.displayName}</CardTitle>
          {isCurrent && (
            <Badge variant="default">
              <Zap className="mr-1 h-3 w-3" />
              Current
            </Badge>
          )}
        </div>
        <CardDescription className="h-12">{tier.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{formatPrice(price)}</span>
            <span className="text-muted-foreground">/{billingInterval === "monthly" ? "mo" : "yr"}</span>
          </div>
          {billingInterval === "annual" && savings > 0 && (
            <p className="text-sm text-green-600">
              <TrendingUp className="inline h-3 w-3" /> Save {formatPrice(savings)}/year
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Limits:</p>
          <ul className="text-sm space-y-1">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              {tier.limits.products} Products
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              {tier.limits.lcas} LCAs
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              {tier.limits.teamMembers} Team Members
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              {tier.limits.facilities} Facilities
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Features:</p>
          <ul className="text-sm space-y-1">
            {tier.features.slice(0, 4).map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={handleClick}
          disabled={isCurrent || processing}
          className="w-full"
          variant={isCurrent ? "outline" : "default"}
        >
          {isCurrent ? "Current Plan" : tier.tier === "seed" ? "Downgrade" : "Upgrade"}
        </Button>
      </CardContent>
    </Card>
  );
}
