'use client';

import { GrowingSitesPage } from '@/components/growing/GrowingSitesPage';
import { orchardConfig } from '@/components/growing/crop-config';

export default function OrchardsPage() {
  return <GrowingSitesPage config={orchardConfig} />;
}
