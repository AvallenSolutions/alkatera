'use client';

import { useState, useEffect, useCallback } from 'react';
import { useIsAlkateraAdmin } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FlaskConical, Plug, Search, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { INTEGRATION_BETA_FEATURES, type IntegrationBetaFeature } from '@/lib/integrations/directory';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  feature_flags: Record<string, boolean> | null;
}

/** The beta features that can be toggled */
const BETA_FEATURES = [
  {
    code: 'pulse_beta',
    label: 'Pulse',
    description: 'Access to the Pulse analytics dashboard (financial, impact valuation, targets)',
  },
  {
    code: 'impact_valuation_beta',
    label: 'Impact Valuation',
    description: 'Access to the Impact Valuation module and dashboard widget',
  },
  {
    code: 'epr_beta',
    label: 'EPR Compliance',
    description: 'Access to the UK Extended Producer Responsibility compliance tools',
  },
  {
    code: 'xero_integration_beta',
    label: 'Xero Integration',
    description: 'Connect Xero accounting software for automated spend-based carbon accounting',
  },
  {
    code: 'viticulture_beta',
    label: 'Viticulture (Self-Grown)',
    description: 'Vineyard management and self-grown ingredient LCA calculations with FLAG-aligned soil carbon',
  },
  {
    code: 'arable_beta',
    label: 'Arable Fields (Grain Growing)',
    description: 'Arable field management and self-grown grain LCA calculations with FLAG v1.2 compliance, fertiliser emissions, and multi-harvest averaging',
  },
  {
    code: 'orchard_beta',
    label: 'Orchards (Fruit Growing)',
    description: 'Fruit orchard management and LCA calculations with FLAG v1.2 compliance, transport tracking, and multi-harvest averaging',
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function tierBadgeVariant(tier: string | null): 'default' | 'secondary' | 'outline' {
  switch (tier) {
    case 'canopy':
      return 'default';
    case 'blossom':
      return 'secondary';
    default:
      return 'outline';
  }
}

function statusColour(status: string | null): string {
  switch (status) {
    case 'active':
      return 'text-emerald-400';
    case 'trial':
      return 'text-blue-400';
    case 'past_due':
      return 'text-amber-400';
    case 'suspended':
    case 'cancelled':
      return 'text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function AdminBetaAccessPage() {
  const { isAlkateraAdmin, isLoading: authLoading } = useIsAlkateraAdmin();
  const { refresh: refreshSubscription } = useSubscription();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch('/api/admin/beta-access', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch organisations');
      }

      const data = await res.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      console.error('Error fetching organisations:', err);
      toast.error('Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAlkateraAdmin) {
      fetchOrganizations();
    }
  }, [isAlkateraAdmin, fetchOrganizations]);

  const handleToggle = async (orgId: string, featureCode: string, enabled: boolean) => {
    const toggleKey = `${orgId}-${featureCode}`;
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(toggleKey);
      return next;
    });

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch('/api/admin/beta-access', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: orgId,
          feature_code: featureCode,
          enabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      const data = await res.json();
      const updatedOrg = data.organization;

      // Update local state
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === updatedOrg.id
            ? { ...org, feature_flags: updatedOrg.feature_flags }
            : org
        )
      );

      const orgName = organizations.find((o) => o.id === orgId)?.name || 'Organisation';
      toast.success(
        enabled
          ? `${featureCode} enabled for ${orgName}`
          : `${featureCode} disabled for ${orgName}`
      );

      // Refresh the subscription context so the sidebar and feature gates
      // reflect the new flag immediately without requiring a page reload
      refreshSubscription();
    } catch (err) {
      console.error('Error toggling feature:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update beta access');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(toggleKey);
        return next;
      });
    }
  };

  // Filter organisations by search term
  const filtered = search.trim()
    ? organizations.filter(
        (org) =>
          org.name.toLowerCase().includes(search.toLowerCase()) ||
          org.slug?.toLowerCase().includes(search.toLowerCase())
      )
    : organizations;

  // Count orgs with any beta access (product or integration).
  const allFeatureCodes = [
    ...BETA_FEATURES.map((f) => f.code),
    ...INTEGRATION_BETA_FEATURES.map((f) => f.code),
  ];
  const betaCount = organizations.filter((org) =>
    allFeatureCodes.some((code) => org.feature_flags?.[code] === true)
  ).length;

  // ── Auth guard ──────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="container max-w-6xl py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="container max-w-6xl py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center space-y-2">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">Admin Access Required</h2>
              <p className="text-muted-foreground">
                This page is restricted to alka<strong>tera</strong> administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-neon-lime" />
          Beta Access Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Grant beta feature access to specific organisations, regardless of their subscription tier.
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardDescription>Total Organisations</CardDescription>
            <CardTitle className="text-2xl">{loading ? '—' : organizations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardDescription>With Beta Access</CardDescription>
            <CardTitle className="text-2xl text-neon-lime">{loading ? '—' : betaCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organisations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product betas */}
      <FeatureToggleTable
        title="Product betas"
        icon={<FlaskConical className="h-4 w-4 text-neon-lime" />}
        features={BETA_FEATURES.map((f) => ({ code: f.code, label: f.label, description: f.description }))}
        organizations={filtered}
        loading={loading}
        search={search}
        togglingIds={togglingIds}
        onToggle={handleToggle}
      />

      {/* Integration betas — derived from lib/integrations/directory.ts so a
          new provider entry automatically gets a column here without touching
          this file. */}
      <FeatureToggleTable
        title="Integration betas"
        icon={<Plug className="h-4 w-4 text-neon-lime" />}
        subtitle="Granting an integration flag makes that provider's card visible to the org. For providers without a built connect flow yet, the card stays as 'Coming soon' until we build it — the flag still records the org as queued."
        features={INTEGRATION_BETA_FEATURES.map((f) => ({ code: f.code, label: f.label, description: f.description }))}
        organizations={filtered}
        loading={loading}
        search={search}
        togglingIds={togglingIds}
        onToggle={handleToggle}
      />
    </div>
  );
}

