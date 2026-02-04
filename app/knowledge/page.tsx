import { Metadata } from 'next';
import { KnowledgePageClient } from '@/marketing/components/KnowledgePageClient';

export const metadata: Metadata = {
  title: 'Knowledge | Alkatera',
  description: 'Insights, guides, and perspectives on building a regenerative drinks brand. From carbon accounting to supply chain strategy.',
  alternates: {
    canonical: '/knowledge',
  },
};

export default function KnowledgePage() {
  return <KnowledgePageClient />;
}
