"use client";

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { toast } from 'sonner';
import QRCodeDisplay from './QRCodeDisplay';

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
  const [linkCopied, setLinkCopied] = useState(false);
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

  const handleCopyLink = async () => {
    if (!passportUrl) return;
    try {
      await navigator.clipboard.writeText(passportUrl);
      setLinkCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

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

  const formattedLastViewed = lastViewedAt
    ? new Date(lastViewedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="max-w-3xl space-y-10">
      {/* Statement */}
      <div>
        <div className="flex items-center gap-3">
          <Eyebrow>The passport</Eyebrow>
          <StateChip tone={isEnabled ? 'good' : 'quiet'}>
            {isEnabled ? 'Public' : 'Private'}
          </StateChip>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The public product passport shares this product&apos;s environmental impact with anyone who scans it.
          What appears depends on your subscription tier: Seed shows GHG only, Blossom adds water and waste,
          Canopy adds biodiversity.
        </p>
      </div>

      {/* Enable / disable */}
      <section className="border-t border-border pt-5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="passport-toggle" className="cursor-pointer">
            <span className="block text-sm font-medium text-foreground">Enable the public passport</span>
            <span className="mt-1 block max-w-xl text-sm font-normal text-muted-foreground">
              Turn this on to generate a public link and QR code for {productName}.
            </span>
          </Label>
          <Switch
            id="passport-toggle"
            checked={isEnabled}
            onCheckedChange={handleTogglePassport}
            disabled={isLoading}
          />
        </div>

        {isLoading && (
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            Updating the passport
          </div>
        )}

        {!isEnabled && !isLoading && (
          <p className="mt-3 text-sm text-studio-dim">
            The passport is private. No one can view it until you enable it.
          </p>
        )}
      </section>

      {/* Reach */}
      {isEnabled && token && (
        <section className="border-t border-border pt-5">
          <Eyebrow className="mb-4">Reach</Eyebrow>
          <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
            <BigNumber value={viewsCount.toLocaleString()} label="Total views" />
            {formattedLastViewed && (
              <div>
                <div className="font-display text-[1.15rem] font-bold leading-none tabular-nums text-foreground">
                  {formattedLastViewed}
                </div>
                <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
                  Last viewed
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Share */}
      {isEnabled && token && (
        <section className="border-t border-border pt-5">
          <Eyebrow className="mb-4">Share</Eyebrow>
          <div className="space-y-4">
            <div>
              <div className="mb-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                Public link
              </div>
              <div className="flex items-center gap-3">
                <code className="min-w-0 flex-1 select-all truncate rounded-md border border-border bg-studio-cream px-3 py-2 font-mono text-xs text-foreground">
                  {passportUrl}
                </code>
                <PillButton variant="ghost" size="sm" onClick={handleCopyLink}>
                  {linkCopied ? 'Copied' : 'Copy'}
                </PillButton>
              </div>
            </div>

            <a href={passportUrl} target="_blank" rel="noreferrer" className="inline-flex">
              <PillButton variant="room" size="sm" type="button">
                View live passport
              </PillButton>
            </a>
          </div>
        </section>
      )}

      {/* QR code (self-contained functional renderer) */}
      {isEnabled && token && (
        <section className="border-t border-border pt-5">
          <Eyebrow className="mb-4">QR code</Eyebrow>
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
            Print this on packaging, marketing materials or displays so anyone can open the passport.
          </p>
          <QRCodeDisplay url={passportUrl} productName={productName} />
        </section>
      )}

      {/* What the passport shows */}
      {isEnabled && (
        <section className="border-t border-border pt-5">
          <Eyebrow className="mb-1">What the passport shows</Eyebrow>
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
            Choose which sections appear publicly. Sensitive detail like ingredient origins and packaging can stay hidden.
          </p>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-3.5">
              <Label htmlFor="toggle-origins" className="cursor-pointer">
                <span className="block text-sm font-medium text-foreground">Ingredient origins</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Show where your ingredients are sourced
                </span>
              </Label>
              <Switch
                id="toggle-origins"
                checked={isSectionVisible('origins')}
                onCheckedChange={(checked) => handleToggleSection('origins', checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-3.5">
              <Label htmlFor="toggle-packaging" className="cursor-pointer">
                <span className="block text-sm font-medium text-foreground">Packaging &amp; circularity</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Show packaging sustainability data
                </span>
              </Label>
              <Switch
                id="toggle-packaging"
                checked={isSectionVisible('packaging')}
                onCheckedChange={(checked) => handleToggleSection('packaging', checked)}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
