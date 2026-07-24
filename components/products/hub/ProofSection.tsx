'use client';

import Link from 'next/link';
import { Eyebrow } from '@/components/studio/eyebrow';
import { DownloadLCAButton } from '@/components/products/DownloadLCAButton';
import PassportManagementPanel from '@/components/passport/PassportManagementPanel';
import type { Product, ProductLCA } from '@/hooks/data/useProductData';

interface ProofSectionProps {
  productId: string;
  product: Product;
  lcaReports: ProductLCA[];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * What the product can show the outside world.
 *
 * The passport and the report were two separate tabs, which put the two things
 * a founder sends to a customer on opposite sides of the page. They belong
 * together, behind the same confirmed-share gate. Report rows link to the
 * dossier, not the compliance wizard: the wizard is the full record now,
 * reached from the dossier, not the way in.
 */
export function ProofSection({ productId, product, lcaReports }: ProofSectionProps) {
  const latest = lcaReports[0];
  const recent = lcaReports.slice(0, 3);

  return (
    <section className="border-t border-studio-hairline pt-8">
      <Eyebrow className="mb-6">THE PROOF</Eyebrow>

      {recent.length > 0 ? (
        <>
          <dl className="divide-y divide-studio-hairline border-y border-studio-hairline">
            {recent.map((report) => (
              <div key={report.id} className="flex items-baseline gap-3 py-2.5">
                <dt className="min-w-0 flex-1">
                  <Link
                    href={`/products/${productId}/dossier`}
                    className="text-sm text-foreground transition-colors duration-150 ease-studio hover:text-room-accent"
                  >
                    {report.system_boundary
                      ? report.system_boundary.replace(/[-_]/g, ' ')
                      : 'Footprint'}
                  </Link>
                </dt>
                <dd className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDate(report.created_at)}
                </dd>
              </div>
            ))}
          </dl>
          {latest?.id && (
            <div className="mt-5">
              <DownloadLCAButton
                lcaId={latest.id}
                productName={product.name}
                productId={Number(productId)}
                size="default"
              />
            </div>
          )}
        </>
      ) : (
        <p className="max-w-md text-sm text-muted-foreground">
          Nothing to show yet. A report becomes available once enough of the footprint is
          confirmed.
        </p>
      )}

      <div className="mt-10">
        <PassportManagementPanel
          productId={productId}
          productName={product.name}
          initialPassportEnabled={product.passport_enabled || false}
          initialPassportToken={product.passport_token || null}
          initialViewsCount={product.passport_views_count || 0}
          initialLastViewedAt={product.passport_last_viewed_at || null}
          initialPassportSettings={(product.passport_settings as Record<string, unknown>) || {}}
        />
      </div>
    </section>
  );
}
