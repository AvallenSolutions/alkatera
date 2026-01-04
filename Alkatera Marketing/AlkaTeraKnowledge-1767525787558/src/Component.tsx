import React, { useState, useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { Menu, X, Play, FileText, ArrowUpRight, Search, Tag, Clock, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Shared Navigation ---
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
      <div className="z-50"><Logo /></div>
      <div className="hidden md:flex items-center gap-8 font-mono text-xs tracking-widest uppercase">
        {['Platform', 'Manifesto', 'Impact', 'Knowledge'].map((item) => (
          <a key={item} href="#" className="hover:opacity-50 transition-opacity duration-300">{item}</a>
        ))}
        <button className="border border-white px-6 py-2 rounded-full hover:bg-white hover:text-black transition-colors duration-300">Get Access</button>
      </div>
      <button className="md:hidden z-50" onClick={() => setIsOpen(!isOpen)}>{isOpen ? <X /> : <Menu />}</button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed inset-0 bg-[#0a0a0a] z-40 flex flex-col justify-center items-center gap-8 md:hidden"
          >
            {['Platform', 'Manifesto', 'Impact', 'Knowledge'].map((item) => (
              <a key={item} href="#" className="text-4xl font-serif hover:text-[#ccff00] transition-colors">{item}</a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Data Types & Mock Data ---
type ContentType = 'article' | 'video' | 'quote';

interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  excerpt?: string;
  tags: string[];
  readTime?: string;
  image?: string;
  author?: string;
}

const MOCK_CONTENT: ContentItem[] = [
  {
    id: '1',
    type: 'article',
    title: 'The Future of Glass: Lightweighting Premium Spirits',
    excerpt: 'Why shedding grams from your bottle might be the radical innovation the industry needs to cut carbon by 40%.',
    tags: ['Strategy', 'Packaging'],
    readTime: '5 min read',
    author: 'Dr. Elena S.'
  },
  {
    id: '2',
    type: 'video',
    title: 'Distillery Tour: Tracking Water Usage',
    excerpt: 'A 3-minute guide to setting up your first water footprint audit in the mash house using AlkaTera sensors.',
    tags: ['Tutorial', 'Water'],
    readTime: '3:24',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2670&auto=format&fit=crop'
  },
  {
    id: '3',
    type: 'quote',
    title: "Sustainability isn't a department. It's the operating system.",
    tags: ['Manifesto'],
    author: 'AlkaTera CEO'
  },
  {
    id: '4',
    type: 'article',
    title: 'Decarbonizing the Supply Chain: From Grain to Glass',
    excerpt: 'How to engage farmers and glass manufacturers without losing contracts. A practical guide for procurement.',
    tags: ['Carbon', 'Supply Chain'],
    readTime: '8 min read'
  },
  {
    id: '5',
    type: 'video',
    title: 'B-Corp Certification: The Drinks Industry Roadmap',
    excerpt: 'Automating your B-Impact Assessment data collection for breweries and distilleries.',
    tags: ['B-Corp', 'Strategy'],
    readTime: '12:05',
    image: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2574&auto=format&fit=crop'
  },
  {
    id: '6',
    type: 'article',
    title: 'Water Stewardship in Wine Production',
    excerpt: 'Moving beyond efficiency to watershed health restoration in drought-prone vineyards.',
    tags: ['Water', 'Impact'],
    readTime: '6 min read'
  },
  {
    id: '7',
    type: 'quote',
    title: "We don't need better stories. We need better data.",
    tags: ['Data'],
    author: 'Head of Product'
  },
  {
    id: '8',
    type: 'article',
    title: 'Regenerative Agriculture for Barley & Hops',
    excerpt: 'The soil health revolution happening in breweries across the Pacific Northwest.',
    tags: ['Agriculture', 'Ingredients'],
    readTime: '10 min read'
  },
  {
    id: '9',
    type: 'video',
    title: 'Anti-Greenwashing for Drinks Marketing',
    tags: ['Compliance', 'Marketing'],
    readTime: '45:00',
    image: 'https://images.unsplash.com/photo-1628359355624-855775b5c9c8?q=80&w=2670&auto=format&fit=crop'
  },
];

// --- UI Components ---

const FilterBubble = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-6 py-2 rounded-full border text-sm font-mono uppercase tracking-wider transition-all duration-300",
      isActive 
        ? "bg-[#ccff00] border-[#ccff00] text-black" 
        : "bg-transparent border-gray-800 text-gray-400 hover:border-[#ccff00] hover:text-[#ccff00]"
    )}
  >
    {label}
  </button>
);

const ArticleCard = ({ item }: { item: ContentItem }) => (
  <div className="group relative bg-[#111] border border-gray-800 p-8 hover:border-[#ccff00] transition-colors duration-500 aspect-[4/5] flex flex-col justify-between cursor-pointer overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
      <ArrowUpRight className="text-[#ccff00]" />
    </div>
    
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {item.tags.map(tag => (
          <span key={tag} className="text-[10px] font-mono uppercase tracking-widest text-gray-500 border border-gray-800 px-2 py-1 rounded">{tag}</span>
        ))}
      </div>
      <h3 className="text-3xl font-serif text-white group-hover:text-[#ccff00] transition-colors duration-300 leading-tight">
        {item.title}
      </h3>
    </div>

    <div className="space-y-4">
      <p className="text-gray-400 text-sm leading-relaxed line-clamp-3 font-sans">
        {item.excerpt}
      </p>
      <div className="flex items-center gap-2 text-xs font-mono text-gray-600 uppercase tracking-widest">
        <Clock size={12} />
        <span>{item.readTime}</span>
      </div>
    </div>
  </div>
);

const VideoCard = ({ item }: { item: ContentItem }) => (
  <div className="group relative bg-[#111] border border-gray-800 aspect-square overflow-hidden cursor-pointer">
    {/* Background Image */}
    <div 
      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-40"
      style={{ backgroundImage: `url(${item.image})` }}
    />
    
    {/* Overlay Content */}
    <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
      <div className="flex justify-between items-start">
        <div className="bg-black/50 backdrop-blur-sm px-3 py-1 rounded border border-white/10 text-[10px] font-mono text-white uppercase tracking-widest">
          Video
        </div>
        <div className="w-12 h-12 rounded-full bg-[#ccff00] flex items-center justify-center transform translate-y-[-10px] translate-x-[10px] opacity-0 group-hover:translate-y-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
          <Play className="text-black fill-black ml-1" size={20} />
        </div>
      </div>
      
      <div>
        <h3 className="text-2xl font-serif text-white mb-2 leading-none">{item.title}</h3>
        <span className="text-xs font-mono text-[#ccff00] uppercase tracking-widest">{item.readTime}</span>
      </div>
    </div>
  </div>
);

const QuoteCard = ({ item }: { item: ContentItem }) => (
  <div className="bg-[#ccff00] p-8 aspect-square flex flex-col justify-center items-center text-center cursor-pointer hover:scale-[0.98] transition-transform duration-300">
    <div className="text-6xl font-serif text-black mb-4">"</div>
    <h3 className="text-2xl md:text-3xl font-serif text-black leading-tight mb-6">
      {item.title}
    </h3>
    <div className="w-12 h-[1px] bg-black mb-4" />
    <span className="font-mono text-xs uppercase tracking-widest text-black/60">
      {item.author}
    </span>
  </div>
);

// --- Footer Component ---

const Footer = () => (
  <footer className="bg-[#050505] text-white py-20 px-6 border-t border-[#1a1a1a] relative z-20">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
      <div className="flex flex-col gap-6">
        <div>
          <Logo className="mb-6" />
          <p className="font-mono text-xs text-gray-500 max-w-xs uppercase tracking-widest leading-relaxed">
            Engineering the future of<br />ecological intelligence.
          </p>
        </div>
      </div>
      
      <div className="w-full md:w-[400px]">
        <h4 className="font-serif text-xl mb-4 text-[#ccff00]">Stay updated.</h4>
        <p className="font-mono text-xs text-gray-400 mb-6 uppercase tracking-widest">Sign up for early access to the platform.</p>
        <form 
          className="flex flex-col gap-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="relative group">
            <input 
              type="email" 
              placeholder="EMAIL ADDRESS" 
              className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-3 text-xs font-mono focus:outline-none focus:border-[#ccff00] transition-colors group-hover:border-[#333]"
            />
          </div>
          <button className="bg-[#ccff00] text-black font-mono text-[10px] font-bold uppercase tracking-[0.2em] py-3 rounded-lg hover:bg-white transition-colors flex items-center justify-center gap-2">
            Register for Early Access <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-[#1a1a1a] flex justify-between font-mono text-[10px] text-gray-600 uppercase">
      <span>© 2026 AlkaTera Ltd.</span>
      <span>System Status: Operational</span>
    </div>
  </footer>
);

// --- Stream Layout ---
// A Parallax masonry-style layout

const ParallaxColumn = ({ items, yOffset = 0, speed = 1 }: { items: ContentItem[], yOffset?: number, speed?: number }) => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, -100 * speed]);
  
  return (
    <motion.div 
      style={{ y }} 
      className="flex flex-col gap-8 w-full"
    >
      {/* Spacer for offset start */}
      <div style={{ height: yOffset }} className="hidden md:block" />
      
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: i * 0.1 }}
        >
          {item.type === 'article' && <ArticleCard item={item} />}
          {item.type === 'video' && <VideoCard item={item} />}
          {item.type === 'quote' && <QuoteCard item={item} />}
        </motion.div>
      ))}
    </motion.div>
  );
};

