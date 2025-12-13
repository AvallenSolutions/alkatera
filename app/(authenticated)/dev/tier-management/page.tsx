'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface TierLimit {
  id: string;
  tier_name: string;
  display_name: string;
  tier_level: number;
  max_products: number | null;
  max_reports_per_month: number | null;
  max_team_members: number | null;
  max_facilities: number | null;
  max_suppliers: number | null;
  max_lcas: number | null;
  max_api_calls_per_month: number | null;
  max_storage_mb: number | null;
  monthly_price_gbp: number | null;
  annual_price_gbp: number | null;
  description: string | null;
}

interface TierFeature {
  id: string;
  tier_name: string;
  feature_code: string;
  feature_name: string;
  feature_description: string | null;
  enabled: boolean;
}

export default function TierManagementPage() {
  const [tiers, setTiers] = useState<TierLimit[]>([]);
  const [features, setFeatures] = useState<TierFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tiersRes, featuresRes] = await Promise.all([
        supabase.from('subscription_tier_limits').select('*').order('tier_level'),
        supabase.from('subscription_tier_features').select('*').order('tier_name, feature_code'),
      ]);

      if (tiersRes.error) throw tiersRes.error;
      if (featuresRes.error) throw featuresRes.error;

      setTiers(tiersRes.data || []);
      setFeatures(featuresRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tier data');
    } finally {
      setLoading(false);
    }
  };

  const getFeaturesByTier = (tierName: string) => {
    return features.filter(f => f.tier_name === tierName);
  };

  const allFeatureCodes = Array.from(new Set(features.map(f => f.feature_code))).sort();

  const isFeatureEnabled = (tierName: string, featureCode: string) => {
    const feature = features.find(f => f.tier_name === tierName && f.feature_code === featureCode);
    return feature?.enabled || false;
  };

  const formatLimit = (limit: number | null) => {
    return limit === null ? 'Unlimited' : limit.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading tier management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Subscription Tier Management</h1>
        <p className="text-muted-foreground">
          Configure features and limits for each subscription tier
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="limits">Resource Limits</TabsTrigger>
          <TabsTrigger value="features">Features Comparison</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiers.map(tier => (
              <Card key={tier.id} className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{tier.display_name}</CardTitle>
                      <Badge variant="outline" className="mt-2">
                        {tier.tier_name.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tier.description && (
                    <p className="text-sm text-muted-foreground">{tier.description}</p>
                  )}

                  <div className="space-y-2 py-4 border-y">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {tier.monthly_price_gbp ? `£${tier.monthly_price_gbp}` : 'Custom'}
                      </span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Products</span>
                      <Badge variant="secondary">{formatLimit(tier.max_products)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Reports/month</span>
                      <Badge variant="secondary">{formatLimit(tier.max_reports_per_month)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Team Members</span>
                      <Badge variant="secondary">{formatLimit(tier.max_team_members)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Facilities</span>
                      <Badge variant="secondary">{formatLimit(tier.max_facilities)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">LCAs</span>
                      <Badge variant="secondary">{formatLimit(tier.max_lcas)}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-semibold mb-2">Enabled Features</p>
                    <div className="space-y-1">
                      {getFeaturesByTier(tier.tier_name)
                        .filter(f => f.enabled)
                        .map(f => (
                          <div key={f.id} className="flex items-start gap-2 text-xs">
                            <Check className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{f.feature_name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Resource Limits Tab */}
        <TabsContent value="limits" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Resource Limits by Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Resource</TableHead>
                      {tiers.map(tier => (
                        <TableHead key={tier.id} className="text-right font-semibold">
                          {tier.display_name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { key: 'max_products', label: 'Maximum Products' },
                      { key: 'max_reports_per_month', label: 'Reports per Month' },
                      { key: 'max_team_members', label: 'Team Members' },
                      { key: 'max_facilities', label: 'Facilities' },
                      { key: 'max_suppliers', label: 'Suppliers' },
                      { key: 'max_lcas', label: 'LCA Calculations' },
                      { key: 'max_api_calls_per_month', label: 'API Calls per Month' },
                      { key: 'max_storage_mb', label: 'Storage (MB)' },
                    ].map(({ key, label }) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{label}</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-right">
                            <Badge variant="outline">
                              {formatLimit((tier as Record<string, unknown>)[key] as number | null)}
                            </Badge>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-medium">Monthly Price</TableCell>
                      {tiers.map(tier => (
                        <TableCell key={tier.id} className="text-right">
                          <Badge variant="outline" className="bg-green-50 text-green-900 border-green-300">
                            {tier.monthly_price_gbp ? `£${tier.monthly_price_gbp}` : 'TBD'}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Comparison Tab */}
        <TabsContent value="features" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Features by Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold min-w-[250px]">Feature</TableHead>
                      {tiers.map(tier => (
                        <TableHead key={tier.id} className="text-center font-semibold">
                          {tier.display_name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allFeatureCodes.map(featureCode => {
                      const sampleFeature = features.find(f => f.feature_code === featureCode);
                      if (!sampleFeature) return null;

                      return (
                        <TableRow key={featureCode}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-semibold text-sm">{sampleFeature.feature_name}</p>
                              {sampleFeature.feature_description && (
                                <p className="text-xs text-muted-foreground">
                                  {sampleFeature.feature_description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          {tiers.map(tier => (
                            <TableCell key={tier.id} className="text-center">
                              {isFeatureEnabled(tier.tier_name, featureCode) ? (
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
                                    <Check className="h-4 w-4 text-green-700" />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100">
                                    <X className="h-4 w-4 text-gray-400" />
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Feature Summary */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
                {tiers.map(tier => {
                  const enabledCount = getFeaturesByTier(tier.tier_name).filter(f => f.enabled).length;
                  const totalCount = getFeaturesByTier(tier.tier_name).length;

                  return (
                    <Card key={tier.id} className="bg-muted">
                      <CardContent className="pt-6">
                        <p className="text-sm font-semibold text-muted-foreground mb-2">
                          {tier.display_name}
                        </p>
                        <div className="text-2xl font-bold">
                          {enabledCount}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            / {totalCount} features
                          </span>
                        </div>
                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-blue-400 h-2 rounded-full"
                            style={{ width: `${(enabledCount / totalCount) * 100}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Reference Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base">Quick Reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            <strong>Starter (Basic):</strong> ReCiPe 2016 methodology, ideal for small companies getting started with carbon accounting. Limited to 10 products and 5 reports per month.
          </p>
          <p className="text-muted-foreground">
            <strong>Professional (Premium):</strong> Adds EF 3.1 methodology, API access, and API support. Scales to 100 products and 50 reports per month. Perfect for growing organisations.
          </p>
          <p className="text-muted-foreground">
            <strong>Enterprise:</strong> Unlimited everything plus custom weighting sets, white-label reports, and priority support. Full API access with custom limits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
