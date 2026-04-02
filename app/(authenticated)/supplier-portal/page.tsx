'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import {
  ClipboardList,
  Package,
  ArrowRight,
  Leaf,
  Sparkles,
  Shield,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useSupplierOnboarding } from '@/lib/supplier-onboarding';
import { DataCompletenessCard } from '@/components/suppliers/DataCompletenessCard';
import { SupplierActionItems } from '@/components/suppliers/SupplierActionItems';
import { SupplierActivityTimeline } from '@/components/suppliers/SupplierActivityTimeline';
import { getRatingLabel } from '@/lib/supplier-esg/scoring';
import { ESG_QUESTIONS } from '@/lib/supplier-esg/questions';

interface SupplierInfo {
  id: string;
  name: string;
  contact_email: string;
  contact_name: string | null;
  address: string | null;
  phone: string | null;
}

interface PendingRequest {
  id: string;
  material_name: string;
  material_type: string;
  organization_name?: string;
  invited_at: string;
}

interface RecentProduct {
  id: string;
  name: string;
  created_at: string;
}

interface ProductImpactSummary {
  total: number;
  withClimate: number;
  withWater: number;
  withWaste: number;
  withLand: number;
}

interface EsgStatus {
  exists: boolean;
  submitted: boolean;
  isVerified: boolean;
  completionPercent: number;
  scoreTotal: number | null;
  scoreRating: string | null;
}

