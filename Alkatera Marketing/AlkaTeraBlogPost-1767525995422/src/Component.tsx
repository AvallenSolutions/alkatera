import React, { useState, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, ChevronDown, ArrowRight, 
  Facebook, Twitter, Linkedin, Share2, Clock, Calendar
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Shared Components ---

const Logo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center select-none", className)}>
    <img 
      src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png" 
      alt="AlkaTera" 
      className="h-8 md:h-12 w-auto object-contain"
    />
  </div>
);

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center mix-blend-difference text-white">
      <div className="z-50">
        <Logo />
      </div>
      
      <div className="hidden md:flex items-center gap-8 font-mono text-xs tracking-widest uppercase">
        {['Platform', 'Manifesto', 'Impact', 'Knowledge'].map((item) => (
          <a key={item} href="#" className="hover:opacity-50 transition-opacity duration-300">
            {item}
          </a>
        ))}
        <button className="border border-white px-6 py-2 rounded-full hover:bg-white hover:text-black transition-colors duration-300">
          Get Access
        </button>
      </div>

      <button 
        className="md:hidden z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed inset-0 bg-[#0a0a0a] z-40 flex flex-col justify-center items-center gap-8 md:hidden"
          >
            {['Platform', 'Manifesto', 'Impact', 'Knowledge'].map((item) => (
              <a key={item} href="#" className="text-4xl font-serif hover:text-[#ccff00] transition-colors">
                {item}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Page Sections ---

const ArticleHeader = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 200]);
  
  return (
    <header className="relative h-[80vh] w-full overflow-hidden bg-[#050505] text-[#f0f0f0] flex items-center justify-center pt-20">
      {/* Hero Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=2574&auto=format&fit=crop"
          alt="Article Background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/50 to-[#050505]" />
      </div>

      <motion.div 
        style={{ y }}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex justify-center gap-4 mb-8 font-mono text-xs uppercase tracking-widest text-[#ccff00]">
            <span>Case Study</span>
            <span>•</span>
            <span>Water Stewardship</span>
            <span>•</span>
            <span>5 min read</span>
          </div>
          
          <h1 className="font-serif text-4xl md:text-7xl leading-[1.1] mb-8">
            Reducing water intensity in single malt production
          </h1>
          
          <div className="flex justify-center items-center gap-4 text-sm text-gray-400 font-mono uppercase tracking-widest">
            <span>Highland Distillers</span>
            <span className="w-1 h-1 bg-gray-600 rounded-full" />
            <span>Oct 12, 2023</span>
          </div>
        </motion.div>
      </motion.div>
    </header>
  );
};

const ArticleContent = () => {
  return (
    <section className="py-20 px-6 md:px-12 bg-[#050505] text-gray-300 relative">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Sidebar / Metadata */}
        <aside className="lg:col-span-3 order-2 lg:order-1">
          <div className="sticky top-32 space-y-12 border-l border-[#222] pl-6">
            <div>
              <h4 className="font-mono text-xs text-[#ccff00] uppercase tracking-widest mb-4">Key Stats</h4>
              <ul className="space-y-6">
                <li>
                  <span className="block text-3xl font-bold text-white">-42%</span>
                  <span className="text-xs font-mono uppercase text-gray-500">Water Usage</span>
                </li>
                <li>
                  <span className="block text-3xl font-bold text-white">1.2M</span>
                  <span className="text-xs font-mono uppercase text-gray-500">Litres Saved / Year</span>
                </li>
                <li>
                  <span className="block text-3xl font-bold text-white">100%</span>
                  <span className="text-xs font-mono uppercase text-gray-500">Water Returned</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-xs text-[#ccff00] uppercase tracking-widest mb-4">Share</h4>
              <div className="flex gap-4">
                <button className="p-2 border border-[#333] rounded-full hover:border-white transition-colors">
                  <Linkedin className="w-4 h-4" />
                </button>
                <button className="p-2 border border-[#333] rounded-full hover:border-white transition-colors">
                  <Twitter className="w-4 h-4" />
                </button>
                <button className="p-2 border border-[#333] rounded-full hover:border-white transition-colors">
                  <Facebook className="w-4 h-4" />
                </button>
                <button className="p-2 border border-[#333] rounded-full hover:border-white transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-mono text-xs text-[#ccff00] uppercase tracking-widest mb-4">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {['Sustainability', 'Water', 'Distilling', 'Innovation'].map(tag => (
                  <span key={tag} className="text-xs border border-[#333] px-2 py-1 rounded hover:border-white transition-colors cursor-pointer">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Article Content */}
        <article className="lg:col-span-8 order-1 lg:order-2 prose prose-invert prose-lg max-w-none">
          <p className="lead text-xl md:text-2xl font-serif text-white mb-8">
            Water is the lifeblood of any distillery. For Highland Distillers, situated on the banks of the River Spey, protecting this resource wasn't just about compliance—it was about survival.
          </p>

          <p>
            The whisky industry has historically been water-intensive. From cooling mashing tuns to dilution for bottling, every litre of spirit produced could require up to 40 litres of water. In an era of climate volatility, this ratio is no longer sustainable. Highland Distillers partnered with AlkaTera to completely overhaul their water management strategy.
          </p>

          <h3 className="text-[#ccff00] font-sans mt-12 mb-6">The Challenge</h3>
          <p>
            Despite sitting next to a major river, the distillery faced seasonal abstraction limits during increasingly dry summers. Production had to be curtailed in 2018 and 2022 due to low water levels. The goal was simple but ambitious: decouple production growth from water consumption.
          </p>

          <figure className="my-12 border border-[#222] rounded-xl overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1516551266637-666f6735b70b?q=80&w=2560&auto=format&fit=crop" 
              alt="Distillery equipment" 
              className="w-full h-auto"
            />
            <figcaption className="p-4 text-sm font-mono text-gray-500 text-center border-t border-[#222]">
              Figure 1. New closed-loop cooling systems installed in the mash house.
            </figcaption>
          </figure>

          <h3 className="text-[#ccff00] font-sans mt-12 mb-6">The Solution</h3>
          <p>
            Using AlkaTera's <strong>Liquid & Packaging DNA</strong> module, we first mapped the water footprint of every process unit. The data revealed that cooling water accounted for 70% of total abstraction, and much of it was returned to the river warmer than optimal, affecting local biodiversity.
          </p>

          <p>
            The intervention strategy involved three phases:
          </p>
          <ul className="list-disc pl-6 space-y-2 marker:text-[#ccff00]">
            <li><strong>Phase 1:</strong> Installation of a closed-loop cooling system to recirculate water.</li>
            <li><strong>Phase 2:</strong> Implementation of Anaerobic Digestion to treat wastewater on-site, turning organic load into biogas.</li>
            <li><strong>Phase 3:</strong> Riverbank restoration upstream to improve water retention in the catchment area.</li>
          </ul>

          <blockquote className="border-l-4 border-[#ccff00] pl-6 my-12 italic text-2xl font-serif text-white">
            "We didn't just save water; we saved energy. The heat recovered from the cooling loop now pre-heats our boiler feed, cutting our gas usage by 15%."
            <footer className="text-sm font-mono text-gray-500 mt-4 not-italic uppercase tracking-widest">
              — James McPherson, Production Director
            </footer>
          </blockquote>

          <h3 className="text-[#ccff00] font-sans mt-12 mb-6">The Impact</h3>
          <p>
            Twelve months after full implementation, the results exceeded expectations. Abstraction reduced by 42%, effectively drought-proofing the distillery for the foreseeable future. Moreover, the thermal discharge issue was eliminated, helping local salmon populations recover.
          </p>
          
          <div className="bg-[#111] border border-[#222] p-8 rounded-xl mt-12">
            <h4 className="font-serif text-xl text-white mb-4">Ready to analyze your water footprint?</h4>
            <p className="mb-6 text-sm">Discover how our platform can help you optimise resource usage and build resilience.</p>
            <button className="text-[#ccff00] border border-[#ccff00] px-6 py-3 rounded-full hover:bg-[#ccff00] hover:text-black transition-all font-mono text-xs uppercase tracking-widest">
              View Water Module
            </button>
          </div>
        </article>
      </div>
    </section>
  );
};

const RelatedArticles = () => {
  const articles = [
    {
      title: "Biodiversity mapping for sustainable agave farming",
      category: "Supply Chain",
      image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=2560&auto=format&fit=crop"
    },
    {
      title: "Closing the loop on packaging waste",
      category: "Circular Economy",
      image: "https://images.unsplash.com/photo-1559526323-cb2f2fe2591b?q=80&w=2670&auto=format&fit=crop"
    },
    {
      title: "Soil regeneration through cover cropping",
      category: "Regenerative Ag",
      image: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=2670&auto=format&fit=crop"
    }
  ];

  return (
    <section className="py-20 px-6 md:px-12 bg-[#0a0a0a] border-t border-[#222]">
      <div className="max-w-6xl mx-auto">
        <h3 className="font-serif text-3xl text-white mb-12">Related Stories</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.map((article, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="aspect-[4/3] overflow-hidden rounded-lg mb-6 relative">
                <img 
                  src={article.image} 
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                />
              </div>
              <span className="text-[#ccff00] font-mono text-xs uppercase tracking-widest mb-2 block">
                {article.category}
              </span>
              <h4 className="text-white font-serif text-xl group-hover:underline decoration-[#ccff00] underline-offset-4">
                {article.title}
              </h4>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-black text-white py-20 px-6 md:px-20 border-t border-white/10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <div className="mb-6">
            <Logo />
          </div>
          <p className="text-gray-500 font-mono text-sm">
            © 2026 Alkatera Ltd
          </p>
        </div>
        
        <div>
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Platform</h4>
          <ul className="space-y-4 text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors">Carbon Analytics</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Water Footprint</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Supply Chain</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Reporting</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Company</h4>
          <ul className="space-y-4 text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors">Platform</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Manifesto</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Knowledge</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Newsletter</h4>
          <div className="flex border-b border-white/30 pb-2">
            <input 
              type="email" 
              placeholder="Email Address" 
              className="bg-transparent outline-none w-full placeholder:text-gray-600 font-mono text-sm"
            />
            <button className="text-[#ccff00] uppercase text-xs font-bold hover:text-white">Submit</button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export function AlkaTeraBlogPost() {
  return (
    <div className="bg-[#050505] min-h-screen text-white selection:bg-[#ccff00] selection:text-black relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#050505]" />
      </div>

      <div className="relative z-10">
        <Navigation />
        <ArticleHeader />
        <ArticleContent />
        <RelatedArticles />
        <Footer />
      </div>
    </div>
  );
}

export default AlkaTeraBlogPost;
