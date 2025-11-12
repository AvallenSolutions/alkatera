'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, MapPin } from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';
import { useFacilities } from '@/hooks/data/useFacilities';
import { AddFacilityModal } from '@/components/facilities/AddFacilityModal';

export default function FacilitiesPage() {
  const router = useRouter();
  const { facilities, isLoading } = useFacilities();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleRowClick = (facilityId: string) => {
    router.push(`/company/facilities/${facilityId}`);
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facilities Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your company and supplier facilities
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Facility
        </Button>
      </div>

      {facilities.length === 0 ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="rounded-full bg-muted p-4 inline-block">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">No facilities yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Create your first facility to start tracking emissions and activity data.
              </p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Facility
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Data Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((facility) => (
                <TableRow
                  key={facility.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(facility.id)}
                >
                  <TableCell className="font-medium">{facility.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[facility.city, facility.country].filter(Boolean).join(', ') || 'Not specified'}
                    </div>
                  </TableCell>
                  <TableCell>{facility.facility_type_name || 'Not specified'}</TableCell>
                  <TableCell>
                    {facility.data_source_type === 'internal' ? (
                      <Badge variant="default" className="bg-blue-600">
                        Owned
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Supplier</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddFacilityModal open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
