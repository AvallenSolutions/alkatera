import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { BrandUploadForm } from '@/components/brand-upload/upload-form';
import { ReviewSection } from '@/components/brand-upload/review-section';
import { AlkateraPitch } from '@/components/brand-upload/alkatera-pitch';
import type { BrandUploadFieldState } from '@/app/api/brand-upload/[token]/route';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { token: string };
}

interface BrandUploadDetails {
  brand: { name: string; category: string | null; country_of_origin: string | null };
  distributor: { name: string; logo_url: string | null };
  /** Optional procurement co-brand when outreach originated from a procurement org. */
  procurement: {
    name: string;
    parent_company: string | null;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
  /** How many distributors list this brand. Verifications flow to all of them. */
  listing_count: number;
  skus: Array<{
    id: string;
    product_name: string;
    sku_code: string | null;
    category: string | null;
  }>;
  field_states: BrandUploadFieldState[];
  expires_at: string | null;
}

/**
 * Fully public page — no auth, no session. Fetches the brand, distributor,
 * SKU list and every active field finding server-side, then renders:
 *   1. Hero — who's asking and why
 *   2. Review section — every field with the current value + provenance,
 *      with per-field Confirm / Edit affordances
 *   3. Document upload — the legacy file-only form, now framed as "or
 *      send us supporting documents".
 *
 * The token is never exposed inline to the page HTML beyond what's
 * needed for the form submission URL (which the brand already has in
 * their email).
 */
export default async function BrandUploadPage({ params }: PageProps) {
  const headerList = headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') ?? 'http';
  const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? '');

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/brand-upload/${encodeURIComponent(params.token)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return <FatalError title="We could not load this link" message="Please try again in a moment." />;
  }

  if (res.status === 404) return notFound();
  if (res.status === 410) {
    return (
      <FatalError
        title="This link has expired"
        message="Please contact the distributor who sent it to request a fresh link."
      />
    );
  }
  if (!res.ok) {
    return (
      <FatalError
        title="We could not load this link"
        message="Please try again in a moment, or contact the distributor who sent it to you."
      />
    );
  }

  const details = (await res.json()) as BrandUploadDetails;

  const procurement = details.procurement;

  return (
    <div className="min-h-screen bg-background">
      {procurement ? (
        <header className="border-b border-border bg-white">
          <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold whitespace-nowrap">
                Sustainability Data Review
              </span>
            </div>
            <div className="flex items-center gap-4 min-w-0">
              {procurement.logo_url ? (
                <img
                  src={procurement.logo_url}
                  alt={procurement.name}
                  className="h-9 max-w-[180px] object-contain"
                />
              ) : (
                <span className="text-sm font-semibold text-stone-900 truncate">
                  {procurement.name}
                </span>
              )}
              <span className="text-xs text-stone-500 whitespace-nowrap">
                via alka<strong>tera</strong>
              </span>
            </div>
          </div>
        </header>
      ) : (
        <header className="border-b border-border/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
              <span className="text-xs uppercase tracking-wider text-sky-300 font-semibold">
                Sustainability Data Review
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              via alka<strong>tera</strong>
            </span>
          </div>
        </header>
      )}

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <Hero
          distributorName={details.distributor.name}
          brandName={details.brand.name}
          skuCount={details.skus.length}
        />

        {details.listing_count > 1 && (
          <section className="rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent px-5 py-4 text-sm flex items-start gap-3">
            <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[11px] font-semibold whitespace-nowrap shrink-0">
              {details.listing_count} distributors
            </span>
            <span className="text-muted-foreground">
              Your verified data is shared with the {details.listing_count} distributors that list
              your products. Verify once and the answers reach every distributor automatically. You
              control who sees what — manage sharing per distributor at your{' '}
              <a
                href="/dashboard/settings/distributors"
                className="text-sky-300 hover:text-sky-200 underline underline-offset-2"
              >
                alka<strong>tera</strong> sharing settings
              </a>
              .
            </span>
          </section>
        )}

        {details.skus.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              {details.brand.name} products in {details.distributor.name}'s portfolio
            </div>
            <ul className="text-sm space-y-1.5">
              {details.skus.slice(0, 8).map((sku, i) => (
                <li key={`${sku.product_name}-${i}`} className="flex items-center gap-2 text-foreground">
                  <span className="h-1 w-1 rounded-full bg-sky-400/70" />
                  <span>{sku.product_name}</span>
                  {sku.sku_code && (
                    <span className="text-muted-foreground text-xs">· {sku.sku_code}</span>
                  )}
                </li>
              ))}
              {details.skus.length > 8 && (
                <li className="text-xs text-muted-foreground italic pl-3">
                  + {details.skus.length - 8} more
                </li>
              )}
            </ul>
          </section>
        )}

        <AlkateraPitch
          brandName={details.brand.name}
          distributorName={details.distributor.name}
        />

        <ReviewSection
          token={params.token}
          distributorName={details.distributor.name}
          brandName={details.brand.name}
          skus={details.skus}
          initialFieldStates={details.field_states}
        />

        <section className="space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              Or hand us a document
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Send us supporting documents</h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              If you have an LCA report, sustainability report, certificate or packaging data sheet,
              upload it below. We extract the relevant numbers automatically and route any
              differences from the data above into our review queue.
            </p>
          </div>
          <BrandUploadForm
            token={params.token}
            brandName={details.brand.name}
            skus={details.skus}
          />
        </section>

        <section className="border-t border-border/60 pt-6 text-xs text-muted-foreground">
          Questions about this request? Contact {details.distributor.name} directly. We only pass
          your responses on to them.
        </section>
      </main>
    </div>
  );
}

function Hero({
  distributorName,
  brandName,
  skuCount,
}: {
  distributorName: string;
  brandName: string;
  skuCount: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-7 sm:p-9 space-y-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />

      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
        Sustainability data request from {distributorName}
      </div>

      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
        Check our sustainability picture of <span className="text-sky-300">{brandName}</span>.
      </h1>

      <p className="text-base text-muted-foreground leading-relaxed">
        {distributorName} sells {brandName}
        {skuCount > 0
          ? ` and ${skuCount === 1 ? 'one of your products' : `${skuCount} of your products`}`
          : ''}{' '}
        and uses alka<strong>tera</strong> to track the sustainability of every brand they carry.
        We've gathered what we could from your website and public sources to give them a starting
        picture. Tick anything that's right, correct anything that isn't, and fill any gaps you
        can.
      </p>

      <ul className="text-sm space-y-2.5 text-muted-foreground pt-1">
        <li className="flex gap-2.5">
          <span className="text-sky-400 mt-1">●</span>
          <span>
            Everything you confirm or correct goes straight to {distributorName}. Only they can
            see it; we don't publish it anywhere else.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="text-sky-400 mt-1">●</span>
          <span>
            You can hand over a finished sustainability report or LCA and we'll read it for you.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="text-sky-400 mt-1">●</span>
          <span>It should take around 10 minutes and there's no account to create.</span>
        </li>
      </ul>
    </div>
  );
}

function FatalError({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          alka<strong>tera</strong>
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
