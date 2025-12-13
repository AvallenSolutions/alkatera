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
    return null;
  }

  const { data: lca } = await supabase
    .from('product_lcas')
    .select('*')
    .eq('product_id', product.id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: materials } = await supabase
    .from('product_lca_materials')
    .select('*')
    .eq('product_lca_id', lca?.id || '')
    .order('created_at');

  return {
    product,
    lca,
    materials: materials || [],
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

  return {
    title: `${data.product.name} - Product Passport`,
    description: data.product.product_description || `Environmental impact data for ${data.product.name}`,
    openGraph: {
      title: `${data.product.name} - Environmental Passport`,
      description: data.product.product_description || 'View detailed environmental impact metrics',
      images: data.product.image_url ? [data.product.image_url] : [],
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
