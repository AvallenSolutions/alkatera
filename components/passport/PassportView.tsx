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
      product_image_url?: string | null;
      product_category?: string | null;
      functional_unit?: string | null;
      unit_size_value?: number | null;
      unit_size_unit?: string | null;
      system_boundary?: string | null;
      certifications?: Array<{ name: string }> | null;
      awards?: Array<{ name: string }> | null;
      packaging_circularity_score?: number | null;
      passport_settings?: Record<string, unknown> | null;
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
      reference_year?: number | null;
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
          by_lifecycle_stage?: {
            raw_materials?: number;
            processing?: number;
            packaging_stage?: number;
            distribution?: number;
            use_phase?: number;
            end_of_life?: number;
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
      origin_country?: string | null;
      origin_country_code?: string | null;
      is_organic_certified?: boolean | null;
      packaging_category?: string | null;
      recycled_content_percentage?: number | null;
      recyclability_score?: number | null;
      end_of_life_pathway?: string | null;
      is_reusable?: boolean | null;
      is_compostable?: boolean | null;
    }>;
    lcaCount?: number;
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
          image_url: product.product_image_url,
          product_category: product.product_category,
          functional_unit: product.functional_unit,
          unit_size_value: product.unit_size_value,
          unit_size_unit: product.unit_size_unit,
          system_boundary: product.system_boundary,
          certifications: product.certifications,
          awards: product.awards,
          packaging_circularity_score: product.packaging_circularity_score,
          created_at: product.created_at,
          updated_at: product.updated_at,
        },
        lca,
        materials,
        organization: normalizedOrganization,
        token,
        lcaCount: data.lcaCount,
      },
      effectiveTier
    );
  }, [product, lca, materials, organization, effectiveTier, token, data.lcaCount]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleShare = async () => {
    const shareText = lcaData.meta.totalCarbon > 0
      ? `${product.name} Environmental Passport - ${lcaData.meta.totalCarbon.toFixed(2)} ${lcaData.meta.carbonUnit} per ${lcaData.meta.functionalUnit}. View the full report: ${window.location.href}`
      : `View the environmental impact data for ${product.name}: ${window.location.href}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} - Product Passport`,
          text: shareText,
          url: window.location.href,
        });
      } catch {
        navigator.clipboard?.writeText(shareText);
      }
    } else {
      navigator.clipboard?.writeText(shareText);
    }
  };

  const hiddenSections = (product.passport_settings?.hiddenSections as string[]) || [];

  return (
    <LCAPassportTemplate
      data={lcaData}
      tier={effectiveTier}
      hiddenSections={hiddenSections}
      onDownloadPDF={handleDownloadPDF}
      onShare={handleShare}
    />
  );
}
