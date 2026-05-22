import { AdminUploadWizard } from '@/components/admin/directory/admin-upload-wizard';
import { PRODUCT_FIELDS } from '@/lib/admin/directory/field-specs';

export const dynamic = 'force-dynamic';

export default function AdminProductsUploadPage() {
  return (
    <AdminUploadWizard
      kind="products"
      title="Upload products CSV"
      description={
        <>
          One row per canonical product. Each row must reference an existing brand by exact
          name; rows with an unknown brand are skipped and reported as errors (upload the
          brand first). GTIN is the primary dedup key — re-uploading the same row links it
          to the existing canonical product.
        </>
      }
      fields={PRODUCT_FIELDS}
      backHref="/admin/directory/products"
      templateName="products.csv"
    />
  );
}
