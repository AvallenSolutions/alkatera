import { PackagingMigrationTool } from '@/components/admin/packaging-migration-tool';

export const metadata = {
  title: 'Packaging material mapping',
};

export default function PackagingMigrationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Packaging material mapping</h1>
        <p className="text-sm text-muted-foreground">
          Maps legacy packaging rows in the active organisation onto the parametric material
          classes. Legacy rows resolve their emission factor by name matching; once a row has a
          material class, the factor is derived deterministically from the vetted virgin and
          recycled endpoints at the item&apos;s recycled content.
        </p>
        <p className="text-sm text-muted-foreground">
          This is a dry-run tool: it shows the proposed class and the factor change per row, and
          applying it only writes the class. Nothing is recalculated here; affected products show
          as stale and pick up the new factors on their next calculation (or via the
          Recalculate LCAs tool).
        </p>
      </div>

      <PackagingMigrationTool />
    </div>
  );
}
