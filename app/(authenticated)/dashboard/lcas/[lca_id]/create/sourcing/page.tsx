import { SourcingMethodologyCards } from "@/components/lca/SourcingMethodologyCards";

interface SourcingPageProps {
  params: {
    lca_id: string;
  };
}

export async function generateStaticParams() {
  return [];
}

export default function SourcingMethodologyPage({ params }: SourcingPageProps) {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Step 1: Sourcing Methodology</h1>
        <p className="text-muted-foreground mt-2">
          Select how your organisation sources the core ingredients for this product
        </p>
      </div>

      <SourcingMethodologyCards lcaId={params.lca_id} />
    </div>
  );
}
