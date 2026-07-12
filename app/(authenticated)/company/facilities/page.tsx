'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SmartUploadButton } from '@/components/layouts/SmartUploadButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, ArrowRight } from 'lucide-react';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useSubscription } from '@/hooks/useSubscription';
import { PageLoader } from '@/components/ui/page-loader';
// Round 7 (auto-research): the add-facility wizard is an open-gated modal that
// pulls LocationPicker (Google Maps). Lazy-load it so maps leave first load.
const AddFacilityWizard = dynamic(() => import('@/components/facilities/AddFacilityWizard').then((m) => m.AddFacilityWizard), { ssr: false });

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
  const { isReadOnly } = useSubscription();

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


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleAdd = () =>
    isReadOnly ? router.push('/complete-subscription') : setWizardOpen(true);

  if (isLoading) {
    return <PageLoader message="Loading facilities..." />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div className="min-w-0">
          <Eyebrow className="mb-3">THE WORKBENCH · FACILITIES</Eyebrow>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
            The facilities.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Track emissions from your operational facilities
          </p>
        </div>
        <div className="flex shrink-0 items-end gap-8 pb-1">
          <BigNumber size="display" value={facilities.length} label="Facilities" />
          <div className="flex items-center gap-2">
            <SmartUploadButton />
            <Button
              onClick={handleAdd}
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              {isReadOnly ? 'Subscribe to add' : 'Add facility'}
            </Button>
          </div>
        </div>
      </header>

      {facilities.length === 0 ? (
        <div className="border-t border-studio-hairline pt-8">
          <p className="max-w-md text-sm text-muted-foreground">
            No facilities yet. Your sites are where Scope 1 and 2 measurement starts:
            add a brewery, distillery or warehouse to begin.
          </p>
          <PillButton className="mt-4" onClick={handleAdd}>
            {isReadOnly ? 'Subscribe to add' : 'Add a facility'}
          </PillButton>
        </div>
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
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((facility) => (
                <TableRow
                  key={facility.id}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/company/facilities/${facility.id}`)}
                >
                  <TableCell className="font-medium">{facility.name}</TableCell>
                  <TableCell>
                    {facility.functions && facility.functions.length > 0 ? (
                      <span className="text-sm text-muted-foreground">
                        {facility.functions.slice(0, 2).join(' · ')}
                        {facility.functions.length > 2 && ` · +${facility.functions.length - 2}`}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {facility.address_city && facility.address_country ? (
                      <>{facility.address_city}, {facility.address_country}</>
                    ) : (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StateChip>
                      {facility.operational_control === 'owned' ? 'Owned' : 'Third party'}
                    </StateChip>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(facility.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ArrowRight
                      className="ml-auto h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-room-accent"
                      aria-hidden="true"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {currentOrganization && (
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
      )}
    </div>
  );
}
