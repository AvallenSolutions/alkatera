import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import type {
  HMRCOrgDetails,
  HMRCAddress,
  HMRCContact,
  HMRCBrand,
  HMRCPartner,
  HMRCRegistrationData,
} from '@/lib/epr/types';

interface UseEPRHMRCDetailsResult {
  data: HMRCRegistrationData;
  loading: boolean;
  error: string | null;
  saveOrgDetails: (details: Partial<HMRCOrgDetails>) => Promise<void>;
  saveAddresses: (addresses: Partial<HMRCAddress>[]) => Promise<void>;
  saveContacts: (contacts: Partial<HMRCContact>[]) => Promise<void>;
  saveBrands: (brands: Pick<HMRCBrand, 'brand_name' | 'brand_type_code'>[]) => Promise<void>;
  savePartners: (partners: Pick<HMRCPartner, 'first_name' | 'last_name' | 'phone' | 'email'>[]) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const EMPTY_DATA: HMRCRegistrationData = {
  orgDetails: null,
  addresses: [],
  contacts: [],
  brands: [],
  partners: [],
};

export function useEPRHMRCDetails(): UseEPRHMRCDetailsResult {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<HMRCRegistrationData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = currentOrganization?.id;

  // Fetch all HMRC data in parallel
  const fetchAll = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ organizationId: orgId });

      const [detailsRes, brandsRes, partnersRes] = await Promise.all([
        fetch(`/api/epr/hmrc-details?${params}`),
        fetch(`/api/epr/hmrc-brands?${params}`),
        fetch(`/api/epr/hmrc-partners?${params}`),
      ]);

      // Gracefully handle missing tables (migration not yet applied)
      const detailsData = detailsRes.ok ? await detailsRes.json() : { orgDetails: null, addresses: [], contacts: [] };
      const brandsData = brandsRes.ok ? await brandsRes.json() : { brands: [] };
      const partnersData = partnersRes.ok ? await partnersRes.json() : { partners: [] };

      setData({
        orgDetails: detailsData.orgDetails || null,
        addresses: detailsData.addresses || [],
        contacts: detailsData.contacts || [],
        brands: brandsData.brands || [],
        partners: partnersData.partners || [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load HMRC data';
      console.error('Error fetching HMRC details:', err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveOrgDetails = useCallback(
    async (details: Partial<HMRCOrgDetails>) => {
      if (!orgId) return;
      try {
        const response = await fetch('/api/epr/hmrc-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, orgDetails: details }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to save organisation details');
        }
        await fetchAll();
        toast.success('Organisation details saved');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
        throw err;
      }
    },
    [orgId, fetchAll]
  );

  const saveAddresses = useCallback(
    async (addresses: Partial<HMRCAddress>[]) => {
      if (!orgId) return;
      try {
        const response = await fetch('/api/epr/hmrc-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, addresses }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to save addresses');
        }
        await fetchAll();
        toast.success('Addresses saved');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
        throw err;
      }
    },
    [orgId, fetchAll]
  );

  const saveContacts = useCallback(
    async (contacts: Partial<HMRCContact>[]) => {
      if (!orgId) return;
      try {
        const response = await fetch('/api/epr/hmrc-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, contacts }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to save contacts');
        }
        await fetchAll();
        toast.success('Contacts saved');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
        throw err;
      }
    },
    [orgId, fetchAll]
  );

  const saveBrands = useCallback(
    async (brands: Pick<HMRCBrand, 'brand_name' | 'brand_type_code'>[]) => {
      if (!orgId) return;
      try {
        const response = await fetch('/api/epr/hmrc-brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, brands }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to save brands');
        }
        const result = await response.json();
        setData(prev => ({ ...prev, brands: result.brands || [] }));
        toast.success('Brands saved');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
        throw err;
      }
    },
    [orgId]
  );

  const savePartners = useCallback(
    async (partners: Pick<HMRCPartner, 'first_name' | 'last_name' | 'phone' | 'email'>[]) => {
      if (!orgId) return;
      try {
        const response = await fetch('/api/epr/hmrc-partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, partners }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to save partners');
        }
        const result = await response.json();
        setData(prev => ({ ...prev, partners: result.partners || [] }));
        toast.success('Partners saved');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
        throw err;
      }
    },
    [orgId]
  );

  return {
    data,
    loading,
    error,
    saveOrgDetails,
    saveAddresses,
    saveContacts,
    saveBrands,
    savePartners,
    refreshAll: fetchAll,
  };
}
