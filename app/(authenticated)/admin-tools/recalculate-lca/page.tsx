import { RecalculateOrgLcasButton } from '@/components/admin/recalculate-org-lcas-button';

export const metadata = {
  title: 'Recalculate LCAs',
};

export default function RecalculateLcaToolPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Recalculate LCAs</h1>
        <p className="text-sm text-muted-foreground">
          Re-runs every product LCA in the currently active organization through the same
          calculator the wizard uses, reusing each product&apos;s saved wizard settings and
          facility allocations. Use this to propagate a calculator fix without opening each
          product&apos;s wizard by hand.
        </p>
        <p className="text-sm text-muted-foreground">
          A new completed PCF is created per product and the previous one is superseded.
          Products with no recoverable facility allocations are skipped and listed so you can
          re-run them via the wizard. Verify one regenerated report before relying on the batch.
        </p>
      </div>

      <RecalculateOrgLcasButton />
    </div>
  );
}
