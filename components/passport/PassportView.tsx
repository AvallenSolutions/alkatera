"use client";

import { useEffect, useMemo } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { transformToLCAData } from '@/lib/utils/passport-data-transformer';
import type { SubscriptionTier } from '@/lib/types/passport';
import LCAPassportTemplate from './LCAPassportTemplate';

interface PassportViewProps {
  data: {
    product: {
      id: string;
      name: string;
      product_description?: string | null;
      image_url?: string | null;
      functional_unit?: string | null;
      unit_size_value?: number | null;
      unit_size_unit?: string | null;
      certifications?: Array<{ name: string }> | null;
      created_at: string;
      updated_at: string;
      organization?: Array<{
        id: string;
        name: string;
        logo_url?: string | null;
        subscription_tier?: SubscriptionTier;
        subscription_status?: string;
      }> | {
        id: string;
        name: string;
        logo_url?: string | null;
        subscription_tier?: SubscriptionTier;
        subscription_status?: string;
      };
    };
    lca: {
      id?: string;
      aggregated_impacts?: {
        climate_change_gwp100?: number;
        water_consumption?: number;
        waste?: number;
        land_use?: number;
        breakdown?: {
          by_category?: {
            materials?: number;
            packaging?: number;
            transport?: number;
            production?: number;
          };
        };
      };
      methodology?: string;
      updated_at?: string;
    } | null;
    materials: Array<{
      name?: string;
      material_type?: string;
      quantity?: number;
    }>;
  };
  token: string;
}

export default function PassportView({ data, token }: PassportViewProps) {
  const { product, lca, materials } = data;

  const organization = Array.isArray(product.organization)
    ? product.organization[0]
    : product.organization;

  const tier = organization?.subscription_tier || 'seed';
  const subscriptionStatus = organization?.subscription_status || 'active';

  useEffect(() => {
    const recordView = async () => {
      const supabase = getSupabaseBrowserClient();

      try {
        await supabase.rpc('record_passport_view', {
          p_token: token,
          p_user_agent: navigator.userAgent,
          p_referer: document.referrer || null,
        });
      } catch (error) {
        console.error('Failed to record passport view:', error);
      }
    };

    recordView();
  }, [token]);

  const isSubscriptionActive = ['active', 'trial', 'trialing'].includes(
    subscriptionStatus
  );
  const effectiveTier: SubscriptionTier = isSubscriptionActive ? tier : 'seed';

  const lcaData = useMemo(() => {
    const normalizedOrganization = organization
      ? {
          id: organization.id,
          name: organization.name,
          logo_url: organization.logo_url || null,
          subscription_tier: organization.subscription_tier,
          subscription_status: organization.subscription_status,
        }
      : null;

    return transformToLCAData(
      {
        product: {
          id: product.id,
          name: product.name,
          product_description: product.product_description,
          image_url: product.image_url,
          functional_unit: product.functional_unit,
          unit_size_value: product.unit_size_value,
          unit_size_unit: product.unit_size_unit,
          certifications: product.certifications,
          created_at: product.created_at,
          updated_at: product.updated_at,
        },
        lca,
        materials,
        organization: normalizedOrganization,
        token,
      },
      effectiveTier
    );
  }, [product, lca, materials, organization, effectiveTier, token]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} - Product Passport`,
          text: `View the environmental impact data for ${product.name}`,
          url: window.location.href,
        });
      } catch {
        navigator.clipboard?.writeText(window.location.href);
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  };

  return (
    <LCAPassportTemplate
      data={lcaData}
      tier={effectiveTier}
      onDownloadPDF={handleDownloadPDF}
      onShare={handleShare}
    />
  );
}
