'use client';

import { motion } from 'framer-motion';
import { Calendar, User, Clock, ArrowLeft } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import Link from 'next/link';

export default function BlogPage() {
  return (
    <div className="bg-[#050505] min-h-screen text-white selection:bg-[#ccff00] selection:text-black">
      <Navigation />

      <article className="relative pt-32 pb-20 px-6 md:px-20">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-[#ccff00] transition-colors mb-12 font-mono text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Knowledge
          </Link>

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex gap-3 mb-6">
              <span className="text-[10px] font-mono uppercase tracking-widest px-3 py-1 bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00]">
                Strategy
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest px-3 py-1 bg-white/5 border border-white/10 text-gray-400">
                Sustainability
              </span>
            </div>

            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl mb-8 leading-[1.1]">
              The Future of Sustainability Reporting in the Drinks Industry
            </h1>

            <div className="flex flex-wrap gap-6 text-sm text-gray-400 font-mono border-t border-white/10 pt-6">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Dr. Elena Santiago</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>January 15, 2026</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>8 min read</span>
              </div>
            </div>
          </motion.header>

          {/* Featured Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative aspect-[16/9] mb-16 overflow-hidden"
          >
            <img
              src="https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=2874&auto=format&fit=crop"
              alt="Sustainability reporting"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="prose prose-invert prose-lg max-w-none"
          >
            <p className="text-xl text-gray-300 leading-relaxed mb-8 border-l-4 border-[#ccff00] pl-6">
              The drinks industry stands at a crossroads. As consumer demand for transparency grows and regulatory frameworks tighten, traditional approaches to sustainability reporting are no longer sufficient.
            </p>

            <h2 className="font-serif text-3xl md:text-4xl mt-16 mb-6 text-white">
              The Challenge of Modern Reporting
            </h2>

            <p className="text-gray-300 leading-relaxed mb-6">
              For decades, sustainability has been relegated to annual PDF reports that few people read and fewer understand. But the landscape is changing rapidly. The European Union&apos;s CSRD (Corporate Sustainability Reporting Directive) and the UK&apos;s Green Claims Code are just the beginning of a new era of accountability.
            </p>

            <p className="text-gray-300 leading-relaxed mb-6">
              Today&apos;s drinks brands must navigate an increasingly complex web of requirements: carbon footprinting, water stewardship, biodiversity impact, and supply chain transparency. The question is no longer <em>if</em> you should measure your impact, but <em>how</em> you can do it efficiently and credibly.
            </p>

            <h2 className="font-serif text-3xl md:text-4xl mt-16 mb-6 text-white">
              From Compliance to Competitive Advantage
            </h2>

            <p className="text-gray-300 leading-relaxed mb-6">
              The most forward-thinking brands are discovering that sustainability reporting isn&apos;t just about compliance—it&apos;s about storytelling. When you can quantify your impact with precision, you unlock new marketing narratives, strengthen retail relationships, and attract conscious consumers willing to pay a premium.
            </p>

            <blockquote className="border-l-4 border-[#ccff00] pl-8 my-12 py-4 text-2xl font-serif italic text-gray-200">
              &quot;The brands that win in the next decade won&apos;t be those with the lowest carbon footprint—they&apos;ll be the ones who can prove it.&quot;
            </blockquote>

            <h2 className="font-serif text-3xl md:text-4xl mt-16 mb-6 text-white">
              The Technology Gap
            </h2>

            <p className="text-gray-300 leading-relaxed mb-6">
              Traditional sustainability consulting relies on manual data collection, spreadsheets, and estimates. This approach is not only time-consuming and expensive—it&apos;s also error-prone. In an era where greenwashing accusations can destroy brand value overnight, precision matters.
            </p>

            <p className="text-gray-300 leading-relaxed mb-6">
              Modern platforms like Alkatera are bridging this gap by automating data collection, applying industry-specific calculation methodologies, and providing audit trails that satisfy both regulators and retailers. The result is faster, cheaper, and more defensible reporting.
            </p>

            <h2 className="font-serif text-3xl md:text-4xl mt-16 mb-6 text-white">
              Looking Ahead
            </h2>

            <p className="text-gray-300 leading-relaxed mb-6">
              As we move into 2026, we expect to see three major shifts in how drinks brands approach sustainability:
            </p>

            <ul className="space-y-4 mb-6 ml-6">
              <li className="text-gray-300">
                <strong className="text-white">Product-level transparency:</strong> Moving beyond company-wide footprints to SKU-specific impact data
              </li>
              <li className="text-gray-300">
                <strong className="text-white">Real-time monitoring:</strong> Continuous tracking rather than annual snapshots
              </li>
              <li className="text-gray-300">
                <strong className="text-white">Supply chain integration:</strong> Direct data feeds from farmers, manufacturers, and logistics partners
              </li>
            </ul>

            <p className="text-gray-300 leading-relaxed mb-6">
              The drinks industry has always been defined by craftsmanship and terroir. As we face the climate crisis, that relationship with the land becomes even more critical. The brands that thrive will be those who can measure, manage, and communicate their environmental stewardship with the same precision they apply to their recipes.
            </p>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-20 p-12 bg-gradient-to-br from-[#ccff00]/10 to-transparent border border-[#ccff00]/20"
          >
            <h3 className="font-serif text-3xl mb-4">Ready to transform your sustainability reporting?</h3>
            <p className="text-gray-400 mb-8">
              See how Alkatera can automate your carbon footprint calculation and turn compliance into a competitive advantage.
            </p>
            <Link href="/getaccess" className="inline-block bg-[#ccff00] text-black px-8 py-4 rounded-full font-mono text-sm font-bold uppercase tracking-widest hover:bg-white transition-colors">
              Get Access
            </Link>
          </motion.div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
