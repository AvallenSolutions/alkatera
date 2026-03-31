'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TreePine, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface OrchardOption {
  id: string;
  name: string;
  hectares: number;
  orchard_type: string;
  certification: string;
  climate_zone: string;
  location_country_code: string | null;
}

interface OrchardSelectorProps {
  organizationId: string;
  value: string;
  onValueChange: (orchardId: string, orchard: OrchardOption) => void;
}

export function OrchardSelector({
  organizationId,
  value,
  onValueChange,
}: OrchardSelectorProps) {
  const [orchards, setOrchards] = useState<OrchardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const orchardsRef = useRef<OrchardOption[]>([]);

  useEffect(() => {
    if (!organizationId) return;

    fetch('/api/orchards')
      .then((res) => res.json())
      .then(({ data }) => {
        const mapped: OrchardOption[] = (data || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          hectares: v.hectares,
          orchard_type: v.orchard_type || 'apple',
          certification: v.certification || 'conventional',
          climate_zone: v.climate_zone || 'temperate',
          location_country_code: v.location_country_code || null,
        }));
        setOrchards(mapped);
        orchardsRef.current = mapped;
      })
      .catch(() => setOrchards([]))
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Loading orchards...
      </div>
    );
  }

  if (orchards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center">
        <TreePine className="h-5 w-5 mx-auto mb-1 text-muted-foreground opacity-50" />
        <p className="text-xs text-muted-foreground mb-2">
          No orchards configured yet.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/orchards/">
            <ExternalLink className="mr-1.5 h-3 w-3" />
            Add an orchard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Orchard</Label>
      <Select
        value={value}
        onValueChange={(id) => {
          const orchard = orchardsRef.current.find((v) => v.id === id);
          if (orchard) onValueChange(id, orchard);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an orchard" />
        </SelectTrigger>
        <SelectContent>
          {orchards.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              <span className="flex items-center gap-2">
                <TreePine className="h-3 w-3 text-[#ccff00]" />
                {v.name}
                <span className="text-xs text-muted-foreground">
                  ({v.hectares} ha)
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        The growing profile for this orchard will be used to calculate environmental impact.
      </p>
    </div>
  );
}
