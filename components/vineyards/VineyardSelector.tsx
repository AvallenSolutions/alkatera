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
import { Leaf, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface VineyardOption {
  id: string;
  name: string;
  hectares: number;
  certification: string;
  climate_zone: string;
  location_country_code: string | null;
}

interface VineyardSelectorProps {
  organizationId: string;
  value: string;
  onValueChange: (vineyardId: string, vineyard: VineyardOption) => void;
}

export function VineyardSelector({
  organizationId,
  value,
  onValueChange,
}: VineyardSelectorProps) {
  const [vineyards, setVineyards] = useState<VineyardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const vineyardsRef = useRef<VineyardOption[]>([]);

  useEffect(() => {
    if (!organizationId) return;

    fetch('/api/vineyards')
      .then((res) => res.json())
      .then(({ data }) => {
        const mapped: VineyardOption[] = (data || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          hectares: v.hectares,
          certification: v.certification || 'conventional',
          climate_zone: v.climate_zone || 'temperate',
          location_country_code: v.location_country_code || null,
        }));
        setVineyards(mapped);
        vineyardsRef.current = mapped;
      })
      .catch(() => setVineyards([]))
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Loading vineyards...
      </div>
    );
  }

  if (vineyards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center">
        <Leaf className="h-5 w-5 mx-auto mb-1 text-muted-foreground opacity-50" />
        <p className="text-xs text-muted-foreground mb-2">
          No vineyards configured yet.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/vineyards/">
            <ExternalLink className="mr-1.5 h-3 w-3" />
            Add a vineyard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Vineyard</Label>
      <Select
        value={value}
        onValueChange={(id) => {
          const vineyard = vineyardsRef.current.find((v) => v.id === id);
          if (vineyard) onValueChange(id, vineyard);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a vineyard" />
        </SelectTrigger>
        <SelectContent>
          {vineyards.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              <span className="flex items-center gap-2">
                <Leaf className="h-3 w-3 text-[#ccff00]" />
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
        The growing profile for this vineyard will be used to calculate environmental impact.
      </p>
    </div>
  );
}
