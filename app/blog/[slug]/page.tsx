import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import sanitizeHtml from 'sanitize-html';
import { spaceGrotesk } from '@/marketing/shared/fonts';
import { F_BODY, F_MONO, F_STATEMENT, SiteFooter, SiteNav } from '@/marketing/shared/chrome';
import { CursorCreatures } from '@/marketing/shared/effects';
import { flowerForSlug } from '@/marketing/knowledge/flowers';
import '@/marketing/shared/marketing.css';

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
  updated_at?: string;
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com';
  const postUrl = `${siteUrl}/blog/${post.slug}`;

  // Use meta_title only if it looks like a real title (not a slug or fragment).
  // Slugs typically contain underscores/hyphens and no spaces.
  const metaTitleIsValid = post.meta_title && post.meta_title.includes(' ');
  const title = metaTitleIsValid ? post.meta_title! : post.title;
  const description = post.meta_description || post.excerpt || '';

  const imageUrl = post.og_image_url || post.featured_image_url;

  return {
    title,
    description,
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      title,
      description,
      url: postUrl,
      siteName: 'alkatera',
      locale: 'en_GB',
      type: 'article',
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : undefined,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [{ url: imageUrl, alt: post.title }] : [],
      creator: '@alkatera',
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getBlogPost(params.slug);

  if (!post || post.status !== 'published') {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com';
  const postUrl = `${siteUrl}/blog/${post.slug}`;
  const imageUrl = post.og_image_url || post.featured_image_url;
  const publishedDate = post.published_at ? new Date(post.published_at) : null;

  // JSON-LD structured data for rich previews on LinkedIn, Google, etc.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description || post.excerpt || '',
    image: imageUrl || undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    author: {
      '@type': 'Person',
      name: post.author_name || 'alkatera',
    },
    publisher: {
      '@type': 'Organization',
      name: 'alkatera',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
      },
    },
    url: postUrl,
    mainEntityOfPage: postUrl,
  };

  const kickerParts = [
    post.read_time,
    publishedDate
      ? publishedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null,
    post.author_name,
  ].filter(Boolean);

  const shareText = encodeURIComponent(post.title);
  const shareUrl = encodeURIComponent(postUrl);

  const shareLinkStyle: React.CSSProperties = {
    fontFamily: F_MONO,
    fontWeight: 700,
    fontSize: 9.5,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#6F6F68',
    textDecoration: 'none',
    borderBottom: '1px solid #D9D6CB',
    paddingBottom: 3,
  };

  return (
    <div className={`mkt-home ${spaceGrotesk.variable}`} style={{ background: '#ECEAE3', minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteNav active="knowledge" />

      <main className="mkt-pad" style={{ padding: '140px 48px 90px', boxSizing: 'border-box' }}>
        <article style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Back to the library */}
          <a
            className="mkt-navlink"
            href="/knowledge"
            style={{
              fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.18em',
              textTransform: 'uppercase', display: 'inline-block', marginBottom: 48,
            }}
          >
            ← Back to the library
          </a>

          {/* Header */}
          <header style={{ marginBottom: 48, position: 'relative' }}>
            {/* The article's pressed flower, from the library's meadow. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flowerForSlug(post.slug)}
              alt=""
              aria-hidden="true"
              style={{ position: 'absolute', right: 0, top: -8, height: 72, width: 'auto', opacity: 0.85 }}
            />
            {kickerParts.length > 0 && (
              <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6F6F68', margin: '0 0 20px', paddingRight: 90 }}>
                {kickerParts.join(' · ')}
              </p>
            )}
            <h1
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(36px,5vw,64px)',
                lineHeight: 1.0, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 20px',
              }}
            >
              {post.title}
            </h1>
            {post.excerpt && (
              <p style={{ fontFamily: F_BODY, fontSize: 17, lineHeight: 1.6, color: '#6F6F68', margin: '0 0 22px', maxWidth: '58ch' }}>
                {post.excerpt}
              </p>
            )}
            {post.tags.length > 0 && (
              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: F_MONO, fontWeight: 700,
                  fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
                }}
              >
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid #D9D6CB', color: '#6F6F68' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Featured image (only when this is not a video post) */}
          {post.featured_image_url && post.content_type !== 'video' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.featured_image_url}
              alt={post.title}
              style={{
                width: '100%', height: 'auto', borderRadius: 6, border: '1px solid #D9D6CB',
                marginBottom: 48,
              }}
            />
          )}

          {/* Video player */}
          {post.content_type === 'video' && post.video_url && (
            <div style={{ marginBottom: 48 }}>
              {getYouTubeEmbedUrl(post.video_url) ? (
                <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: 6, overflow: 'hidden', border: '1px solid #D9D6CB' }}>
                  <iframe
                    src={getYouTubeEmbedUrl(post.video_url)!}
                    title={post.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
              ) : (
                <video
                  controls
                  style={{ width: '100%', height: 'auto', borderRadius: 6, background: '#1A1B1D', border: '1px solid #D9D6CB' }}
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
              className="mkt-article"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'iframe', 'video', 'source', 'h1', 'h2']),
                allowedAttributes: {
                  ...sanitizeHtml.defaults.allowedAttributes,
                  img: ['src', 'alt', 'width', 'height', 'class', 'loading'],
                  iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title', 'class'],
                  video: ['src', 'controls', 'poster', 'class', 'width', 'height'],
                  source: ['src', 'type'],
                  a: ['href', 'rel', 'class'],
                  '*': ['class', 'id'],
                },
                allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com'],
                transformTags: {
                  'a': sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
                },
              }) }}
            />
          )}

          {/* Share row */}
          <footer style={{ marginTop: 64, borderTop: '1px solid #D9D6CB', paddingTop: 26, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px 24px' }}>
            <span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1A1B1D' }}>
              Pass it on
            </span>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mkt-scanlink"
              style={shareLinkStyle}
            >
              LinkedIn
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mkt-scanlink"
              style={shareLinkStyle}
            >
              X
            </a>
            <a
              href={`mailto:?subject=${shareText}&body=${shareUrl}`}
              className="mkt-scanlink"
              style={shareLinkStyle}
            >
              Email
            </a>
          </footer>
        </article>
      </main>

      <SiteFooter
        platformLinksHref="/platform#modules"
        companyLinks={[
          { label: 'Manifesto', href: '/#manifesto' },
          { label: "Buyer's Guide", href: '/best-sustainability-platform-drinks-industry' },
          { label: 'Knowledge', href: '/knowledge' },
          { label: 'Contact', href: '/contact' },
        ]}
      />

      <CursorCreatures />
    </div>
  );
}
