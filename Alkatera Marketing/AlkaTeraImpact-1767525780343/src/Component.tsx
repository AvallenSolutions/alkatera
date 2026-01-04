/**
 * AlkaTera Impact component
 * Real-time sustainability metrics translated into living digital ecosystems.
 * Features generative visualizations for carbon, water, and waste metrics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Droplets, Wind, Recycle, Sprout, Leaf, BarChart3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Shared Components (Logo/Nav) ---
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

// --- Generative Art Components ---

// A simple fractal branch component
const FractalBranch = ({ 
  depth = 0, 
  maxDepth = 3, 
  angle = 0, 
  length = 60, 
  color = "#ccff00",
  delay = 0 
}: { 
  depth?: number; 
  maxDepth?: number; 
  angle?: number; 
  length?: number; 
  color?: string;
  delay?: number;
}) => {
  if (depth >= maxDepth) return null;

  const nextLength = length * 0.7;
  const nextDelay = delay + 0.2;

  return (
    <motion.g
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 1, delay, ease: "easeOut" }}
      style={{ originY: 1 }}
    >
      {/* Main Stem */}
      <line 
        x1="0" y1="0" x2="0" y2={-length} 
        stroke={color} 
        strokeWidth={maxDepth - depth} 
        strokeLinecap="round"
        className="opacity-60"
      />
      
      {/* Leaf at end of branch if it's a terminal branch */}
      {depth === maxDepth - 1 && (
        <motion.circle 
          cx="0" cy={-length} r="4" 
          fill={color} 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.8 }}
        />
      )}

      {/* Sub-branches */}
      <g transform={`translate(0, ${-length})`}>
        <g transform={`rotate(-25)`}>
          <FractalBranch depth={depth + 1} maxDepth={maxDepth} length={nextLength} color={color} delay={nextDelay} />
        </g>
        <g transform={`rotate(25)`}>
          <FractalBranch depth={depth + 1} maxDepth={maxDepth} length={nextLength} color={color} delay={nextDelay} />
        </g>
      </g>
    </motion.g>
  );
};

// Generative "Digital Tree"
const DigitalTree = ({ x, y, scale = 1, color = "#ccff00", delay = 0 }: { x: number, y: number, scale?: number, color?: string, delay?: number }) => {
  return (
    <div 
      className="absolute pointer-events-none" 
      style={{ left: x, top: y, transform: `scale(${scale})` }}
    >
      <svg width="200" height="200" viewBox="-100 -200 200 200" className="overflow-visible">
        <FractalBranch maxDepth={4} color={color} delay={delay} />
      </svg>
    </div>
  );
};

// Animated Water Ripple
const WaterRipple = ({ x, y, delay = 0 }: { x: number, y: number, delay?: number }) => {
  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y }}>
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ width: 0, height: 0, opacity: 0.8, borderWidth: 2 }}
          animate={{ 
            width: 100 + i * 50, 
            height: 100 + i * 50, 
            opacity: 0,
            borderWidth: 0
          }}
          transition={{ 
            duration: 4, 
            delay: delay + i * 0.5, 
            repeat: Infinity, 
            repeatDelay: 1 
          }}
          className="absolute rounded-full border border-[#00ccff] -translate-x-1/2 -translate-y-1/2"
        />
      ))}
    </div>
  );
};

