import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { Clock, Calendar, User, Tag, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { SocialShare } from '@/components/blog/SocialShare';
import sanitizeHtml from 'sanitize-html';

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
  video_url?: string;
  video_duration?: string;
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

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Handle youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
      return `https://www.youtube.com/embed/${urlObj.searchParams.get('v')}`;
    }

    // Handle youtu.be/VIDEO_ID
    if (urlObj.hostname.includes('youtu.be')) {
      const videoId = urlObj.pathname.slice(1);
      return `https://www.youtube.com/embed/${videoId}`;
    }

    return null;
  } catch (error) {
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
    <div className="min-h-screen bg-[#050505] text-white relative">
      {/* Fixed background layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2832&auto=format&fit=crop"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-[#050505]/80" />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '80px 80px'
          }}
        />
        {/* Static gradient blobs */}
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-[#ccff00] rounded-full opacity-[0.07] blur-[100px]" />
        <div className="absolute bottom-[10%] right-[15%] w-[600px] h-[600px] bg-[#00ccff] rounded-full opacity-[0.07] blur-[100px]" />
      </div>

      <div className="relative z-10">
      <Navigation />

      <main className="pt-32 pb-20">
        <article className="max-w-4xl mx-auto px-6">
          {/* Back Link */}
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-[#ccff00] transition-all duration-300 mb-12 font-mono text-sm uppercase tracking-widest group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
            Back to Knowledge Hub
          </Link>

          {/* Header */}
          <header className="mb-16 space-y-8">
            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] font-mono text-xs uppercase tracking-widest rounded-md hover:bg-[#ccff00]/20 transition-colors duration-300"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-serif leading-[1.1] tracking-tight bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl md:text-2xl text-gray-400 leading-relaxed max-w-3xl">
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

            {/* Social Share */}
            <SocialShare
              url={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com'}/blog/${post.slug}`}
              title={post.title}
              description={post.excerpt}
            />
          </header>

          {/* Featured Image (only show if not a video post) */}
          {post.featured_image_url && post.content_type !== 'video' && (
            <div className="mb-16 -mx-6 md:mx-0 group">
              <div className="relative overflow-hidden rounded-none md:rounded-xl">
                <img
                  src={post.featured_image_url}
                  alt={post.title}
                  className="w-full h-auto transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-50"></div>
              </div>
            </div>
          )}

          {/* Video Player */}
          {post.content_type === 'video' && post.video_url && (
            <div className="mb-16 -mx-6 md:mx-0">
              {getYouTubeEmbedUrl(post.video_url) ? (
                // YouTube Video
                <div className="relative w-full pb-[56.25%] rounded-none md:rounded-xl overflow-hidden shadow-2xl border border-white/5">
                  <iframe
                    src={getYouTubeEmbedUrl(post.video_url)!}
                    title={post.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute top-0 left-0 w-full h-full"
                  />
                </div>
              ) : (
                // Direct Video File
                <video
                  controls
                  className="w-full h-auto rounded-none md:rounded-xl bg-black shadow-2xl border border-white/5"
                  poster={post.featured_image_url}
                >
                  <source src={post.video_url} type="video/mp4" />
                  <source src={post.video_url} type="video/webm" />
                  <source src={post.video_url} type="video/ogg" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}

          {/* Content */}
          {post.content && (
            <div
              className="prose prose-invert prose-lg md:prose-xl max-w-none
                prose-headings:font-serif prose-headings:text-white prose-headings:tracking-tight
                prose-h1:text-5xl prose-h1:leading-tight prose-h1:mb-6 prose-h1:mt-12
                prose-h2:text-4xl prose-h2:leading-tight prose-h2:mb-4 prose-h2:mt-10
                prose-h3:text-3xl prose-h3:leading-snug prose-h3:mb-3 prose-h3:mt-8
                prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-6
                prose-a:text-[#ccff00] prose-a:no-underline prose-a:font-medium hover:prose-a:underline prose-a:transition-all
                prose-strong:text-white prose-strong:font-semibold
                prose-em:text-gray-200 prose-em:italic
                prose-code:text-[#ccff00] prose-code:bg-[#ccff00]/10 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:font-mono prose-code:text-base
                prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:p-6
                prose-blockquote:border-l-4 prose-blockquote:border-l-[#ccff00] prose-blockquote:text-gray-300 prose-blockquote:italic prose-blockquote:pl-6 prose-blockquote:py-2
                prose-img:rounded-xl prose-img:w-full prose-img:shadow-2xl prose-img:border prose-img:border-white/5
                prose-ul:text-gray-300 prose-ul:space-y-2 prose-ol:text-gray-300 prose-ol:space-y-2
                prose-li:marker:text-[#ccff00] prose-li:leading-relaxed
                prose-hr:border-white/10 prose-hr:my-12
                first:prose-p:text-xl first:prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'iframe', 'video', 'source', 'h1', 'h2']),
                allowedAttributes: {
                  ...sanitizeHtml.defaults.allowedAttributes,
                  img: ['src', 'alt', 'width', 'height', 'class', 'loading'],
                  iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title', 'class'],
                  video: ['src', 'controls', 'poster', 'class', 'width', 'height'],
                  source: ['src', 'type'],
                  a: ['href', 'target', 'rel', 'class'],
                  '*': ['class', 'id', 'style'],
                },
                allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com'],
              }) }}
            />
          )}

          {/* Footer Tags & Share */}
          <footer className="mt-20 pt-10 border-t border-white/10 space-y-8">
            {/* Social Share */}
            <div className="flex justify-center">
              <SocialShare
                url={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com'}/blog/${post.slug}`}
                title={post.title}
                description={post.excerpt}
              />
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3 pb-4">
                <span className="text-gray-500 font-mono text-xs uppercase tracking-widest">
                  Tagged:
                </span>
                {post.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-gray-400 font-mono text-xs uppercase tracking-widest rounded-md hover:border-[#ccff00] hover:text-[#ccff00] hover:bg-[#ccff00]/5 transition-all duration-300 cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </footer>
        </article>
      </main>

      <Footer />
      </div>
    </div>
  );
}
