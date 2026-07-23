import { Metadata } from 'next';
import { KnowledgeClient, type KnowledgePost } from '@/marketing/knowledge/KnowledgeClient';
import '@/marketing/shared/marketing.css';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

// ISR: keep the list fresh hourly without per-request rendering.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Knowledge · alkatera',
  description: 'Insights, guides, and perspectives on building a regenerative drinks brand. From carbon accounting to supply chain strategy.',
  alternates: {
    canonical: '/knowledge',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Knowledge · alkatera',
    description: 'Insights, guides, and perspectives on building a regenerative drinks brand. From carbon accounting to supply chain strategy.',
  },
};

// Fetch published posts server-side so the post list and its /blog/[slug] links
// are in the first-paint HTML and crawlable by search engines. Mirrors the query
// used in app/sitemap.ts.
async function getPublishedPosts(): Promise<KnowledgePost[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, tags, read_time, featured_image_url, author_name, content_type, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      if (error) console.error('Error fetching posts for knowledge page:', error);
      return [];
    }

    return data as KnowledgePost[];
  } catch (error) {
    console.error('Error fetching posts for knowledge page:', error);
    return [];
  }
}

export default async function KnowledgePage() {
  const initialPosts = await getPublishedPosts();
  return <KnowledgeClient posts={initialPosts} />;
}
