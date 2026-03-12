import { Metadata } from 'next';
import { SupplierOnePagerClient } from '@/marketing/components/SupplierOnePagerClient';

export const metadata: Metadata = {
  title: 'Join the Supplier Network | alkatera',
  description: 'Register as a verified supplier on the alkatera network. Turn your sustainability data into a commercial advantage with the drinks brands who need your credentials.',
  alternates: {
    canonical: '/supplier-one-pager',
  },
};

export default function SupplierOnePagerPage() {
  return <SupplierOnePagerClient />;
}
