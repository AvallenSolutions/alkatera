import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import MethodologyContent from './MethodologyContent';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ProductData {
  id: string;
  name: string;
  functional_unit?: string | null;
  unit_size_value?: number | null;
  unit_size_unit?: string | null;
  organization?: Array<{
    id: string;
    name: string;
    subscription_tier?: string;
    subscription_status?: string;
  }> | {
    id: string;
    name: string;
    subscription_tier?: string;
    subscription_status?: string;
  };
}

async function getPassportData(token: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: passport, error } = await supabase
    .from('product_passports')
    .select(`
      id,
      product_id,
      is_active,
      products (
        id,
        name,
        functional_unit,
        unit_size_value,
        unit_size_unit,
        organization:organizations (
          id,
          name,
          subscription_tier,
          subscription_status
        )
      )
    `)
    .eq('access_token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !passport) {
    return null;
  }

  return passport;
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function MethodologyPage({ params }: PageProps) {
  const { token } = await params;
  const passportData = await getPassportData(token);

  if (!passportData) {
    notFound();
  }

  const productRaw = passportData.products as unknown;
  if (!productRaw || typeof productRaw !== 'object') {
    notFound();
  }

  const product = productRaw as ProductData;

  const organization = Array.isArray(product.organization)
    ? product.organization[0]
    : product.organization;

  const tier = organization?.subscription_tier || 'seed';
  const subscriptionStatus = organization?.subscription_status || 'active';
  const isSubscriptionActive = ['active', 'trial', 'trialing'].includes(subscriptionStatus);
  const effectiveTier = isSubscriptionActive ? tier : 'seed';

  if (effectiveTier === 'seed') {
    notFound();
  }

  const functionalUnit = product.functional_unit
    || (product.unit_size_value && product.unit_size_unit
      ? `${product.unit_size_value} ${product.unit_size_unit}`
      : '1 unit');

  return (
    <MethodologyContent
      productName={product.name}
      organizationName={organization?.name || ''}
      functionalUnit={functionalUnit}
      token={token}
    />
  );
}
