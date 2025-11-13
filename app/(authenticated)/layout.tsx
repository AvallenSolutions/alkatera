'use client'

import { AppLayout } from '@/components/layouts/AppLayout';
import { OrganizationProvider } from '@/lib/organizationContext';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrganizationProvider>
      <AppLayout>{children}</AppLayout>
    </OrganizationProvider>
  );
}
