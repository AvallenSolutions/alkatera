import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { Clock, Calendar, User, Tag, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image_url?: string;
  author_name?: string;
  tags: string[];
  content_type: string;
  status: string;
  published_at?: string;
  read_time?: string;
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error) {
      console.error('Error fetching blog post:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const post = await getBlogPost(params.slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      images: post.og_image_url || post.featured_image_url ? [
        {
          url: post.og_image_url || post.featured_image_url!,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ] : [],
      type: 'article',
      publishedTime: post.published_at,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      images: post.og_image_url || post.featured_image_url ? [(post.og_image_url || post.featured_image_url)!] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getBlogPost(params.slug);

  if (!post || post.status !== 'published') {
    notFound();
  }

  const publishedDate = post.published_at ? new Date(post.published_at) : null;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navigation />

      <main className="pt-32 pb-20">
        <article className="max-w-4xl mx-auto px-6">
          {/* Back Link */}
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-[#ccff00] transition-colors mb-8 font-mono text-sm uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Knowledge Hub
          </Link>

          {/* Header */}
          <header className="mb-12 space-y-6">
            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] font-mono text-xs uppercase tracking-widest"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-5xl md:text-6xl font-serif leading-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl text-gray-400 leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 font-mono uppercase tracking-widest">
              {post.author_name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {post.author_name}
                </div>
              )}
              {publishedDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {publishedDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              )}
              {post.read_time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {post.read_time}
                </div>
              )}
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image_url && (
            <div className="mb-12 -mx-6 md:mx-0">
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-full h-auto rounded-none md:rounded-lg"
              />
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-invert prose-lg max-w-none
              prose-headings:font-serif prose-headings:text-white
              prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-[#ccff00] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white prose-strong:font-bold
              prose-code:text-[#ccff00] prose-code:bg-[#ccff00]/10 prose-code:px-1 prose-code:py-0.5
              prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10
              prose-blockquote:border-l-[#ccff00] prose-blockquote:text-gray-400 prose-blockquote:italic
              prose-img:rounded-lg prose-img:w-full
              prose-ul:text-gray-300 prose-ol:text-gray-300
              prose-li:marker:text-[#ccff00]"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Footer Tags */}
          {post.tags.length > 0 && (
            <footer className="mt-16 pt-8 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500 font-mono text-xs uppercase tracking-widest">
                  Tagged:
                </span>
                {post.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-white/5 border border-white/10 text-gray-400 font-mono text-xs uppercase tracking-widest hover:border-[#ccff00] hover:text-[#ccff00] transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </footer>
          )}
        </article>
      </main>

      <Footer />
    </div>
  );
}
