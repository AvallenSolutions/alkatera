'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UniversalDropzone } from '@/components/layouts/UniversalDropzone';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { PageLoader } from '@/components/ui/page-loader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MoreVertical, Trash2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
// Round 8 (auto-research): these panels render only when suppliers exist; defer them.
const SuppliersByEmissions = dynamic(() => import('@/components/suppliers/SuppliersByEmissions').then((m) => m.SuppliersByEmissions), { ssr: false });
const SupplierTieringPanel = dynamic(() => import('@/components/suppliers/SupplierTieringPanel').then((m) => m.SupplierTieringPanel), { ssr: false });
import { useSupplierPermissions } from '@/hooks/useSupplierPermissions';
import { useSupplierLimit } from '@/hooks/useSubscription';
// Round 8 (auto-research): open-gated modal; defer it out of first load.
const SendEsgSurveyDialog = dynamic(() => import('@/components/suppliers/SendEsgSurveyDialog').then((m) => m.SendEsgSurveyDialog), { ssr: false });
import { DirectoryListItem } from '@/components/suppliers/DirectoryListItem';
import { SupplierPreview } from '@/components/suppliers/SupplierPreview';
import { InviteForm } from '@/components/suppliers/InviteForm';
import { FilterChips } from '@/components/suppliers/FilterChips';
import type { PlatformSupplier } from '@/components/suppliers/directory-types';
import { toast } from 'sonner';

interface OrganizationSupplier {
  id: string;
  platform_supplier_id: string;
  supplier_name: string;
  website: string | null;
  contact_email: string | null;
  contact_name: string | null;
  industry_sector: string | null;
  country: string | null;
  description: string | null;
  logo_url: string | null;
  is_verified: boolean;
  annual_spend: number | null;
  spend_currency: string | null;
  engagement_status: string;
  notes: string | null;
  added_at: string;
  _enriched?: {
    name: string | null;
    logo_url: string | null;
    description: string | null;
    country: string | null;
    industry_sector: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    supplier_id: string;
  };
  _productCount?: number;
}

