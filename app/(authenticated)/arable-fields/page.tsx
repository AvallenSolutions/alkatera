'use client';

import { GrowingSitesPage } from '@/components/growing/GrowingSitesPage';
import { arableFieldConfig } from '@/components/growing/crop-config';

export default function ArableFieldsPage() {
  return <GrowingSitesPage config={arableFieldConfig} />;
}
