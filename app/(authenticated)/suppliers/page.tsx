'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Plus,
  Search,
  Building2,
  MapPin,
  Lock,
  MoreVertical,
  Trash2,
  Globe,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  Package,
  ArrowLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { useSupplierPermissions } from '@/hooks/useSupplierPermissions';
import { useSupplierLimit } from '@/hooks/useSubscription';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

interface PlatformSupplier {
  id: string;
  name: string;
  website: string | null;
  industry_sector: string | null;
  country: string | null;
  description: string | null;
  is_verified: boolean;
  contact_email: string | null;
  created_at: string | null;
}

export default function SuppliersPage() {
  const { currentOrganization } = useOrganization();
  const { canInviteSuppliers, canCreateSuppliers, canDeleteSuppliers } = useSupplierPermissions();
  const [suppliers, setSuppliers] = useState<OrganizationSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSuppliers();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  // Fetch platform suppliers on mount (for inline directory when empty)
  useEffect(() => {
    if (currentOrganization?.id) {
      fetchPlatformSuppliers();
    }
  }, [currentOrganization?.id, suppliers.length]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
      // Text search
      if (platformSearchQuery) {
        const query = platformSearchQuery.toLowerCase();
        const matchesText =
          supplier.name.toLowerCase().includes(query) ||
          supplier.country?.toLowerCase().includes(query) ||
          supplier.industry_sector?.toLowerCase().includes(query);
        if (!matchesText) return false;
      }
      // Industry filter
      if (industryFilter && supplier.industry_sector !== industryFilter) return false;
      // Country filter
      if (countryFilter && supplier.country !== countryFilter) return false;
      return true;
    });
  }, [platformSuppliers, platformSearchQuery, industryFilter, countryFilter]);

  if (loading) {
    return <PageLoader message="Loading suppliers..." />;
  }

  const hasSuppliers = suppliers.length > 0;

  // ── Supplier Directory List Item ──
  const DirectoryListItem = ({ supplier, compact = false }: { supplier: PlatformSupplier; compact?: boolean }) => (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        previewSupplier?.id === supplier.id
          ? 'border-emerald-500 bg-emerald-500/5'
          : 'border-transparent hover:bg-muted/50'
      }`}
      onClick={() => {
        setPreviewSupplier(supplier);
        setShowInviteForm(false);
      }}
    >
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{supplier.name}</p>
          <Badge variant="default" className="bg-emerald-600 text-[10px] px-1.5 py-0 shrink-0">
            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
            Verified
          </Badge>
        </div>
        {!compact && (
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
            {supplier.industry_sector && <span>{supplier.industry_sector}</span>}
            {supplier.country && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />
                {supplier.country}
              </span>
            )}
          </div>
        )}
      </div>
      {compact ? (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8 text-xs"
          disabled={addingId === supplier.id || atLimit}
          onClick={(e) => {
            e.stopPropagation();
            handleQuickAdd(supplier);
          }}
        >
          {addingId === supplier.id ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </>
          )}
        </Button>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </div>
  );

  // ── Supplier Preview Panel ──
  const SupplierPreview = ({ supplier }: { supplier: PlatformSupplier }) => (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-5 overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-tight">{supplier.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="bg-emerald-600 text-xs">
                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                Verified
              </Badge>
            </div>
          </div>
        </div>

        {supplier.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{supplier.description}</p>
        )}

        <div className="space-y-3">
          {supplier.industry_sector && (
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Industry:</span>
              <span className="font-medium">{supplier.industry_sector}</span>
            </div>
          )}
          {supplier.country && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Location:</span>
              <span className="font-medium">{supplier.country}</span>
            </div>
          )}
          {supplier.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Website:</span>
              <span className="font-medium text-blue-500 truncate">
                {supplier.website.replace(/^https?:\/\//, '')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 border-t mt-4">
        {canCreateSuppliers ? (
          <Button
            className="w-full bg-neon-lime text-black hover:bg-neon-lime/90"
            size="lg"
            disabled={addingId === supplier.id || atLimit}
            onClick={() => handleQuickAdd(supplier)}
          >
            {addingId === supplier.id ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to My Suppliers
              </>
            )}
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="w-full" size="lg" disabled>
                  <Lock className="h-4 w-4 mr-2" />
                  Add to My Suppliers
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Only administrators can add suppliers</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {atLimit && (
          <p className="text-xs text-destructive text-center mt-2">
            Supplier limit reached ({currentCount}/{maxCount}).{' '}
            <a href="/dashboard/settings" className="underline">Upgrade</a> to add more.
          </p>
        )}
      </div>
    </div>
  );

  // ── Inline Invite Form ──
  const InviteForm = () => (
    <div className="flex flex-col h-full">
      <button
        onClick={() => {
          setShowInviteForm(false);
          setInviteSuccess(false);
          setInviteError(null);
        }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to directory
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="font-semibold">Invite a Supplier</h3>
          <p className="text-xs text-muted-foreground">
            Send them an invitation to join the platform
          </p>
        </div>
      </div>

      {inviteSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <div className="text-center">
            <h3 className="font-semibold text-lg">Invitation Sent!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your supplier will receive an email with instructions to join.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowInviteForm(false);
              setInviteSuccess(false);
              setInviteError(null);
              setInviteEmail('');
              setInviteContactName('');
              setInviteCompanyName('');
              setInviteMessage('');
            }}
          >
            Back to directory
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSendInvitation} className="flex-1 flex flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {inviteError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs">
                Supplier Contact Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="supplier@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviteSubmitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-contact-name" className="text-xs">Contact Person Name</Label>
              <Input
                id="invite-contact-name"
                type="text"
                placeholder="e.g., Sarah Johnson"
                value={inviteContactName}
                onChange={(e) => setInviteContactName(e.target.value)}
                disabled={inviteSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-company-name" className="text-xs">Supplier Company Name</Label>
              <Input
                id="invite-company-name"
                type="text"
                placeholder="e.g., Acme Materials Ltd"
                value={inviteCompanyName}
                onChange={(e) => setInviteCompanyName(e.target.value)}
                disabled={inviteSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-message" className="text-xs">Personal Message</Label>
              <Textarea
                id="invite-message"
                placeholder="Add a personal note to your invitation..."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                disabled={inviteSubmitting}
                rows={3}
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Your supplier will receive an email invitation</li>
                <li>A copy will be sent to you and hello@alkatera.com</li>
                <li>They can create a free account and complete their profile</li>
                <li>You&apos;ll be notified when they accept</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t mt-4">
            <Button type="submit" className="w-full" disabled={inviteSubmitting || atLimit}>
              {inviteSubmitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  // ── Filter chips bar ──
  const FilterChips = () => {
    const hasFilters = industryFilter || countryFilter;
    return (
      <div className="flex flex-wrap gap-1.5">
        {hasFilters && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-destructive/10 text-xs h-6"
            onClick={() => {
              setIndustryFilter(null);
              setCountryFilter(null);
            }}
          >
            <X className="h-2.5 w-2.5 mr-1" />
            Clear
          </Badge>
        )}
        {availableIndustries.map(industry => (
          <Badge
            key={industry}
            variant={industryFilter === industry ? 'default' : 'outline'}
            className={`cursor-pointer text-xs h-6 ${
              industryFilter === industry
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'hover:bg-muted'
            }`}
            onClick={() => setIndustryFilter(industryFilter === industry ? null : industry)}
          >
            {industry}
          </Badge>
        ))}
        {availableCountries.map(country => (
          <Badge
            key={country}
            variant={countryFilter === country ? 'default' : 'outline'}
            className={`cursor-pointer text-xs h-6 ${
              countryFilter === country
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'hover:bg-muted'
            }`}
            onClick={() => setCountryFilter(countryFilter === country ? null : country)}
          >
            <MapPin className="h-2.5 w-2.5 mr-0.5" />
            {country}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Suppliers</h1>
          <p className="text-muted-foreground mt-2">
            {hasSuppliers
              ? 'Manage your supply chain and track supplier relationships'
              : 'Find and add suppliers from our verified directory'}
          </p>
        </div>
        {hasSuppliers && (
          <div className="flex items-center gap-3">
            {(canCreateSuppliers || canInviteSuppliers) ? (
              <Button size="lg" onClick={handleOpenSheet}>
                <Search className="h-5 w-5 mr-2" />
                Find or Invite Supplier
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="lg" disabled>
                      <Lock className="h-5 w-5 mr-2" />
                      Find Supplier
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Only administrators can add suppliers</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      {/* ── Empty State: Inline Directory ── */}
      {!hasSuppliers && (
        <div className="space-y-6">
          {/* Welcome + Search */}
          <Card className="border-2 border-dashed border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Building2 className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold mb-1">Find Your Suppliers</h3>
                <p className="text-muted-foreground text-sm max-w-lg">
                  Your suppliers contribute to your Scope 3 emissions. Search our verified directory
                  to find and add your suppliers, or invite them to join the platform.
                </p>
              </div>

              <div className="max-w-md mx-auto relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search suppliers by name, country, or industry..."
                  value={platformSearchQuery}
                  onChange={(e) => setPlatformSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Inline Directory Grid */}
          {loadingPlatform ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredPlatformSuppliers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                {platformSearchQuery ? (
                  <>
                    <p className="text-sm font-medium">No suppliers match &ldquo;{platformSearchQuery}&rdquo;</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Try a different search term, or invite your supplier to join
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">No suppliers available in the directory yet</p>
                )}
                {canInviteSuppliers && (
                  <Button variant="outline" size="sm" onClick={handleOpenSheet}>
                    <Mail className="h-4 w-4 mr-2" />
                    Invite a Supplier
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {platformSearchQuery
                    ? `${filteredPlatformSuppliers.length} verified supplier${filteredPlatformSuppliers.length !== 1 ? 's' : ''} found`
                    : 'Recently verified suppliers on the platform'}
                </p>
                <Button variant="ghost" size="sm" onClick={handleOpenSheet}>
                  View full directory
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlatformSuppliers.slice(0, 6).map((supplier) => (
                  <Card
                    key={supplier.id}
                    className="hover:border-emerald-500/40 transition-colors"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm truncate">{supplier.name}</CardTitle>
                            <CardDescription className="text-xs truncate">
                              {supplier.industry_sector || 'Supplier'}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-emerald-600 text-[10px] px-1.5 py-0 shrink-0">
                          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                          Verified
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {supplier.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {supplier.description}
                        </p>
                      )}
                      {supplier.country && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {supplier.country}
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="w-full bg-neon-lime text-black hover:bg-neon-lime/90"
                        disabled={addingId === supplier.id || atLimit || !canCreateSuppliers}
                        onClick={() => handleQuickAdd(supplier)}
                      >
                        {addingId === supplier.id ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Add to My Suppliers
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredPlatformSuppliers.length > 6 && (
                <div className="text-center">
                  <Button variant="outline" onClick={handleOpenSheet}>
                    <Search className="h-4 w-4 mr-2" />
                    Browse All {platformSuppliers.length} Suppliers
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Invite CTA */}
          {canInviteSuppliers && filteredPlatformSuppliers.length > 0 && (
            <Card className="bg-muted/30">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Can&apos;t find your supplier?</p>
                  <p className="text-xs text-muted-foreground">
                    Invite them to join the platform. Supplier accounts are completely free.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  handleOpenSheet();
                  // Small delay to let sheet open, then switch to invite
                  setTimeout(() => setShowInviteForm(true), 100);
                }}>
                  <Mail className="h-4 w-4 mr-2" />
                  Invite Supplier
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Existing Suppliers: Search + Grid ── */}
      {hasSuppliers && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search your suppliers by name, country, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Suppliers Grid */}
          {filteredSuppliers.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No suppliers match your search. Try adjusting your search terms.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuppliers.map((supplier) => (
                <Card
                  key={supplier.id}
                  className="h-full hover:shadow-lg transition-shadow relative group"
                >
                  {canDeleteSuppliers && (
                    <div className="absolute top-4 right-4 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 shadow-sm"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => {
                              setSupplierToDelete(supplier);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Supplier
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  <Link href={`/suppliers/${supplier.id}`}>
                    <CardHeader>
                      <div className="mb-4 aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
                        {(supplier._enriched?.logo_url || supplier.logo_url) ? (
                          <Image
                            src={supplier._enriched?.logo_url || supplier.logo_url!}
                            alt={`${supplier._enriched?.name || supplier.supplier_name} logo`}
                            fill
                            className="object-contain p-4"
                          />
                        ) : (
                          <Building2 className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="line-clamp-1">
                            {supplier._enriched?.name || supplier.supplier_name}
                          </CardTitle>
                          {supplier.is_verified && (
                            <Badge variant="default" className="bg-emerald-600 text-xs">
                              <CheckCircle className="h-2.5 w-2.5 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-1">
                          {supplier._enriched?.industry_sector || supplier.industry_sector || 'No industry specified'}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(supplier._enriched?.description || supplier.description) && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {supplier._enriched?.description || supplier.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          Location:
                        </span>
                        <span className="font-medium truncate ml-2">
                          {[
                            supplier._enriched?.city,
                            supplier._enriched?.country || supplier.country,
                          ].filter(Boolean).join(', ') || 'Not specified'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          Products:
                        </span>
                        <span className="font-medium">
                          {supplier._productCount != null ? supplier._productCount : '—'}
                        </span>
                      </div>

                      {(supplier._enriched?.website || supplier.website) && (
                        <div className="flex items-center text-sm text-blue-600 hover:text-blue-700">
                          <Globe className="h-3.5 w-3.5 mr-1" />
                          <span className="truncate">
                            {(supplier._enriched?.website || supplier.website || '').replace(/^https?:\/\//, '')}
                          </span>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        Added {formatDate(supplier.added_at)}
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}

          {/* Browse More CTA */}
          {(canCreateSuppliers || canInviteSuppliers) && platformSuppliers.length > 0 && (
            <Card className="bg-muted/30">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Add more suppliers to your supply chain</p>
                  <p className="text-xs text-muted-foreground">
                    Browse {platformSuppliers.length} verified supplier{platformSuppliers.length !== 1 ? 's' : ''} in our directory, or invite a new supplier to join
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenSheet}>
                  <Search className="h-4 w-4 mr-2" />
                  Browse Directory
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Supplier Directory Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="sm:max-w-4xl w-full p-0 flex flex-col"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle>Supplier Directory</SheetTitle>
            <SheetDescription>
              Search verified suppliers and add them to your supply chain
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 flex min-h-0">
            {/* Left Panel: Search + List */}
            <div className="flex-1 flex flex-col min-h-0 border-r">
              {/* Search */}
              <div className="px-4 pt-4 pb-3 space-y-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by name, country, or industry..."
                    value={platformSearchQuery}
                    onChange={(e) => setPlatformSearchQuery(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>

                {/* Filter chips */}
                {(availableIndustries.length > 0 || availableCountries.length > 0) && (
                  <FilterChips />
                )}
              </div>

              {/* Results header */}
              <div className="px-4 pb-2 shrink-0">
                <p className="text-xs text-muted-foreground">
                  {loadingPlatform
                    ? 'Loading...'
                    : platformSearchQuery || industryFilter || countryFilter
                      ? `${filteredPlatformSuppliers.length} supplier${filteredPlatformSuppliers.length !== 1 ? 's' : ''} found`
                      : `${filteredPlatformSuppliers.length} verified supplier${filteredPlatformSuppliers.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Supplier list */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-4 pb-4 space-y-1">
                  {loadingPlatform ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))
                  ) : filteredPlatformSuppliers.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {platformSearchQuery || industryFilter || countryFilter ? (
                        <>
                          <p className="text-sm">No suppliers match your search</p>
                          <p className="text-xs mt-1">Try different terms or clear your filters</p>
                        </>
                      ) : (
                        <p className="text-sm">All available suppliers have been added</p>
                      )}
                    </div>
                  ) : (
                    filteredPlatformSuppliers.map((supplier) => (
                      <DirectoryListItem key={supplier.id} supplier={supplier} />
                    ))
                  )}
                </div>

                {/* Invite CTA at bottom of list */}
                {!loadingPlatform && (canInviteSuppliers || canCreateSuppliers) && (
                  <div className="px-4 pb-4 pt-2 border-t mx-4">
                    <button
                      onClick={() => {
                        setShowInviteForm(true);
                        setPreviewSupplier(null);
                        setInviteEmail('');
                        setInviteContactName('');
                        setInviteCompanyName('');
                        setInviteMessage('');
                        setInviteSuccess(false);
                        setInviteError(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Mail className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Can&apos;t find your supplier?</p>
                        <p className="text-xs text-muted-foreground">
                          Invite them to join the platform for free
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                    </button>
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Panel: Preview / Invite */}
            <div className="w-[380px] hidden lg:flex flex-col p-6 min-h-0">
              {showInviteForm ? (
                <InviteForm />
              ) : previewSupplier ? (
                <SupplierPreview supplier={previewSupplier} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Select a supplier</p>
                  <p className="text-xs mt-1">
                    Click on a supplier to preview their details and add them to your supply chain
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Quick add button when supplier selected (visible on small screens) */}
          {previewSupplier && !showInviteForm && (
            <div className="lg:hidden px-6 py-4 border-t shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium truncate">{previewSupplier.name}</p>
                <button onClick={() => setPreviewSupplier(null)} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {canCreateSuppliers && (
                <Button
                  className="w-full bg-neon-lime text-black hover:bg-neon-lime/90"
                  disabled={addingId === previewSupplier.id || atLimit}
                  onClick={() => handleQuickAdd(previewSupplier)}
                >
                  {addingId === previewSupplier.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add to My Suppliers
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{supplierToDelete?.supplier_name}</strong>{' '}
              from your organisation? This will not delete the supplier from the platform
              directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplier}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Removing...' : 'Remove Supplier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
