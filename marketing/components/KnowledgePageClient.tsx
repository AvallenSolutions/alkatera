'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Play, ArrowUpRight, ArrowRight, Clock, Tag } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type ContentType = 'article' | 'video' | 'quote' | 'tutorial';

interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  slug?: string;
  excerpt?: string;
  tags: string[];
  readTime?: string;
  image?: string;
  author?: string;
}

// Shape of a published post as fetched from Supabase (server) or /api/blog (client).
export interface KnowledgePost {
  id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  tags?: string[];
  read_time?: string;
  featured_image_url?: string;
  author_name?: string;
  content_type?: ContentType;
  published_at?: string;
}

function toContentItem(post: KnowledgePost): ContentItem {
  return {
    id: post.id,
    type: post.content_type || 'article',
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    tags: post.tags || [],
    readTime: post.read_time,
    image: post.featured_image_url,
    author: post.author_name,
  };
}

const ContentCard = ({ item, index }: { item: ContentItem; index: number }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'video': return Play;
      case 'quote': return Tag;
      default: return FileText;
    }
  };

  const Icon = getIcon();

  if (item.type === 'quote') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 }}
        className="group relative p-12 bg-[#2B46C0] text-[#F2F1EA] rounded-[6px] transition-all duration-500"
      >
        <Icon className="w-8 h-8 text-[#F2F1EA] mb-6 opacity-60" />
        <blockquote className="text-3xl md:text-4xl font-display font-bold tracking-[-0.035em] leading-tight mb-6">
          &quot;{item.title}&quot;
        </blockquote>
        <p className="font-mono text-xs text-[#F2F1EA]/70 uppercase tracking-[0.22em]">by {item.author}</p>
      </motion.div>
    );
  }

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="group relative bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] hover:border-[#2B46C0] transition-all duration-500 overflow-hidden cursor-pointer h-full"
    >
      {item.image && (
        <div className="relative h-64 overflow-hidden">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
          />
          {item.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-[#1A1B1D] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-[#F2F1EA] fill-[#F2F1EA] ml-1" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-8">
        <div className="flex items-center gap-4 mb-4">
          <Icon className="w-5 h-5 text-[#2B46C0]" />
          {item.readTime && (
            <div className="flex items-center gap-2 text-[#6F6F68] text-xs font-mono">
              <Clock className="w-4 h-4" />
              <span>{item.readTime}</span>
            </div>
          )}
        </div>

        <h3 className="text-2xl font-display font-semibold tracking-[-0.02em] text-[#1A1B1D] mb-3 group-hover:text-[#2B46C0] transition-colors">
          {item.title}
        </h3>

        {item.excerpt && (
          <p className="text-[#6F6F68] text-sm leading-relaxed mb-6">
            {item.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-3 flex-wrap">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#6F6F68]"
              >
                {tag}
              </span>
            ))}
          </div>

          <ArrowRight className="w-5 h-5 text-[#6F6F68] group-hover:text-[#2B46C0] group-hover:translate-x-2 transition-all" />
        </div>
      </div>
    </motion.div>
  );

  // Wrap in Link if item has a slug (from database)
  if (item.slug) {
    return <Link href={`/blog/${item.slug}`}>{cardContent}</Link>;
  }

  return cardContent;
};

export function KnowledgePageClient({ initialPosts = [] }: { initialPosts?: KnowledgePost[] }) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  // Seed from server-fetched posts so the post list (and its crawlable
  // /blog/[slug] links) is present in the first-paint HTML for indexing.
  const [blogPosts, setBlogPosts] = useState<ContentItem[]>(() => initialPosts.map(toContentItem));
  const [isLoading, setIsLoading] = useState(initialPosts.length === 0);

  // Client-side refresh so the list stays current between ISR revalidations.
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/blog?status=published&limit=100');
        const data = await response.json();

        if (response.ok && data.posts) {
          setBlogPosts(data.posts.map(toContentItem));
        }
      } catch (error) {
        console.error('Error fetching blog posts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Use only blog posts from CMS
  const allContent = blogPosts;

  const allTags = ['all', ...Array.from(new Set(allContent.flatMap(item => item.tags)))];

  const filteredContent = activeFilter === 'all'
    ? allContent
    : allContent.filter(item => item.tags.includes(activeFilter));

  return (
    <div className="bg-[#ECEAE3] min-h-screen text-[#1A1B1D] selection:bg-[#1A1B1D] selection:text-[#F2F1EA] relative">
      {/* Fixed background layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/images/blueberry-field.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-multiply grayscale"
        />
      </div>

      <div className="relative z-10">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 md:px-20 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <p className="font-mono font-bold text-[10px] md:text-xs uppercase tracking-[0.22em] text-[#2B46C0] mb-6">
              The library
            </p>
            <h1 className="font-display font-bold tracking-[-0.035em] text-5xl md:text-8xl mb-8 leading-[0.95]">
              Knowledge for the <br />
              <span className="text-[#2B46C0]">conscious producer.</span>
            </h1>
            <p className="text-[#6F6F68] text-sm md:text-base max-w-2xl leading-relaxed">
              Insights, guides, and perspectives on building a regenerative drinks brand. From carbon accounting to supply chain strategy, explore the science and stories behind sustainable growth.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filters */}
      <section className="px-6 md:px-20 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-3 flex-wrap border-t border-[#D9D6CB] pt-8">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveFilter(tag)}
                className={cn(
                  "px-4 py-2 font-mono font-bold text-xs uppercase tracking-[0.22em] rounded-full transition-all duration-300",
                  activeFilter === tag
                    ? "bg-[#1A1B1D] text-[#F2F1EA]"
                    : "bg-[#F2F1EA] border border-[#D9D6CB] text-[#6F6F68] hover:border-[#2B46C0] hover:text-[#2B46C0]"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <section className="px-6 md:px-20 pb-32">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#2B46C0] border-t-transparent"></div>
              <p className="mt-4 text-[#6F6F68] font-mono text-sm">Loading knowledge...</p>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-20 border border-[#D9D6CB] bg-[#F2F1EA] rounded-[6px]">
              <FileText className="w-16 h-16 text-[#6F6F68] mx-auto mb-4" />
              <h3 className="text-2xl font-display font-semibold tracking-[-0.02em] mb-2">No content yet.</h3>
              <p className="text-[#6F6F68] font-mono text-sm">
                {activeFilter === 'all'
                  ? 'Blog posts will appear here once published.'
                  : `No content found with tag "${activeFilter}".`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContent.map((item, index) => (
                <ContentCard key={item.id} item={item} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
      </div>
    </div>
  );
}
