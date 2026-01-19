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

const CONTENT_ITEMS: ContentItem[] = [
  // Placeholder content removed - only showing blog posts from CMS
];

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
        className="group relative p-12 bg-gradient-to-br from-[#ccff00]/10 to-transparent border border-[#ccff00]/20 hover:border-[#ccff00] transition-all duration-500"
      >
        <Icon className="w-8 h-8 text-[#ccff00] mb-6 opacity-60" />
        <blockquote className="text-3xl md:text-4xl font-serif italic leading-tight mb-6">
          &quot;{item.title}&quot;
        </blockquote>
        <p className="font-mono text-xs text-gray-400 uppercase tracking-widest">— {item.author}</p>
      </motion.div>
    );
  }

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="group relative bg-[#0a0a0a] border border-white/10 hover:border-[#ccff00]/50 transition-all duration-500 overflow-hidden cursor-pointer h-full"
    >
      {item.image && (
        <div className="relative h-64 overflow-hidden">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
          {item.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-[#ccff00] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-black fill-black ml-1" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-8">
        <div className="flex items-center gap-4 mb-4">
          <Icon className="w-5 h-5 text-[#ccff00]" />
          {item.readTime && (
            <div className="flex items-center gap-2 text-gray-400 text-xs font-mono">
              <Clock className="w-4 h-4" />
              <span>{item.readTime}</span>
            </div>
          )}
        </div>

        <h3 className="text-2xl font-serif mb-3 group-hover:text-[#ccff00] transition-colors">
          {item.title}
        </h3>

        {item.excerpt && (
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            {item.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono uppercase tracking-widest px-3 py-1 bg-white/5 border border-white/10 text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>

          <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-[#ccff00] group-hover:translate-x-2 transition-all" />
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

export default function KnowledgePage() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [blogPosts, setBlogPosts] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch blog posts from API
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/blog?status=published&limit=100');
        const data = await response.json();

        if (response.ok && data.posts) {
          // Transform API posts to ContentItem format
          const transformedPosts: ContentItem[] = data.posts.map((post: any) => ({
            id: post.id,
            type: post.content_type || 'article',
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            tags: post.tags || [],
            readTime: post.read_time,
            image: post.featured_image_url,
            author: post.author_name,
          }));

          setBlogPosts(transformedPosts);
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
    <div className="bg-[#050505] min-h-screen text-white selection:bg-[#ccff00] selection:text-black">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 md:px-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <h1 className="font-serif text-5xl md:text-8xl mb-8 leading-[0.9]">
              Knowledge for the <br />
              <span className="text-[#ccff00] italic">Conscious Producer</span>
            </h1>
            <p className="font-mono text-gray-400 text-sm md:text-base max-w-2xl leading-relaxed">
              Insights, guides, and perspectives on building a regenerative drinks brand. From carbon accounting to supply chain strategy, explore the science and stories behind sustainable growth.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filters */}
      <section className="px-6 md:px-20 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-3 flex-wrap border-t border-white/10 pt-8">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveFilter(tag)}
                className={cn(
                  "px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all duration-300",
                  activeFilter === tag
                    ? "bg-[#ccff00] text-black"
                    : "bg-white/5 border border-white/10 text-gray-400 hover:border-[#ccff00] hover:text-white"
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
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ccff00] border-t-transparent"></div>
              <p className="mt-4 text-gray-400 font-mono text-sm">Loading knowledge...</p>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-20 border border-white/10 bg-white/5">
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-2xl font-serif mb-2">No content yet</h3>
              <p className="text-gray-400 font-mono text-sm">
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
  );
}
