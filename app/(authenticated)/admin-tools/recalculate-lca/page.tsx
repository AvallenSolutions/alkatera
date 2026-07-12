import { RecalculateOrgLcasButton } from '@/components/admin/recalculate-org-lcas-button';
import { Statement } from '@/components/studio/statement';
import { Panel } from '@/components/studio/panel';

export const metadata = {
  title: 'Recalculate LCAs',
};

export default function RecalculateLcaToolPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN" headline="Recalculate LCAs." />
        <div className="mt-2 max-w-2xl space-y-2">
          <p className="text-sm text-studio-dim">
            Re-runs every product LCA in the currently active organisation through the same
            calculator the wizard uses, reusing each product&apos;s saved wizard settings and
            facility allocations. Use this to propagate a calculator fix without opening each
            product&apos;s wizard by hand.
          </p>
          <p className="text-sm text-studio-dim">
            A new completed PCF is created per product and the previous one is superseded.
            Products with no recoverable facility allocations are skipped and listed so you can
            re-run them via the wizard. Verify one regenerated report before relying on the batch.
          </p>
        </div>
      </div>

      <Panel>
        <RecalculateOrgLcasButton />
      </Panel>
    </div>
  );
}
