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
  Loader2,
  MapPin,
  Package
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { toast } from 'sonner';
import QRCodeDisplay from './QRCodeDisplay';
import Link from 'next/link';

interface PassportSettings {
  hiddenSections?: string[];
}

interface PassportManagementPanelProps {
  productId: string;
  productName: string;
  initialPassportEnabled: boolean;
  initialPassportToken: string | null;
  initialViewsCount: number;
  initialLastViewedAt: string | null;
  initialPassportSettings?: Record<string, unknown>;
}

export default function PassportManagementPanel({
  productId,
  productName,
  initialPassportEnabled,
  initialPassportToken,
  initialViewsCount,
  initialLastViewedAt,
  initialPassportSettings = {},
}: PassportManagementPanelProps) {
  const [isEnabled, setIsEnabled] = useState(initialPassportEnabled);
  const [token, setToken] = useState(initialPassportToken);
  const [viewsCount, setViewsCount] = useState(initialViewsCount);
  const [lastViewedAt, setLastViewedAt] = useState(initialLastViewedAt);
  const [isLoading, setIsLoading] = useState(false);
  const [passportSettings, setPassportSettings] = useState<PassportSettings>({
    hiddenSections: (initialPassportSettings?.hiddenSections as string[]) || [],
  });

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

  const isSectionVisible = (section: string) => {
    return !passportSettings.hiddenSections?.includes(section);
  };

  const handleToggleSection = async (section: string, visible: boolean) => {
    const currentHidden = passportSettings.hiddenSections || [];
    const newHidden = visible
      ? currentHidden.filter(s => s !== section)
      : [...currentHidden, section];

    const newSettings: PassportSettings = {
      ...passportSettings,
      hiddenSections: newHidden,
    };

    setPassportSettings(newSettings);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('products')
        .update({ passport_settings: newSettings })
        .eq('id', productId);

      if (error) throw error;
      toast.success(`Section ${visible ? 'shown' : 'hidden'} on passport`);
    } catch (error: any) {
      console.error('Error updating passport settings:', error);
      toast.error('Failed to update passport settings');
      // Revert on failure
      setPassportSettings(prev => ({
        ...prev,
        hiddenSections: currentHidden,
      }));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live Product Passport</CardTitle>
              <CardDescription>
                Share environmental impact data publicly. Data displayed varies by subscription tier.
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
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm">
              <strong>Tier-based display:</strong> Seed shows GHG only, Blossom adds Water + Waste, Canopy adds Biodiversity metrics
            </AlertDescription>
          </Alert>

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

      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Passport Sections</CardTitle>
            <CardDescription>
              Choose which sections appear on your public passport. Sensitive data like ingredient origins and packaging details can be hidden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="toggle-origins" className="flex items-center gap-3 cursor-pointer">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <span className="block text-sm font-medium">Ingredient Origins</span>
                  <span className="block text-xs text-neutral-500">Show where your ingredients are sourced</span>
                </div>
              </Label>
              <Switch
                id="toggle-origins"
                checked={isSectionVisible('origins')}
                onCheckedChange={(checked) => handleToggleSection('origins', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="toggle-packaging" className="flex items-center gap-3 cursor-pointer">
                <div className="p-1.5 bg-emerald-50 rounded-lg">
                  <Package className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <span className="block text-sm font-medium">Packaging &amp; Circularity</span>
                  <span className="block text-xs text-neutral-500">Show packaging sustainability data</span>
                </div>
              </Label>
              <Switch
                id="toggle-packaging"
                checked={isSectionVisible('packaging')}
                onCheckedChange={(checked) => handleToggleSection('packaging', checked)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
