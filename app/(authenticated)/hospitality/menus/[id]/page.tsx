'use client';

import { useParams } from 'next/navigation';
import { MenuEditor } from '@/components/hospitality/MenuEditor';

export default function MenuDetailPage() {
  const params = useParams<{ id: string }>();
  return <MenuEditor menuId={params.id} />;
}
