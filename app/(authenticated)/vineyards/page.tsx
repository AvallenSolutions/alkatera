'use client';

import { GrowingSitesPage } from '@/components/growing/GrowingSitesPage';
import { vineyardConfig } from '@/components/growing/crop-config';

export default function VineyardsPage() {
  return <GrowingSitesPage config={vineyardConfig} />;
}
