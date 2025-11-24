'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { AddFacilityWizard } from '@/components/facilities/AddFacilityWizard';

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


  if (isLoading) {
    return <PageLoader message="Loading facilities..." />;
  }

  const getCountryFlag = (countryCode: string): string => {
    const flagMap: Record<string, string> = {
      'GB': '🇬🇧',
      'UK': '🇬🇧',
      'United Kingdom': '🇬🇧',
      'US': '🇺🇸',
      'USA': '🇺🇸',
      'United States': '🇺🇸',
      'DE': '🇩🇪',
      'Germany': '🇩🇪',
      'FR': '🇫🇷',
      'France': '🇫🇷',
      'ES': '🇪🇸',
      'Spain': '🇪🇸',
      'IT': '🇮🇹',
      'Italy': '🇮🇹',
      'NL': '🇳🇱',
      'Netherlands': '🇳🇱',
      'IE': '🇮🇪',
      'Ireland': '🇮🇪',
    };
    return flagMap[countryCode] || '🏢';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage your facilities and track utility meter readings
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
              Add your facilities and track utility meter readings to automatically calculate operational emissions
            </p>
            <Button onClick={() => setWizardOpen(true)} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Add Your First Facility
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {facilities.map((facility) => (
            <Card
              key={facility.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/operations/${facility.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{facility.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {facility.address_city && facility.address_country ? (
                        <span className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {facility.address_city}, {facility.address_country}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">Location not specified</span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  >
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-8">
                    <span className="text-6xl">
                      {getCountryFlag(facility.address_country)}
                    </span>
                  </div>

                  {facility.functions && facility.functions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {facility.functions.slice(0, 3).map((func: string) => (
                        <Badge key={func} variant="outline" className="text-xs">
                          {func}
                        </Badge>
                      ))}
                      {facility.functions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{facility.functions.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/operations/${facility.id}`);
                    }}
                  >
                    View Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
