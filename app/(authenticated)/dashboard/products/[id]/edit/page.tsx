import { EditProductForm } from "@/components/products/EditProductForm";

interface EditProductPageProps {
  params: {
    id: string;
  };
}

export async function generateStaticParams() {
  return [];
}

export default function EditProductPage({ params }: EditProductPageProps) {
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="text-muted-foreground mt-2">
          Update product information
        </p>
      </div>

      <EditProductForm productId={params.id} />
    </div>
  );
}