// Animated Floating Particles (Waste/Reduction)
const FloatingParticle = ({ x, y, delay = 0 }: { x: number, y: number, delay?: number }) => {
  return (
    <motion.div
      initial={{ y: 0, opacity: 0, scale: 0 }}
      animate={{ 
        y: -150, 
        opacity: [0, 1, 0], 
        scale: [0.5, 1, 0.5],
        x: [0, Math.random() * 40 - 20, 0]
      }}
      transition={{ 
        duration: 3 + Math.random() * 2, 
        delay, 
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="absolute w-3 h-3 bg-white rounded-full blur-[1px] shadow-[0_0_10px_white]"
      style={{ left: x, top: y }}
    />
  );
};


// --- Main Page Content ---

export function AlkaTeraImpact() {
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const { scrollYProgress } = useScroll();

  // Parallax transforms for foreground content to slide OVER the background
  const yContentHero = useTransform(scrollYProgress, [0, 0.5], [0, -200]);
  const yContentStory = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacityHeroContent = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  // Subtle parallax for the background animations themselves (slower than content)
  const yBackgroundAnim = useTransform(scrollYProgress, [0, 1], [0, 150]);
  
  // Generate random positions for the "forest"
  const trees = useMemo(() => Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    x: `${Math.random() * 90 + 5}%`,
    y: `${Math.random() * 40 + 40}%`,
    scale: Math.random() * 0.5 + 0.5,
    delay: Math.random() * 2
  })), []);

  const ripples = useMemo(() => Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    x: `${Math.random() * 90 + 5}%`,
    y: `${Math.random() * 40 + 40}%`,
    delay: Math.random() * 3
  })), []);

  const particles = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    x: `${Math.random() * 90 + 5}%`,
    y: `${Math.random() * 40 + 40}%`,
    delay: Math.random() * 5
  })), []);

  return (
    <div className="relative min-h-screen w-full bg-[#050505] text-white overflow-x-hidden">
      <Navigation />
      
      {/* FIXED Background Layer: This stays visible as you scroll */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Base Background Grid & Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2574&auto=format&fit=crop" 
            alt="Nature Data" 
            className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-luminosity" 
          />
          <div className="absolute inset-0 bg-[#050505]/80" />
          <div className="absolute inset-0 opacity-10" 
            style={{ 
              backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', 
              backgroundSize: '80px 80px' 
            }} 
          />
        </div>

        {/* Generative Canvas Layer (Now fixed in the background) */}
        <motion.div style={{ y: yBackgroundAnim }} className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
          
          {/* Carbon Layer (Trees) */}
          <AnimatePresence>
            {(activeMetric === null || activeMetric === 'carbon') && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                {trees.map(tree => (
                  <DigitalTree key={tree.id} x={tree.x as any} y={tree.y as any} scale={tree.scale} delay={tree.delay} color="#ccff00" />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Water Layer (Ripples) */}
          <AnimatePresence>
            {(activeMetric === null || activeMetric === 'water') && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                {ripples.map(ripple => (
                  <WaterRipple key={ripple.id} x={ripple.x as any} y={ripple.y as any} delay={ripple.delay} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

           {/* Waste Layer (Particles) */}
           <AnimatePresence>
            {(activeMetric === null || activeMetric === 'waste') && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                {particles.map(particle => (
                  <FloatingParticle key={particle.id} x={particle.x as any} y={particle.y as any} delay={particle.delay} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* SCROLLABLE Foreground Content */}
      <div className="relative z-10">
        {/* --- HERO SECTION --- */}
        <section className="relative h-screen w-full flex flex-col justify-center items-center overflow-hidden">
          <motion.div style={{ y: yContentHero, opacity: opacityHeroContent }} className="relative text-center max-w-5xl mx-auto px-6 mt-20">
            <motion.h1 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="font-serif text-6xl md:text-9xl mb-6 leading-none"
            >
              Impact <span className="italic text-gray-500">Unfolds</span>
            </motion.h1>
            <p className="font-mono text-sm md:text-base tracking-widest text-gray-400 uppercase max-w-xl mx-auto mb-20">
              Real-time sustainability metrics translated into living digital ecosystems.
            </p>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {[
                { id: 'carbon', icon: Wind, label: "CO2 per Litre", value: "2.3kg", color: "text-[#ccff00]", border: "hover:border-[#ccff00]" },
                { id: 'water', icon: Droplets, label: "Hectolitres Saved", value: "8.5M", color: "text-[#00ccff]", border: "hover:border-[#00ccff]" },
                { id: 'waste', icon: Recycle, label: "Spent Grain Diverted", value: "94%", color: "text-white", border: "hover:border-white" },
              ].map((metric) => (
                <motion.button
                  key={metric.id}
                  onMouseEnter={() => setActiveMetric(metric.id)}
                  onMouseLeave={() => setActiveMetric(null)}
                  className={`group relative p-8 border border-white/10 bg-black/40 backdrop-blur-sm transition-all duration-500 ${metric.border} text-left overflow-hidden`}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 bg-current opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${metric.color}`} />
                  <metric.icon className={`w-8 h-8 mb-4 ${metric.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                  <div className="text-5xl font-sans font-bold mb-2 tracking-tighter">{metric.value}</div>
                  <div className="font-mono text-xs uppercase tracking-widest text-gray-400">{metric.label}</div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </section>

        {/* --- STORY SECTION --- */}
        <section className="relative py-32 px-6 z-20 overflow-hidden bg-gradient-to-b from-transparent via-[#050505]/60 to-[#050505]">
          <motion.div style={{ y: yContentStory }} className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 border-b border-white/10 pb-8">
            <h2 className="text-4xl md:text-6xl font-serif max-w-2xl">
              From Compliance to <br/> <span className="text-[#ccff00] italic">Regeneration</span>
            </h2>
            <p className="font-mono text-sm text-gray-400 mt-6 md:mt-0 max-w-md">
              See how leading brands are using AlkaTera to transform their environmental footprint into a competitive advantage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {[
              { 
                client: "From Spreadsheet to Story",
                stat: "Data you can finally share.",
                desc: "For too long, sustainability has been hidden in dry, technical PDFs that nobody reads. Alkatera transforms your complex data into a visual narrative. We don't just give you a number; we give you a way to talk to your customers, retailers, and investors with total confidence.",
                image: "https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767455250771-7582189d/Screenshot_2026-01-03_at_15.41.47.png"
              },
              { 
                client: "The 'Glass Box' Guarantee",
                stat: "Verification is the new currency.",
                desc: "In an era of the Green Claims Directive, \"trust me\" isn't a strategy. Our 'Glass Box' architecture ensures that every metric on this page is backed by global standards of verified industry datasets. When you show an impact number via alkatera, it isn't a guess, it's a defensible fact.",
                image: "https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/bcc6d5d1-8892-4a39-a7dd-5c43bf14f376/generated-images/generated-c27a7a87-5790-412c-8aa4-efaf3beb412b.png"
              }
            ].map((story, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[16/9] overflow-hidden mb-8 grayscale group-hover:grayscale-0 transition-all duration-700">
                  <img src={story.image} alt={story.client} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-1000" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>
                <div className="flex justify-between items-start border-t border-white/20 pt-6">
                  <div>
                    <h3 className="text-3xl font-serif mb-2">{story.client}</h3>
                    <p className="text-gray-400 max-w-sm text-sm leading-relaxed">{story.desc}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[#ccff00] font-bold text-xl mb-1">{story.stat}</div>
                    <ArrowRight className="ml-auto w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-300 text-gray-500 group-hover:text-white" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* --- CTA SECTION --- */}
        <section className="relative py-32 px-6 text-center overflow-hidden z-20 bg-[#050505]">
          <div className="absolute inset-0 bg-[#ccff00] mix-blend-multiply opacity-5" />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            className="relative z-10 max-w-3xl mx-auto"
          >
            <Sprout className="w-16 h-16 text-[#ccff00] mx-auto mb-8" />
            <h2 className="text-5xl md:text-8xl font-serif mb-8 tracking-tight">
              Grow Your <br/> Legacy
            </h2>
            <p className="font-mono text-gray-400 mb-10">
              JOIN THE MOVEMENT OF REGENERATIVE BRANDS
            </p>
            <button className="bg-[#ccff00] text-black px-10 py-5 rounded-full font-mono text-sm font-bold uppercase tracking-widest hover:bg-white transition-colors duration-300">
              Start Your Impact Journey
            </button>
          </motion.div>
        </section>
      </div>
      
    </div>
  );
}