export default function SupplierPortalDashboard() {
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [impactSummary, setImpactSummary] = useState<ProductImpactSummary>({
    total: 0,
    withClimate: 0,
    withWater: 0,
    withWaste: 0,
    withLand: 0,
  });
  const [esgStatus, setEsgStatus] = useState<EsgStatus>({
    exists: false,
    submitted: false,
    isVerified: false,
    completionPercent: 0,
    scoreTotal: null,
    scoreRating: null,
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { state: onboardingState, shouldShowOnboarding } = useSupplierOnboarding();

  useEffect(() => {
    async function loadData() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load supplier record (expanded fields for action items)
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('id, name, contact_email, contact_name, address, phone')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (supplierError) {
        console.error('Error loading supplier:', supplierError);
        setFetchError('Failed to load supplier data');
      } else if (supplierData) {
        setSupplier(supplierData);

        // Load products with impact data fields for completeness calculation
        const { data: products, error: productsError } = await supabase
          .from('supplier_products')
          .select('id, name, created_at, is_verified, impact_climate, impact_water, impact_waste, impact_land')
          .eq('supplier_id', supplierData.id)
          .order('created_at', { ascending: false });

        if (!productsError && products) {
          setProductsCount(products.length);
          setVerifiedCount(products.filter((p) => p.is_verified).length);
          setRecentProducts(
            products.slice(0, 5).map((p) => ({
              id: p.id,
              name: p.name,
              created_at: p.created_at,
            }))
          );

          // Calculate impact summary
          setImpactSummary({
            total: products.length,
            withClimate: products.filter((p) => p.impact_climate !== null).length,
            withWater: products.filter((p) => p.impact_water !== null).length,
            withWaste: products.filter((p) => p.impact_waste !== null).length,
            withLand: products.filter((p) => p.impact_land !== null).length,
          });
        }

        // Load ESG assessment status
        const { data: esgData, error: esgError } = await supabase
          .from('supplier_esg_assessments')
          .select('submitted, is_verified, score_total, score_rating, answers')
          .eq('supplier_id', supplierData.id)
          .maybeSingle();

        if (!esgError && esgData) {
          const answers = (esgData.answers as Record<string, unknown>) || {};
          const answeredCount = Object.keys(answers).length;
          const totalQuestions = ESG_QUESTIONS.length;
          setEsgStatus({
            exists: true,
            submitted: esgData.submitted ?? false,
            isVerified: esgData.is_verified ?? false,
            completionPercent: totalQuestions > 0 ? Math.min(Math.round((answeredCount / totalQuestions) * 100), 100) : 0,
            scoreTotal: esgData.score_total ?? null,
            scoreRating: esgData.score_rating ?? null,
          });
        }
      }

      // Use SECURITY DEFINER RPC to bypass RLS on supplier_invitations
      const { data: invitations, error: invError } = await supabase
        .rpc('get_supplier_invitations', { p_status: 'accepted' });

      if (invError) {
        console.error('Error loading invitations:', invError);
      } else if (invitations) {
        setPendingRequests(invitations.map((inv: any) => ({
          id: inv.id,
          material_name: inv.material_name,
          material_type: inv.material_type,
          organization_name: inv.organization_name,
          invited_at: inv.invited_at,
        })));
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // Determine whether any product has impact data (for action items)
  const hasAnyImpactData =
    impactSummary.withClimate > 0 ||
    impactSummary.withWater > 0 ||
    impactSummary.withWaste > 0 ||
    impactSummary.withLand > 0;

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-4 w-96 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-5 rounded-xl border border-border bg-card">
              <div className="h-10 w-10 bg-muted rounded-lg mb-3" />
              <div className="h-8 w-12 bg-muted rounded mb-1" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {fetchError && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {fetchError}
        </div>
      )}

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-serif text-foreground">
          Welcome{supplier?.contact_name ? `, ${supplier.contact_name}` : ''}
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your sustainability data and respond to data requests from your customers.
        </p>
      </div>

      {/* Quick stats - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Data Requests */}
        <Link
          href="/supplier-portal/requests"
          className="group p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors" />
          </div>
          <p className="text-2xl font-bold text-foreground">{pendingRequests.length}</p>
          <p className="text-sm text-muted-foreground">Data Requests</p>
        </Link>

        {/* Verified Products (replaced "Company Profile: 1") */}
        <Link
          href="/supplier-portal/products"
          className="group p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold text-foreground">{verifiedCount}</p>
            <p className="text-sm text-muted-foreground">/ {productsCount}</p>
          </div>
          <p className="text-sm text-muted-foreground">Verified Products</p>
          {/* Micro progress bar */}
          {productsCount > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.round((verifiedCount / productsCount) * 100)}%` }}
              />
            </div>
          )}
        </Link>

        {/* Products */}
        <Link
          href="/supplier-portal/products"
          className="group p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Package className="h-5 w-5 text-purple-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors" />
          </div>
          <p className="text-2xl font-bold text-foreground">{productsCount}</p>
          <p className="text-sm text-muted-foreground">Products</p>
        </Link>

        {/* ESG Assessment Status */}
        <Link
          href="/supplier-portal/esg-assessment"
          className="group p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              {esgStatus.isVerified ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : esgStatus.submitted ? (
                <Clock className="h-5 w-5 text-amber-400" />
              ) : (
                <Shield className="h-5 w-5 text-amber-400" />
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors" />
          </div>
          {esgStatus.isVerified ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-foreground">{esgStatus.scoreTotal ?? 'N/A'}</p>
                {esgStatus.scoreRating && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    esgStatus.scoreRating === 'leader'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : esgStatus.scoreRating === 'progressing'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                  }`}>
                    {getRatingLabel(esgStatus.scoreRating as any)}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">ESG Score</p>
            </>
          ) : esgStatus.submitted ? (
            <>
              <p className="text-2xl font-bold text-foreground">Pending</p>
              <p className="text-sm text-muted-foreground">ESG Verification</p>
            </>
          ) : esgStatus.exists ? (
            <>
              <p className="text-2xl font-bold text-foreground">{esgStatus.completionPercent}%</p>
              <p className="text-sm text-muted-foreground">ESG Assessment</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${esgStatus.completionPercent}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">Not Started</p>
              <p className="text-sm text-muted-foreground">ESG Assessment</p>
            </>
          )}
        </Link>
      </div>

      {/* Data Completeness */}
      <DataCompletenessCard summary={impactSummary} />

      {/* Dynamic Action Items */}
      <SupplierActionItems
        supplier={supplier}
        productsCount={productsCount}
        hasImpactData={hasAnyImpactData}
        hasEsgAssessment={esgStatus.exists}
        pendingRequestsCount={pendingRequests.length}
      />

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Recent Data Requests</h2>
          <div className="space-y-2">
            {pendingRequests.slice(0, 5).map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Package className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{req.material_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.material_type !== 'general' && (
                        <span className="capitalize">{req.material_type}</span>
                      )}
                      {req.material_type !== 'general' && req.organization_name && ' \u00b7 '}
                      {req.organization_name}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(req.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Timeline */}
      <SupplierActivityTimeline
        recentProducts={recentProducts}
        recentRequests={pendingRequests}
      />

      {/* Getting started / Resume Setup - shown below action items, hidden once completed */}
      {!onboardingState.completed && (
        <div className="p-6 rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/5">
          <div className="flex items-start gap-3">
            {onboardingState.dismissed ? (
              <Sparkles className="h-5 w-5 text-[#ccff00] flex-shrink-0 mt-0.5" />
            ) : (
              <Leaf className="h-5 w-5 text-[#ccff00] flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                {onboardingState.dismissed ? 'Resume Setup' : 'Getting Started'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {onboardingState.dismissed
                  ? 'You skipped the setup wizard earlier. Complete it to get the most out of your supplier portal.'
                  : 'Complete your company profile to let your customers know more about your sustainability practices. Then, add your products with verified environmental data to respond to data requests.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
