'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Trash2, Plus, AlertCircle, Zap, MapPin, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { AddFacilityWizard } from '@/components/facilities/AddFacilityWizard';
import { EditFacilityDialog } from '@/components/facilities/EditFacilityDialog';
import Link from 'next/link';

interface Facility {
  id: string;
  name: string;
  functions: string[];
  operational_control: 'owned' | 'third_party';
  address_line1: string;
  address_city: string;
  address_country: string;
  created_at: string;
  updated_at: string;
}

export default function FacilitiesPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  const fetchFacilities = useCallback(async () => {
    if (!currentOrganization?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching facilities:', error);
        toast.error('Failed to load facilities');
      } else {
        setFacilities(data || []);
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
      toast.error('Failed to load facilities');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const handleEditFacility = (facilityId: string) => {
    setSelectedFacilityId(facilityId);
    setEditDialogOpen(true);
  };

  const handleDeleteFacility = async (facilityId: string, facilityName: string) => {
    if (!confirm(`Are you sure you want to delete "${facilityName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', facilityId);

      if (error) throw error;

      toast.success('Facility deleted successfully');
      await fetchFacilities();
    } catch (error: any) {
      console.error('Error deleting facility:', error);
      toast.error(error.message || 'Failed to delete facility');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return <PageLoader message="Loading facilities..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Facilities</h1>
          <p className="text-muted-foreground mt-2">
            Track emissions from your operational facilities
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Add Facility
        </Button>
      </div>

      {facilities.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Connect Your Operations</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              To ensure accuracy, Scope 1 & 2 emissions are calculated automatically from your facility utility data. Add your facilities to generate reports.
            </p>
            <Button onClick={() => setWizardOpen(true)} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Add Your First Facility
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility Name</TableHead>
                <TableHead>Functions</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((facility) => (
                <TableRow key={facility.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/company/facilities/${facility.id}`)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {facility.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {facility.functions && facility.functions.length > 0 ? (
                        facility.functions.slice(0, 2).map((func: string) => (
                          <Badge key={func} variant="secondary" className="text-xs">
                            {func}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground italic text-sm">No functions</span>
                      )}
                      {facility.functions && facility.functions.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{facility.functions.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      {facility.address_city && facility.address_country ? (
                        <>
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {facility.address_city}, {facility.address_country}
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">Not specified</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={facility.operational_control === 'owned' ? 'default' : 'secondary'}
                      className={facility.operational_control === 'owned' ? 'bg-green-600' : 'bg-blue-600'}
                    >
                      {facility.operational_control === 'owned' ? 'Owned' : 'Third-Party'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(facility.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/company/facilities/${facility.id}`);
                        }}
                        title="View facility details"
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditFacility(facility.id);
                        }}
                        title="Edit facility"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFacility(facility.id, facility.name);
                        }}
                        title="Delete facility"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {currentOrganization && (
        <>
          <AddFacilityWizard
            open={wizardOpen}
            onOpenChange={(open) => {
              setWizardOpen(open);
              if (!open) {
                fetchFacilities();
              }
            }}
            organizationId={currentOrganization.id}
          />
          <EditFacilityDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            facilityId={selectedFacilityId}
            onSuccess={() => {
              fetchFacilities();
              setSelectedFacilityId(null);
            }}
          />
        </>
      )}
    </div>
  );
}