export default function SuppliersPage() {
  const { currentOrganization } = useOrganization();
  const { canInviteSuppliers, canCreateSuppliers, canDeleteSuppliers } = useSupplierPermissions();
  const searchParams = useSearchParams();
  const [suppliers, setSuppliers] = useState<OrganizationSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ESG survey dialog state
  const [esgSurveyOpen, setEsgSurveyOpen] = useState(false);

  // Directory sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [platformSuppliers, setPlatformSuppliers] = useState<PlatformSupplier[]>([]);
  const [loadingPlatform, setLoadingPlatform] = useState(false);
  const [platformSearchQuery, setPlatformSearchQuery] = useState('');
  const [previewSupplier, setPreviewSupplier] = useState<PlatformSupplier | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);

  // Invite flow (inside sheet)
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteContactName, setInviteContactName] = useState('');
  const [inviteCompanyName, setInviteCompanyName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<OrganizationSupplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { currentCount, maxCount, isUnlimited, checkLimit } = useSupplierLimit();
  const atLimit = !isUnlimited && maxCount != null && currentCount >= maxCount;
  const canAddOrInvite = canCreateSuppliers || canInviteSuppliers;

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSuppliers();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  // Keep the directory ready so the sheet opens instantly.
  useEffect(() => {
    if (currentOrganization?.id) {
      fetchPlatformSuppliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, suppliers.length]);

  // ?invite=1 (from the command palette, quick actions and Rosa) opens the
  // directory sheet on arrival: the one door in, wherever it is reached from.
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (searchParams?.get('invite') === '1' && currentOrganization?.id && canAddOrInvite && !autoOpened) {
      handleOpenSheet();
      setAutoOpened(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentOrganization?.id, canAddOrInvite, autoOpened]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_suppliers_view')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('added_at', { ascending: false });

      if (error) throw error;

      const viewSuppliers = (data || []) as OrganizationSupplier[];

      const emails = viewSuppliers
        .map(s => s.contact_email)
        .filter((e): e is string => !!e);

      if (emails.length > 0) {
        try {
          const browserClient = getSupabaseBrowserClient();
          const { data: sessionData } = await browserClient.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (token) {
            const res = await fetch('/api/suppliers/enrich', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ emails }),
            });

            if (res.ok) {
              const { suppliers: enrichedMap } = await res.json();

              for (const supplier of viewSuppliers) {
                if (supplier.contact_email && enrichedMap[supplier.contact_email]) {
                  const enriched = enrichedMap[supplier.contact_email];
                  supplier._enriched = {
                    name: enriched.name,
                    logo_url: enriched.logo_url,
                    description: enriched.description,
                    country: enriched.country,
                    industry_sector: enriched.industry_sector,
                    website: enriched.website,
                    address: enriched.address,
                    city: enriched.city,
                    supplier_id: enriched.supplier_id,
                  };
                  supplier._productCount = enriched.product_count;
                }
              }
            }
          }
        } catch (enrichError) {
          console.warn('Could not enrich supplier data:', enrichError);
        }
      }

      setSuppliers(viewSuppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformSuppliers = async () => {
    try {
      setLoadingPlatform(true);
      const { data, error } = await supabase
        .from('platform_suppliers')
        .select('id, name, website, industry_sector, country, description, is_verified, contact_email, created_at')
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const existingSupplierIds = suppliers.map(s => s.platform_supplier_id);
      const availableSuppliers = (data || []).filter(
        s => !existingSupplierIds.includes(s.id)
      );

      setPlatformSuppliers(availableSuppliers);
    } catch (error) {
      console.error('Error fetching platform suppliers:', error);
    } finally {
      setLoadingPlatform(false);
    }
  };

  const handleOpenSheet = () => {
    setPlatformSearchQuery('');
    setPreviewSupplier(null);
    setShowInviteForm(false);
    setInviteSuccess(false);
    setInviteError(null);
    setIndustryFilter(null);
    setCountryFilter(null);
    fetchPlatformSuppliers();
    setSheetOpen(true);
  };

  const handleQuickAdd = async (supplier: PlatformSupplier) => {
    if (atLimit) {
      toast.error('Supplier limit reached. Please upgrade your plan.');
      return;
    }

    try {
      setAddingId(supplier.id);
      const { error } = await supabase.from('organization_suppliers').insert([
        {
          organization_id: currentOrganization!.id,
          platform_supplier_id: supplier.id,
          spend_currency: 'GBP',
          engagement_status: 'active',
        },
      ]);

      if (error) throw error;

      toast.success(`${supplier.name} added to your suppliers`);
      // Remove from available list
      setPlatformSuppliers(prev => prev.filter(s => s.id !== supplier.id));
      // Clear preview if this was the previewed supplier
      if (previewSupplier?.id === supplier.id) {
        setPreviewSupplier(null);
      }
      await fetchSuppliers();
    } catch (error: any) {
      console.error('Error adding supplier:', error);
      if (error.code === '23505') {
        toast.error('This supplier is already in your organisation');
      } else {
        toast.error('Failed to add supplier');
      }
    } finally {
      setAddingId(null);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('organization_suppliers')
        .delete()
        .eq('id', supplierToDelete.id);

      if (error) throw error;

      toast.success('Supplier removed from your organisation');
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
      await fetchSuppliers();
    } catch (error) {
      console.error('Error removing supplier:', error);
      toast.error('Failed to remove supplier');
    } finally {
      setDeleting(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail.trim()) {
      setInviteError('Supplier email is required');
      return;
    }

    if (!validateEmail(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }

    setInviteError(null);
    setInviteSubmitting(true);

    try {
      const limitResult = await checkLimit();
      if (!limitResult.allowed) {
        setInviteError(limitResult.reason || 'Supplier limit reached. Please upgrade your plan.');
        setInviteSubmitting(false);
        return;
      }

      const browserClient = getSupabaseBrowserClient();
      const { data: { session } } = await browserClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/invite-supplier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          supplierEmail: inviteEmail.toLowerCase().trim(),
          contactPersonName: inviteContactName.trim() || undefined,
          supplierName: inviteCompanyName.trim() || undefined,
          personalMessage: inviteMessage.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      setInviteSuccess(true);
      toast.success('Invitation sent successfully');
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      setInviteError(err.message || 'Failed to send invitation. Please try again.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const openInviteForm = () => {
    setShowInviteForm(true);
    setPreviewSupplier(null);
    setInviteEmail('');
    setInviteContactName('');
    setInviteCompanyName('');
    setInviteMessage('');
    setInviteSuccess(false);
    setInviteError(null);
  };

  const closeInviteForm = () => {
    setShowInviteForm(false);
    setInviteSuccess(false);
    setInviteError(null);
  };

  const resetInviteForm = () => {
    closeInviteForm();
    setInviteEmail('');
    setInviteContactName('');
    setInviteCompanyName('');
    setInviteMessage('');
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = supplier._enriched?.name || supplier.supplier_name;
    const country = supplier._enriched?.country || supplier.country;
    const city = supplier._enriched?.city;
    const sector = supplier._enriched?.industry_sector || supplier.industry_sector;
    return (
      name.toLowerCase().includes(query) ||
      country?.toLowerCase().includes(query) ||
      city?.toLowerCase().includes(query) ||
      sector?.toLowerCase().includes(query)
    );
  });

  // Extract unique filter values from platform suppliers
  const availableIndustries = useMemo(() => {
    const industries = platformSuppliers
      .map(s => s.industry_sector)
      .filter((v): v is string => !!v);
    return Array.from(new Set(industries)).sort();
  }, [platformSuppliers]);

  const availableCountries = useMemo(() => {
    const countries = platformSuppliers
      .map(s => s.country)
      .filter((v): v is string => !!v);
    return Array.from(new Set(countries)).sort();
  }, [platformSuppliers]);

  const filteredPlatformSuppliers = useMemo(() => {
    return platformSuppliers.filter((supplier) => {
      if (platformSearchQuery) {
        const query = platformSearchQuery.toLowerCase();
        const matchesText =
          supplier.name.toLowerCase().includes(query) ||
          supplier.country?.toLowerCase().includes(query) ||
          supplier.industry_sector?.toLowerCase().includes(query);
        if (!matchesText) return false;
      }
      if (industryFilter && supplier.industry_sector !== industryFilter) return false;
      if (countryFilter && supplier.country !== countryFilter) return false;
      return true;
    });
  }, [platformSuppliers, platformSearchQuery, industryFilter, countryFilter]);

  if (loading) {
    return <PageLoader message="Loading suppliers..." />;
  }

  const hasSuppliers = suppliers.length > 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── The statement ── */}
      <Statement eyebrow="THE NETWORK · SUPPLIERS" headline="The suppliers.">
        <BigNumber size="display" tone="room" value={suppliers.length} label="Suppliers" />
        {canAddOrInvite && (
          <div className="flex items-center gap-2">
            <PillButton variant="outline" onClick={() => setEsgSurveyOpen(true)}>
              Send ESG survey
            </PillButton>
            <PillButton variant="room" onClick={handleOpenSheet}>
              Find or invite
            </PillButton>
          </div>
        )}
      </Statement>

      {/* ── The chain: your suppliers ── */}
      {hasSuppliers ? (
        <section className="space-y-4">
          <Eyebrow tone="dim">THE CHAIN</Eyebrow>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search your suppliers by name, country, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No suppliers match &ldquo;{searchQuery}&rdquo;. Try a different search.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSuppliers.map((supplier) => {
                const name = supplier._enriched?.name || supplier.supplier_name;
                const logo = supplier._enriched?.logo_url || supplier.logo_url;
                const location =
                  [supplier._enriched?.city, supplier._enriched?.country || supplier.country]
                    .filter(Boolean)
                    .join(', ') || 'Location not set';
                return (
                  <div key={supplier.id} className="group relative">
                    {canDeleteSuppliers && (
                      <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 border border-studio-hairline bg-studio-cream"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-studio-stale focus:text-studio-stale"
                              onClick={() => {
                                setSupplierToDelete(supplier);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove supplier
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="block rounded-[6px] border border-studio-hairline bg-studio-cream p-4 transition-colors duration-150 ease-studio hover:border-room-accent"
                    >
                      {logo ? (
                        <div className="mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-[4px] bg-studio-paper">
                          <Image
                            src={logo}
                            alt={`${name} logo`}
                            width={200}
                            height={112}
                            className="max-h-full max-w-full object-contain p-3"
                          />
                        </div>
                      ) : (
                        <div className="mb-4 flex aspect-video items-center justify-center rounded-[4px] border border-studio-hairline bg-studio-paper">
                          <span className="font-display text-3xl font-bold text-muted-foreground/40">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      <h3 className="line-clamp-2 font-display text-[15px] font-semibold text-foreground">
                        {name}
                      </h3>
                      <p className="mt-1 line-clamp-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {location}
                      </p>

                      <div className="mt-4 flex items-center justify-between border-t border-studio-hairline pt-3">
                        {supplier.is_verified ? (
                          <StateChip tone="good">Verified</StateChip>
                        ) : (
                          <StateChip tone="quiet">Not yet verified</StateChip>
                        )}
                        {supplier._productCount != null && (
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            {supplier._productCount} {supplier._productCount === 1 ? 'product' : 'products'}
                          </span>
                        )}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4 py-2">
          <p className="max-w-md text-sm text-muted-foreground">
            No suppliers yet. Your suppliers carry your Scope 3 emissions, find them in the verified
            directory or invite them to join.
          </p>
          {canAddOrInvite && (
            <PillButton variant="room" onClick={handleOpenSheet}>
              Find or invite a supplier
            </PillButton>
          )}
        </section>
      )}

      {/* ── By emissions ── */}
      {hasSuppliers && currentOrganization?.id && (
        <section className="space-y-4">
          <Eyebrow tone="dim">BY EMISSIONS</Eyebrow>
          <SuppliersByEmissions organizationId={currentOrganization.id} />
        </section>
      )}

      {/* ── Tiering ── */}
      {hasSuppliers && currentOrganization?.id && (
        <section className="space-y-4">
          <Eyebrow tone="dim">TIERING</Eyebrow>
          <SupplierTieringPanel organizationId={currentOrganization.id} />
        </section>
      )}

      {/* ── Send ESG Survey Dialog ── */}
      <SendEsgSurveyDialog
        open={esgSurveyOpen}
        onOpenChange={setEsgSurveyOpen}
        onSent={fetchSuppliers}
      />

      {/* ── The directory sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-4xl">
          <SheetHeader className="shrink-0 border-b border-studio-hairline px-6 pb-4 pt-6">
            <SheetTitle className="font-display">Supplier directory</SheetTitle>
            <SheetDescription>
              Search verified suppliers and add them to your supply chain.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1">
            {/* Left panel: search + list */}
            <div className="flex min-h-0 flex-1 flex-col border-r border-studio-hairline">
              <div className="shrink-0 space-y-3 px-4 pb-3 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by name, country, or industry..."
                    value={platformSearchQuery}
                    onChange={(e) => setPlatformSearchQuery(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>

                <FilterChips
                  availableIndustries={availableIndustries}
                  availableCountries={availableCountries}
                  industryFilter={industryFilter}
                  countryFilter={countryFilter}
                  onIndustry={setIndustryFilter}
                  onCountry={setCountryFilter}
                  onClear={() => {
                    setIndustryFilter(null);
                    setCountryFilter(null);
                  }}
                />
              </div>

              <div className="shrink-0 px-4 pb-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {loadingPlatform
                    ? 'Loading'
                    : `${filteredPlatformSuppliers.length} verified supplier${filteredPlatformSuppliers.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="px-4 pb-4">
                  {loadingPlatform ? (
                    <div className="space-y-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-[6px]" />
                      ))}
                    </div>
                  ) : filteredPlatformSuppliers.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      {platformSearchQuery || industryFilter || countryFilter ? (
                        <>
                          <p className="text-sm">No suppliers match your search.</p>
                          <p className="mt-1 text-xs">Try different terms or clear your filters.</p>
                        </>
                      ) : (
                        <p className="text-sm">All available suppliers have been added.</p>
                      )}
                    </div>
                  ) : (
                    filteredPlatformSuppliers.map((supplier) => (
                      <DirectoryListItem
                        key={supplier.id}
                        supplier={supplier}
                        selected={previewSupplier?.id === supplier.id}
                        onSelect={(s) => {
                          setPreviewSupplier(s);
                          setShowInviteForm(false);
                        }}
                      />
                    ))
                  )}
                </div>

                {/* Quiet rows: invite, and smart upload (the one door owns discovery) */}
                {!loadingPlatform && (
                  <div className="mx-4 mb-4 border-t border-studio-hairline pt-2">
                    {canAddOrInvite && (
                      <button
                        type="button"
                        onClick={openInviteForm}
                        className="flex w-full items-center gap-3 rounded-[4px] px-3 py-2.5 text-left transition-colors duration-150 ease-studio hover:bg-studio-ink/5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            Can&apos;t find your supplier?
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Invite them to join the platform for free.
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    )}
                    <UniversalDropzone
                      trigger={
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-[4px] px-3 py-2.5 text-left transition-colors duration-150 ease-studio hover:bg-studio-ink/5"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              Smart upload
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Drop a supplier list or invoice in, we read it for you.
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      }
                    />
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right panel: preview / invite */}
            <div className="hidden min-h-0 w-[380px] flex-col p-6 lg:flex">
              {showInviteForm ? (
                <InviteForm
                  email={inviteEmail}
                  contactName={inviteContactName}
                  companyName={inviteCompanyName}
                  message={inviteMessage}
                  onEmailChange={setInviteEmail}
                  onContactNameChange={setInviteContactName}
                  onCompanyNameChange={setInviteCompanyName}
                  onMessageChange={setInviteMessage}
                  submitting={inviteSubmitting}
                  success={inviteSuccess}
                  error={inviteError}
                  atLimit={atLimit}
                  onSubmit={handleSendInvitation}
                  onBack={closeInviteForm}
                  onReset={resetInviteForm}
                />
              ) : previewSupplier ? (
                <SupplierPreview
                  supplier={previewSupplier}
                  canCreate={canCreateSuppliers}
                  adding={addingId === previewSupplier.id}
                  atLimit={atLimit}
                  currentCount={currentCount}
                  maxCount={maxCount}
                  onAdd={handleQuickAdd}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <p className="text-sm font-medium text-foreground">Select a supplier</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick one to preview their details and add them to your supply chain.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: quick add bar when a supplier is selected */}
          {previewSupplier && !showInviteForm && (
            <div className="shrink-0 border-t border-studio-hairline px-6 py-4 lg:hidden">
              <div className="mb-2 flex items-center justify-between">
                <p className="truncate text-sm font-medium text-foreground">{previewSupplier.name}</p>
                <button
                  type="button"
                  onClick={() => setPreviewSupplier(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              {canCreateSuppliers && (
                <PillButton
                  variant="room"
                  className="w-full"
                  disabled={addingId === previewSupplier.id || atLimit}
                  onClick={() => handleQuickAdd(previewSupplier)}
                >
                  {addingId === previewSupplier.id ? 'Adding…' : 'Add to my suppliers'}
                </PillButton>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Remove confirmation ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{supplierToDelete?.supplier_name}</strong> from your organisation? This
              does not delete them from the platform directory, and you can add them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplier}
              disabled={deleting}
              className="bg-studio-stale text-studio-cream hover:bg-studio-stale/90"
            >
              {deleting ? 'Removing…' : 'Remove supplier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
