import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBrandReportByToken } from '@/lib/outreach/brand-report';
import ClaimFlow from '@/components/outreach/ClaimFlow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ClaimPageProps {
  params: { token: string };
}

export async function generateMetadata({ params }: ClaimPageProps): Promise<Metadata> {
  const report = await getBrandReportByToken(params.token);
  return {
    title: report ? `Claim ${report.brand_name} | alkatera` : 'Report not found',
    robots: { index: false, follow: false },
  };
}

export default async function ClaimPage({ params }: ClaimPageProps) {
  const report = await getBrandReportByToken(params.token);
  if (!report) notFound();

  return (
    <ClaimFlow
      token={report.token}
      brandName={report.brand_name}
      category={report.estimate?.category ?? null}
      kgPerBottle={report.estimate?.representativeBottle?.kgCO2ePerBottle ?? null}
    />
  );
}
