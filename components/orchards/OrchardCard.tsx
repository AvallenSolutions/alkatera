'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TreePine, MapPin, Trash2, Edit2, Sprout, ArrowRight } from 'lucide-react';
import type { Orchard } from '@/lib/types/orchard';
import { ORCHARD_TYPE_LABELS } from '@/lib/orchard-utils';
import { StateChip } from '@/components/studio/state-chip';

interface OrchardCardProps {
  orchard: Orchard & { facilities?: { id: string; name: string } | null };
  hasGrowingProfile?: boolean;
  harvestCount?: number;
  onEdit: (orchard: Orchard) => void;
  onDelete: (id: string) => void;
  onEditProfile?: (orchard: Orchard) => void;
}

const CERTIFICATION_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  conventional: { label: 'Conventional', variant: 'outline' },
  organic: { label: 'Organic', variant: 'default' },
  biodynamic: { label: 'Biodynamic', variant: 'default' },
  other: { label: 'Other', variant: 'secondary' },
};

export function OrchardCard({ orchard, hasGrowingProfile, harvestCount, onEdit, onDelete, onEditProfile }: OrchardCardProps) {
  const cert = CERTIFICATION_LABELS[orchard.certification] || CERTIFICATION_LABELS.conventional;
  const typeLabel = ORCHARD_TYPE_LABELS[orchard.orchard_type] || orchard.orchard_type;

  const currentYear = new Date().getFullYear();
  const treeAge = orchard.planting_year ? currentYear - orchard.planting_year : null;

  return (
    <Card className="bg-card border-border hover:border-studio-cobalt transition-colors">
      <Link href={`/orchards/${orchard.id}`} className="block">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-secondary p-2">
                <TreePine className="h-5 w-5 text-studio-forest" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{orchard.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{typeLabel}</span>
                  <span>&middot;</span>
                  <span>{orchard.hectares} ha</span>
                  {treeAge != null && (
                    <>
                      <span>&middot;</span>
                      <span>
                        {treeAge} yr{treeAge !== 1 ? 's' : ''} old
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>
                    {orchard.annual_yield_tonnes
                      ? `${orchard.annual_yield_tonnes} t/year`
                      : 'Yield not set'}
                  </span>
                </div>
                {orchard.address_city && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {[orchard.address_city, orchard.address_country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant={cert.variant}>{cert.label}</Badge>
                  {harvestCount != null && harvestCount > 0 && (
                    <Badge variant="secondary">
                      {harvestCount} harvest{harvestCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {hasGrowingProfile === true && (
                    <StateChip tone="good">Profile complete</StateChip>
                  )}
                  {hasGrowingProfile === false && (
                    <StateChip tone="attention">Needs growing data</StateChip>
                  )}
                  {orchard.fruit_varieties && orchard.fruit_varieties.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {orchard.fruit_varieties.slice(0, 3).join(', ')}
                      {orchard.fruit_varieties.length > 3 && ` +${orchard.fruit_varieties.length - 3}`}
                    </span>
                  )}
                </div>
                {(orchard as any).facilities && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Linked to: {(orchard as any).facilities.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Link>
      <div className="px-4 pb-4 pt-0 flex items-center justify-between border-t border-border/50 mt-0 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          asChild
        >
          <Link href={`/orchards/${orchard.id}`}>
            View Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          {onEditProfile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={(e) => {
                e.preventDefault();
                onEditProfile(orchard);
              }}
            >
              <Sprout className="h-3.5 w-3.5" />
              {hasGrowingProfile ? 'Edit Profile' : 'Add Profile'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.preventDefault();
              onEdit(orchard);
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.preventDefault();
              onDelete(orchard.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
