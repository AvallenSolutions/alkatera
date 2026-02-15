import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PassportView from '@/components/passport/PassportView';

interface PassportPageProps {
  params: {
    token: string;
  };
}

async function getProductByToken(token: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      organization:organizations (
        id,
        name,
        logo_url,
        subscription_tier,
        subscription_status
      )
    `)
    .eq('passport_token', token)
    .eq('passport_enabled', true)
    .maybeSingle();

  if (error || !product) {
    console.error('Product fetch error:', error);
    return null;
  }

  console.log('Product with organization:', JSON.stringify(product, null, 2));

  const { data: lca } = await supabase
    .from('product_carbon_footprints')
    .select('*')
    .eq('product_id', product.id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('LCA data:', JSON.stringify(lca, null, 2));

  const { data: materials } = await supabase
    .from('product_carbon_footprint_materials')
    .select('*')
    .eq('product_carbon_footprint_id', lca?.id || '')
    .order('created_at');

  console.log('Materials count:', materials?.length);

  // Count completed LCAs for version number
  const { count: lcaCount } = await supabase
    .from('product_carbon_footprints')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', product.id)
    .eq('status', 'completed');

  return {
    product,
    lca,
    materials: materials || [],
    lcaCount: lcaCount || 1,
  };
}

export async function generateMetadata({ params }: PassportPageProps): Promise<Metadata> {
  const { token } = params;
  const data = await getProductByToken(token);

  if (!data) {
    return {
      title: 'Product Not Found',
    };
  }

  const org = Array.isArray(data.product.organization)
    ? data.product.organization[0]
    : data.product.organization;
  const orgName = org?.name || '';
  const carbonValue = data.lca?.aggregated_impacts?.climate_change_gwp100;
  const category = data.product.product_category || '';

  const descriptionParts = [];
  if (category) descriptionParts.push(category);
  if (orgName) descriptionParts.push(`by ${orgName}`);
  if (carbonValue) descriptionParts.push(`Carbon footprint: ${carbonValue.toFixed(2)} kg CO\u2082e`);

  const description = descriptionParts.length > 0
    ? `${data.product.name} - ${descriptionParts.join('. ')}. View the verified environmental passport.`
    : data.product.product_description || `Environmental impact data for ${data.product.name}`;

  return {
    title: `${data.product.name} - Product Passport | alkatera`,
    description,
    openGraph: {
      type: 'article',
      siteName: 'alkatera',
      title: `${data.product.name} - Environmental Passport`,
      description,
      images: data.product.product_image_url ? [data.product.product_image_url] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.product.name} - Environmental Passport`,
      description,
      images: data.product.product_image_url ? [data.product.product_image_url] : [],
    },
  };
}

export default async function PassportPage({ params }: PassportPageProps) {
  const { token } = params;
  const data = await getProductByToken(token);

  if (!data) {
    notFound();
  }

  return <PassportView data={data} token={token} />;
}
