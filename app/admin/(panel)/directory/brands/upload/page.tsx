import { AdminUploadWizard } from '@/components/admin/directory/admin-upload-wizard';
import { BRAND_FIELDS } from '@/lib/admin/directory/field-specs';

export const dynamic = 'force-dynamic';

export default function AdminBrandsUploadPage() {
  return (
    <AdminUploadWizard
      kind="brands"
      title="Upload brands CSV"
      description={
        <>
          One row per canonical brand. The matcher dedupes against existing entries by
          normalised name; brands you've uploaded before will be linked rather than duplicated.
          New rows land with <code className="text-[12px] bg-muted/50 px-1.5 py-0.5 rounded">discovered_via='manual'</code>.
        </>
      }
      fields={BRAND_FIELDS}
      backHref="/admin/directory/brands"
      templateName="brands.csv"
    />
  );
}