// ─── Feature toggle table ──────────────────────────────────────────────────
//
// Renders a table of orgs (rows) × features (columns) with one Switch per
// cell. Used twice on this page: once for product betas, once for
// integrations. Splitting the two into separate tables keeps the column
// count manageable as the integration directory grows.

interface FeatureColumn {
  code: string;
  label: string;
  description: string;
}

interface FeatureToggleTableProps {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  features: FeatureColumn[];
  organizations: Organization[];
  loading: boolean;
  search: string;
  togglingIds: Set<string>;
  onToggle: (orgId: string, featureCode: string, enabled: boolean) => Promise<void>;
}

function FeatureToggleTable({
  title,
  icon,
  subtitle,
  features,
  organizations,
  loading,
  search,
  togglingIds,
  onToggle,
}: FeatureToggleTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Organisation</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  {features.map((feature) => (
                    <TableHead key={feature.code} className="text-center min-w-[100px]" title={feature.description}>
                      {feature.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3 + features.length} className="text-center py-8 text-muted-foreground">
                      {search ? 'No organisations match your search' : 'No organisations found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground">{org.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tierBadgeVariant(org.subscription_tier)}>
                          {org.subscription_tier || 'none'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm capitalize ${statusColour(org.subscription_status)}`}>
                          {org.subscription_status || 'unknown'}
                        </span>
                      </TableCell>
                      {features.map((feature) => {
                        const isEnabled = org.feature_flags?.[feature.code] === true;
                        const toggleKey = `${org.id}-${feature.code}`;
                        const isToggling = togglingIds.has(toggleKey);

                        return (
                          <TableCell key={feature.code} className="text-center">
                            <Switch
                              checked={isEnabled}
                              disabled={isToggling}
                              onCheckedChange={(checked) => onToggle(org.id, feature.code, checked)}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