export function AlkaTeraKnowledge() {
  const [activeFilter, setActiveFilter] = useState('All');
  
  // Distribute items into 3 columns for the stream
  const columns = useMemo(() => {
    const cols: ContentItem[][] = [[], [], []];
    // Simple round-robin distribution for demo
    // In a real app, you might filter and re-distribute
    const filtered = activeFilter === 'All' 
      ? MOCK_CONTENT 
      : MOCK_CONTENT.filter(item => item.tags.includes(activeFilter) || item.type === activeFilter.toLowerCase());

    filtered.forEach((item, i) => {
      cols[i % 3].push(item);
    });
    return cols;
  }, [activeFilter]);

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative">
      <Navigation />
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <img 
          src="https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2940&auto=format&fit=crop"
          alt="Mountain Lake"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#050505]/90 to-[#050505]" />
        
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#0044ff] rounded-full blur-[150px] opacity-[0.08]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#ccff00] rounded-full blur-[150px] opacity-[0.05]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      {/* Header Section */}
      <div className="relative z-10 pt-32 pb-16 px-6 md:px-12 max-w-screen-2xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <h1 className="text-6xl md:text-8xl font-serif text-white mb-6 tracking-tight">
            Knowledge <span className="italic text-[#ccff00]">Stream</span>
          </h1>
          <p className="font-mono text-gray-400 max-w-xl leading-relaxed">
            Insights from the edge of sustainability science, strategy, and technology. 
            Curated for the drinks industry.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div 
          className="flex flex-wrap gap-3 mb-24 sticky top-24 z-30 py-4 bg-gradient-to-b from-[#050505] to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {['All', 'Strategy', 'Water', 'Carbon', 'Video', 'Tutorial'].map(tag => (
            <FilterBubble 
              key={tag} 
              label={tag} 
              isActive={activeFilter === tag} 
              onClick={() => setActiveFilter(tag)} 
            />
          ))}
        </motion.div>

        {/* The Stream (Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32 min-h-screen">
          <ParallaxColumn items={columns[0]} speed={1.2} yOffset={0} />
          <ParallaxColumn items={columns[1]} speed={0.8} yOffset={100} />
          <ParallaxColumn items={columns[2]} speed={1.5} yOffset={50} />
        </div>
      </div>

      <Footer />

      {/* Infinite Loading Indicator (Visual Only) */}
      <div className="fixed bottom-12 left-0 right-0 flex justify-center pointer-events-none">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border border-gray-800 border-t-[#ccff00] rounded-full"
        />
      </div>
    </div>
  );
}