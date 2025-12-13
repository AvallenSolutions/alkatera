"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  Lock,
  Eye,
  Calendar,
  ExternalLink,
  Info,
  Sparkles,
  Crown,
  Loader2
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { toast } from 'sonner';
import QRCodeDisplay from './QRCodeDisplay';
import { FeatureGate } from '@/components/subscription';
import Link from 'next/link';

interface PassportManagementPanelProps {
  productId: string;
  productName: string;
  initialPassportEnabled: boolean;
  initialPassportToken: string | null;
  initialViewsCount: number;
  initialLastViewedAt: string | null;
}

export default function PassportManagementPanel({
  productId,
  productName,
  initialPassportEnabled,
  initialPassportToken,
  initialViewsCount,
  initialLastViewedAt,
}: PassportManagementPanelProps) {
  const [isEnabled, setIsEnabled] = useState(initialPassportEnabled);
  const [token, setToken] = useState(initialPassportToken);
  const [viewsCount, setViewsCount] = useState(initialViewsCount);
  const [lastViewedAt, setLastViewedAt] = useState(initialLastViewedAt);
  const [isLoading, setIsLoading] = useState(false);

  const passportUrl = token
    ? `${window.location.origin}/passport/${token}`
    : '';

  const handleTogglePassport = async (enabled: boolean) => {
    setIsLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (enabled) {
        const { data, error } = await supabase.rpc('enable_product_passport', {
          p_product_id: parseInt(productId),
        });

        if (error) throw error;

        if (data.success) {
          setIsEnabled(true);
          setToken(data.token);
          toast.success('Product passport enabled');
        } else {
          throw new Error(data.error || 'Failed to enable passport');
        }
      } else {
        const { data, error } = await supabase.rpc('disable_product_passport', {
          p_product_id: parseInt(productId),
        });

        if (error) throw error;

        if (data.success) {
          setIsEnabled(false);
          toast.success('Product passport disabled');
        } else {
          throw new Error(data.error || 'Failed to disable passport');
        }
      }
    } catch (error: any) {
      console.error('Error toggling passport:', error);
      toast.error(error.message || 'Failed to update passport status');
      setIsEnabled(!enabled);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('products')
        .select('passport_views_count, passport_last_viewed_at')
        .eq('id', productId)
        .maybeSingle();

      if (!error && data) {
        setViewsCount(data.passport_views_count || 0);
        setLastViewedAt(data.passport_last_viewed_at);
      }
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    }
  };

  useEffect(() => {
    if (isEnabled) {
      const interval = setInterval(refreshAnalytics, 30000);
      return () => clearInterval(interval);
    }
  }, [isEnabled]);

  return (
    <FeatureGate
      feature="live_passport"
      fallback={
        <Card className="border-amber-200 bg-gradient-to-br from-white to-amber-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              <CardTitle>Live Product Passport</CardTitle>
            </div>
            <CardDescription>
              Create public-facing product pages with environmental impact data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                Upgrade to Blossom or Canopy tier to enable Live Product Passports
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-neutral-400 mt-0.5" />
                <div>
                  <p className="font-medium text-neutral-900">Public Product Pages</p>
                  <p className="text-sm text-neutral-600">
                    Share environmental data with customers and stakeholders
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-neutral-400 mt-0.5" />
                <div>
                  <p className="font-medium text-neutral-900">QR Code Generation</p>
                  <p className="text-sm text-neutral-600">
                    Downloadable QR codes for packaging and marketing
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-neutral-400 mt-0.5" />
                <div>
                  <p className="font-medium text-neutral-900">Tier-Based Access</p>
                  <p className="text-sm text-neutral-600">
                    Display metrics based on your subscription tier
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <Link href="/settings/subscription">
              <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Access
              </Button>
            </Link>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Live Product Passport</CardTitle>
                <CardDescription>
                  Share environmental impact data publicly
                </CardDescription>
              </div>
              <Badge variant={isEnabled ? 'default' : 'secondary'} className="gap-1">
                {isEnabled ? (
                  <>
                    <Globe className="h-3 w-3" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" />
                    Private
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="passport-toggle" className="flex items-center gap-2">
                <span>Enable Product Passport</span>
              </Label>
              <Switch
                id="passport-toggle"
                checked={isEnabled}
                onCheckedChange={handleTogglePassport}
                disabled={isLoading}
              />
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating passport...</span>
              </div>
            )}

            {isEnabled && token && (
              <>
                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-neutral-500" />
                      <span className="text-sm font-medium">Total Views</span>
                    </div>
                    <span className="text-2xl font-bold text-neutral-900">
                      {viewsCount.toLocaleString()}
                    </span>
                  </div>

                  {lastViewedAt && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-neutral-500" />
                        <span className="text-sm font-medium">Last Viewed</span>
                      </div>
                      <span className="text-sm text-neutral-600">
                        {new Date(lastViewedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Link href={passportUrl} target="_blank">
                    <Button variant="outline" className="w-full" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Live Passport
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {!isEnabled && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Enable the passport to generate a public URL and QR code for this product
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {isEnabled && token && (
          <QRCodeDisplay
            url={passportUrl}
            productName={productName}
          />
        )}
      </div>
    </FeatureGate>
  );
}
