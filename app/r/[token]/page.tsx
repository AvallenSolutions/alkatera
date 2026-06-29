import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBrandReportByToken } from '@/lib/outreach/brand-report';
import BrandReportView from '@/components/outreach/BrandReportView';
import ReportViewBeacon from '@/components/outreach/ReportViewBeacon';

// Always fetch fresh — a report may be regenerated or claimed between views.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ReportPageProps {
  params: { token: string };
}

// Private capability link: never index or follow, in addition to the /r/
// disallow in robots.ts.
export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const report = await getBrandReportByToken(params.token);
  return {
    title: report ? `${report.brand_name} footprint estimate | alkatera` : 'Report not found',
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({ params }: ReportPageProps) {
  const report = await getBrandReportByToken(params.token);
  if (!report) notFound();

  return (
    <>
      <ReportViewBeacon token={report.token} />
      <BrandReportView
        token={report.token}
        brandName={report.brand_name}
        countryOfOrigin={report.country_of_origin}
        estimate={report.estimate}
      />
    </>
  );
}
