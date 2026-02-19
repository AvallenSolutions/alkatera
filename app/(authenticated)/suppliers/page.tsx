'use client';

import { useState, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
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
  Leaf,
  Mail,
  Info,
} from 'lucide-react';
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
  is_verified: boolean;
  annual_spend: number | null;
  spend_currency: string | null;
  engagement_status: string;
  notes: string | null;
  added_at: string;
}

interface PlatformSupplier {
  id: string;
  name: string;
  website: string | null;
  industry_sector: string | null;
  country: string | null;
  description: string | null;
  is_verified: boolean;
}

export default function SuppliersPage() {
  const { currentOrganization } = useOrganization();
  const { canCreateSuppliers, canDeleteSuppliers } = useSupplierPermissions();
  const [suppliers, setSuppliers] = useState<OrganizationSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [platformSuppliers, setPlatformSuppliers] = useState<PlatformSupplier[]>([]);
  const [loadingPlatform, setLoadingPlatform] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [annualSpend, setAnnualSpend] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<OrganizationSupplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Invite supplier flow state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteContactName, setInviteContactName] = useState('');
  const [inviteCompanyName, setInviteCompanyName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const { currentCount, maxCount, isUnlimited, checkLimit } = useSupplierLimit();
  const atLimit = !isUnlimited && maxCount != null && currentCount >= maxCount;

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSuppliers();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_suppliers_view')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('added_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
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
        .select('id, name, website, industry_sector, country, description, is_verified')
        .order('name');

      if (error) throw error;

      // Filter out suppliers already added to this organization
      const existingSupplierIds = suppliers.map(s => s.platform_supplier_id);
      const availableSuppliers = (data || []).filter(
        s => !existingSupplierIds.includes(s.id)
      );

      setPlatformSuppliers(availableSuppliers);
    } catch (error) {
      console.error('Error fetching platform suppliers:', error);
      toast.error('Failed to load available suppliers');
    } finally {
      setLoadingPlatform(false);
    }
  };

  const handleOpenAddDialog = () => {
    setSelectedSupplier('');
    setAnnualSpend('');
    setSupplierNotes('');
    fetchPlatformSuppliers();
    setAddDialogOpen(true);
  };

  const handleAddSupplier = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }

    try {
      setAdding(true);
      const { error } = await supabase.from('organization_suppliers').insert([
        {
          organization_id: currentOrganization!.id,
          platform_supplier_id: selectedSupplier,
          annual_spend: annualSpend ? parseFloat(annualSpend) : null,
          spend_currency: 'GBP',
          engagement_status: 'active',
          notes: supplierNotes || null,
        },
      ]);

      if (error) throw error;

      toast.success('Supplier added successfully');
      setAddDialogOpen(false);
      await fetchSuppliers();
    } catch (error: any) {
      console.error('Error adding supplier:', error);
      if (error.code === '23505') {
        toast.error('This supplier is already added to your organization');
      } else {
        toast.error('Failed to add supplier');
      }
    } finally {
      setAdding(false);
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

      toast.success('Supplier removed from your organization');
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

  // Invite supplier flow
  const handleOpenInviteDialog = () => {
    setInviteEmail('');
    setInviteContactName('');
    setInviteCompanyName('');
    setInviteMessage('');
    setInviteSuccess(false);
    setInviteError(null);
    setInviteDialogOpen(true);
  };

  const handleCloseInviteDialog = () => {
    setInviteDialogOpen(false);
    setInviteSuccess(false);
    setInviteError(null);
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
      // Server-side limit check
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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/invite-supplier`,
        {
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
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      setInviteSuccess(true);
      toast.success('Invitation sent successfully');
      setTimeout(() => {
        handleCloseInviteDialog();
      }, 2000);
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      setInviteError(err.message || 'Failed to send invitation. Please try again.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (!amount) return 'Not specified';
    const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
    return `${currencySymbol}${amount.toLocaleString()}`;
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
    return (
      supplier.supplier_name.toLowerCase().includes(query) ||
      supplier.country?.toLowerCase().includes(query) ||
      supplier.industry_sector?.toLowerCase().includes(query)
    );
  });

  const filteredPlatformSuppliers = platformSuppliers.filter((supplier) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.country?.toLowerCase().includes(query) ||
      supplier.industry_sector?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <PageLoader message="Loading suppliers..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Suppliers</h1>
          <p className="text-muted-foreground mt-2">
            Manage your supply chain and track supplier relationships
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canCreateSuppliers ? (
            <>
              <Button variant="outline" size="lg" onClick={handleOpenInviteDialog}>
                <Mail className="h-5 w-5 mr-2" />
                Invite Supplier
              </Button>
              <Button size="lg" onClick={handleOpenAddDialog}>
                <Plus className="h-5 w-5 mr-2" />
                Add Supplier
              </Button>
            </>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="lg" disabled>
                    <Lock className="h-5 w-5 mr-2" />
                    Add Supplier
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Only administrators can add suppliers</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Supplier Invitation Explainer */}
      {suppliers.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300">Invite suppliers to share verified data</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send email invitations to your suppliers asking them to join alkatera and provide verified sustainability data
              for specific ingredients or packaging materials. Supplier accounts are completely free, and you&apos;ll be notified when they accept.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      {suppliers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search suppliers by name, country, or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Suppliers Grid */}
      {suppliers.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <Leaf className="h-7 w-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Map Your Supply Chain</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Your suppliers contribute to your Scope 3 emissions. Adding them here lets you track supply chain impact and even invite them to share their own data.
            </p>
            <Button onClick={handleOpenAddDialog} size="lg" className="gap-2 bg-neon-lime text-black hover:bg-neon-lime/90">
              <Plus className="h-5 w-5" />
              Add Your First Supplier
            </Button>
          </CardContent>
        </Card>
      ) : filteredSuppliers.length === 0 ? (
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
                  <div className="mb-4 aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="line-clamp-1">{supplier.supplier_name}</CardTitle>
                      {supplier.is_verified && (
                        <Badge variant="default" className="bg-emerald-600 text-xs">
                          <CheckCircle className="h-2.5 w-2.5 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-1">
                      {supplier.industry_sector || 'No industry specified'}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {supplier.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {supplier.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Country:
                    </span>
                    <span className="font-medium">{supplier.country || 'Not specified'}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Annual Spend:</span>
                    <span className="font-medium">
                      {formatCurrency(supplier.annual_spend, supplier.spend_currency)}
                    </span>
                  </div>

                  {supplier.website && (
                    <div className="flex items-center text-sm text-blue-600 hover:text-blue-700">
                      <Globe className="h-3.5 w-3.5 mr-1" />
                      <span className="truncate">Website</span>
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

      {/* Add Supplier Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Supplier from Directory</DialogTitle>
            <DialogDescription>
              Select a supplier from our verified directory to add to your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Supplier</Label>
              {loadingPlatform ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : platformSuppliers.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    All available suppliers have already been added to your organization.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                  {filteredPlatformSuppliers.map((supplier) => (
                    <label
                      key={supplier.id}
                      className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${
                        selectedSupplier === supplier.id ? 'bg-slate-50 dark:bg-slate-900' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="supplier"
                        value={supplier.id}
                        checked={selectedSupplier === supplier.id}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{supplier.name}</p>
                          {supplier.is_verified && (
                            <Badge variant="default" className="bg-emerald-600 text-xs">
                              <CheckCircle className="h-2.5 w-2.5 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 space-y-1">
                          {supplier.industry_sector && (
                            <p>{supplier.industry_sector}</p>
                          )}
                          {supplier.country && (
                            <p className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {supplier.country}
                            </p>
                          )}
                          {supplier.description && (
                            <p className="line-clamp-2">{supplier.description}</p>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedSupplier && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="annual_spend">Annual Spend (Optional)</Label>
                  <Input
                    id="annual_spend"
                    type="number"
                    placeholder="e.g., 50000"
                    value={annualSpend}
                    onChange={(e) => setAnnualSpend(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this supplier relationship..."
                    value={supplierNotes}
                    onChange={(e) => setSupplierNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={handleAddSupplier} disabled={adding || !selectedSupplier}>
              {adding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Supplier'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{supplierToDelete?.supplier_name}</strong>{' '}
              from your organization? This will not delete the supplier from the platform
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

      {/* Invite Supplier Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={handleCloseInviteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invite a Supplier
            </DialogTitle>
            <DialogDescription>
              Send an email invitation to your supplier to join alkatera and share their sustainability data.
            </DialogDescription>
          </DialogHeader>

          {atLimit && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <Lock className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Supplier limit reached</p>
                <p className="text-xs text-muted-foreground">
                  You&apos;ve used {currentCount} of {maxCount} suppliers on your current plan.{' '}
                  <a href="/dashboard/settings" className="underline text-primary">Upgrade</a> to add more.
                </p>
              </div>
            </div>
          )}

          {inviteSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center gap-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Invitation Sent!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your supplier will receive an email with instructions to join the platform.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendInvitation} className="space-y-4 py-4">
              {inviteError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="invite-email">
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
                <p className="text-xs text-muted-foreground">
                  The invitation will be sent to this email address
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-contact-name">Contact Person Name (Optional)</Label>
                <Input
                  id="invite-contact-name"
                  type="text"
                  placeholder="e.g., Sarah Johnson"
                  value={inviteContactName}
                  onChange={(e) => setInviteContactName(e.target.value)}
                  disabled={inviteSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-company-name">Supplier Company Name (Optional)</Label>
                <Input
                  id="invite-company-name"
                  type="text"
                  placeholder="e.g., Acme Materials Ltd"
                  value={inviteCompanyName}
                  onChange={(e) => setInviteCompanyName(e.target.value)}
                  disabled={inviteSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-message">Personal Message (Optional)</Label>
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
                <ul className="list-disc list-inside space-y-1">
                  <li>Your supplier will receive an email invitation</li>
                  <li>A copy will be sent to you and hello@alkatera.com</li>
                  <li>They can create a free account and complete their profile</li>
                  <li>You&apos;ll be notified when they accept</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseInviteDialog}
                  disabled={inviteSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteSubmitting || atLimit}>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
