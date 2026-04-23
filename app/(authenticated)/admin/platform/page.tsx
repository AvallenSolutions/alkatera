"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, RefreshCw, Webhook, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";

import type {
  PlatformStats,
  FeatureAdoption,
  OrganizationInfo,
  PlatformSupplier,
  GrowthTrends,
  OnboardingAnalytics,
  PlatformInsights,
  PlatformAlerts,
} from "./types";

import { StatsOverview } from "./components/StatsOverview";
import { GrowthTrendsSection } from "./components/GrowthTrendsSection";
import { OnboardingFunnelSection } from "./components/OnboardingFunnelSection";
import { OrganizationsAndSuppliersCard } from "./components/OrganizationsAndSuppliersCard";
import { InsightsSection } from "./components/InsightsSection";
import { AlertsPanel } from "./components/AlertsPanel";
import { FeatureAdoptionCard } from "./components/FeatureAdoptionCard";

export default function PlatformDashboardPage() {
  const { isAlkateraAdmin, isLoading: authLoading } = useIsAlkateraAdmin();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [featureAdoption, setFeatureAdoption] = useState<FeatureAdoption | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [platformSuppliers, setPlatformSuppliers] = useState<PlatformSupplier[]>([]);
  const [growthTrends, setGrowthTrends] = useState<GrowthTrends | null>(null);
  const [onboardingAnalytics, setOnboardingAnalytics] = useState<OnboardingAnalytics | null>(null);
  const [insights, setInsights] = useState<PlatformInsights | null>(null);
  const [alerts, setAlerts] = useState<PlatformAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [webhookMessage, setWebhookMessage] = useState('');

  const fetchData = async () => {
    try {
      const [
        statsResult,
        adoptionResult,
        orgsResult,
        trendsResult,
        onboardingResult,
        insightsResult,
        alertsResult,
        suppliersResult,
      ] = await Promise.all([
        (supabase.rpc as any)("get_platform_statistics"),
        (supabase.rpc as any)("get_feature_adoption"),
        (supabase.rpc as any)("get_platform_organizations"),
        (supabase.rpc as any)("get_platform_growth_trends", { p_days: 90 }),
        (supabase.rpc as any)("get_onboarding_analytics"),
        (supabase.rpc as any)("get_platform_insights"),
        (supabase.rpc as any)("get_platform_alerts"),
        supabase.from("platform_suppliers").select("*").order("name"),
      ]);

      if (statsResult.data && !(statsResult.data as any).error) {
        setStats(statsResult.data);
      }
      if (adoptionResult.data && !(adoptionResult.data as any).error) {
        setFeatureAdoption(adoptionResult.data);
      }
      if (orgsResult.data && !(orgsResult.data as any).error) {
        setOrganizations(orgsResult.data || []);
      }
      if (trendsResult.data && !(trendsResult.data as any).error) {
        setGrowthTrends(trendsResult.data);
      }
      if (onboardingResult.data && !(onboardingResult.data as any).error) {
        setOnboardingAnalytics(onboardingResult.data);
      }
      if (insightsResult.data && !(insightsResult.data as any).error) {
        setInsights(insightsResult.data);
      }
      if (alertsResult.data && !(alertsResult.data as any).error) {
        setAlerts(alertsResult.data);
      }
      if (suppliersResult.data) {
        setPlatformSuppliers(suppliersResult.data);
      }
    } catch (err) {
      console.error("Error fetching platform data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAlkateraAdmin) {
      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAlkateraAdmin, authLoading]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleRegisterWebhook = async () => {
    setWebhookStatus('loading');
    setWebhookMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/slidespeak-webhook', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Registration failed');
      setWebhookStatus('success');
      setWebhookMessage(`Registered: ${json.callbackUrl}`);
    } catch (err) {
      setWebhookStatus('error');
      setWebhookMessage((err as Error).message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[420px]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This page is only accessible to Alkatera platform administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Platform Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Platform-wide analytics and metrics (no private data)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview (existing, extracted) */}
      <StatsOverview stats={stats} />

      {/* Growth Trends (Improvement 1) */}
      <GrowthTrendsSection data={growthTrends} loading={false} />

      {/* Alerts + Onboarding side by side (Improvements 2 & 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsPanel
          alerts={alerts}
          pendingApprovals={stats?.pending_approvals || null}
          verificationBacklog={stats?.verification.unverified_supplier_products || 0}
          loading={false}
        />
        <OnboardingFunnelSection data={onboardingAnalytics} loading={false} />
      </div>

      {/* Insights (Improvement 4) */}
      <InsightsSection data={insights} loading={false} />

      {/* Feature Adoption (existing, extracted) */}
      <FeatureAdoptionCard data={featureAdoption} loading={false} />

      {/* Organisations & Suppliers (Improvement 3) */}
      <OrganizationsAndSuppliersCard
        organizations={organizations}
        suppliers={platformSuppliers}
        loading={false}
        onOrganizationUpdated={fetchData}
      />

      {/* Integrations */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Integrations</h2>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">SlideSpeak Webhook</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Register alkatera as a callback recipient so SlideSpeak notifies us when PPTX reports finish generating. Run this once after each deployment.
            </p>
            {webhookMessage && (
              <p className={`text-xs mt-2 flex items-center gap-1 ${webhookStatus === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {webhookStatus === 'success'
                  ? <CheckCircle className="h-3 w-3 shrink-0" />
                  : <XCircle className="h-3 w-3 shrink-0" />}
                {webhookMessage}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegisterWebhook}
            disabled={webhookStatus === 'loading'}
          >
            <Webhook className={`h-4 w-4 mr-2 ${webhookStatus === 'loading' ? 'animate-pulse' : ''}`} />
            {webhookStatus === 'loading' ? 'Registering...' : 'Register Webhook'}
          </Button>
        </div>
      </div>
    </div>
  );
}
