import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion';
import { ArrowRight, Globe, Droplets, Leaf, BarChart3, CheckCircle2, Menu, X, ChevronDown, Sprout, Trees, Mountain, Microscope, Calculator, Compass, Flower2 } from 'lucide-react';

/**
 * Custom Seed Icon for the Seed tier
 */
const SeedIcon = ({ className, size = 24 }: { className?: string, size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z" />
    <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
  </svg>
);
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

if (typeof window !== 'undefined') {
  // Load Playfair Display font
  if (!document.getElementById('google-fonts-playfair')) {
    const link = document.createElement('link');
    link.id = 'google-fonts-playfair';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  // Configure Tailwind to use Playfair Display as the default serif font
  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    ...window.tailwind.config,
    theme: {
      ...window.tailwind.config?.theme,
      extend: {
        ...window.tailwind.config?.theme?.extend,
        fontFamily: {
          ...window.tailwind.config?.theme?.extend?.fontFamily,
          serif: ['"Playfair Display"', 'serif'],
        },
      },
    },
  };
}

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Logo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center select-none relative z-50", className)}>
    {/* Using CSS filters to crush the black background from the screenshot asset */}
    <img 
      src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png" 
      alt="AlkaTera" 
      className="h-10 md:h-14 w-auto object-contain mix-blend-screen brightness-125 contrast-150"
      style={{ mixBlendMode: 'screen' }}
    />
  </div>
);

const Navigation = ({ onOpenContact }: { onOpenContact: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center text-white">
      <div className="z-50">
        <Logo />
      </div>
      
      <div className="hidden md:flex items-center gap-8 font-mono text-xs tracking-widest uppercase">
        {['Platform', 'Manifesto', 'Impact', 'Knowledge'].map((item) => (
          <a key={item} href="#" className="hover:opacity-50 transition-opacity duration-300">
            {item}
          </a>
        ))}
        <button 
          onClick={onOpenContact}
          className="border border-white px-6 py-2 rounded-full hover:bg-white hover:text-black transition-colors duration-300"
        >
          Get Access
        </button>
      </div>

      <button 
        className="md:hidden z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* Mobile Menu Overlay */}
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
            <button 
              onClick={() => {
                setIsOpen(false);
                onOpenContact();
              }}
              className="mt-8 text-[#ccff00] font-mono uppercase tracking-widest border border-[#ccff00] px-8 py-4 rounded-full"
            >
              Get Access
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#050505] text-[#f0f0f0]">
      {/* Background Video/Image Placeholder */}
      <div className="absolute inset-0 opacity-60">
        <img 
          src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2874&auto=format&fit=crop" 
          alt="Abstract Nature" 
          className="object-cover w-full h-full scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#050505]" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-20 max-w-[1800px] mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ y: y1, opacity }}
          className="max-w-5xl"
        >
          <h1 className="font-serif text-6xl md:text-9xl leading-[0.9] mb-8 tracking-tight">
            Sustainability, <br />
            <span className="italic text-[#ccff00]">Distilled.</span>
          </h1>
          <p className="font-mono text-sm md:text-lg max-w-xl text-gray-300 leading-relaxed border-l border-[#ccff00] pl-6">
            Make sustainability your competitive edge, not your paperwork. Alkatera is the operating system for the drinks industry, automating the complex science of impact to turn your environmental data into a powerful engine for brand growth.
          </p>
        </motion.div>
      </div>

      <motion.div 
        style={{ opacity }}
        className="absolute bottom-12 left-0 right-0 flex justify-center animate-bounce"
      >
        <ChevronDown className="w-8 h-8 text-[#ccff00]" />
      </motion.div>
    </section>
  );
};

const Manifesto = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section ref={containerRef} className="py-32 px-6 md:px-20 bg-[#050505] text-[#f0f0f0] relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        <div>
          <h2 className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase mb-8">Manifesto</h2>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <h3 className="font-serif text-4xl md:text-6xl mb-12 leading-tight">
              The drinks industry is <span className="italic">defined</span> by its relationship with nature.
            </h3>
            <p className="font-mono text-lg text-gray-400 leading-relaxed mb-12">
              For too long, sustainability has been a burden of spreadsheets and guesswork. We believe that when impact is quantified with scientific precision, it becomes a blueprint for excellence. 
            </p>
            <motion.h3 
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5, duration: 1 }}
              className="font-serif text-3xl italic text-[#ccff00]"
            >
              Sustainability, simplified.
            </motion.h3>
          </motion.div>
        </div>

        <div className="relative h-[600px] w-full group">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={isInView ? { scale: 1, opacity: 1 } : {}}
             transition={{ delay: 0.4, duration: 1 }}
             className="absolute inset-0 overflow-hidden rounded-none"
           >
             <img 
               src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2787&auto=format&fit=crop" 
               alt="Water Ripples" 
               className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 ease-out"
             />
             <div className="absolute inset-0 bg-[#ccff00]/10 mix-blend-multiply" />
           </motion.div>
           
           {/* Floating Data Card */}
           <motion.div 
             initial={{ x: 50, opacity: 0 }}
             animate={isInView ? { x: 0, opacity: 1 } : {}}
             transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
             className="absolute -bottom-16 -left-16 bg-white text-black p-10 max-w-sm hidden md:block shadow-[40px_40px_80px_rgba(0,0,0,0.5)] border-t-4 border-[#ccff00]"
           >
              <div className="relative">
                <div className="absolute -top-16 -left-16 text-[120px] font-serif italic text-black/5 pointer-events-none select-none">
                  55%
                </div>
                <div className="text-2xl md:text-3xl font-medium font-serif leading-[1.1] mb-6 relative z-10">
                  Sustainable products drive <span className="italic underline decoration-[#ccff00] decoration-4 underline-offset-4">55% of all growth</span> in consumer goods.
                </div>
                <div className="space-y-4 relative z-10">
                  <div className="h-px w-12 bg-black/10" />
                  <p className="text-sm text-gray-500 font-mono leading-relaxed uppercase tracking-tight">
                    For drinks brands, "green" SKUs are now the primary engine for expanding market share rather than a niche luxury.
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400">
                  <div className="w-1 h-1 rounded-full bg-[#ccff00]" />
                  Verified Industry Insight
                </div>
              </div>
           </motion.div>
        </div>
      </div>
    </section>
  );
};

const FeatureCard = ({ title, subtitle, icon: Icon, image, description, index }: any) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.2, duration: 0.8 }}
      className="group relative h-[500px] md:h-[600px] w-full border-r border-white/10 last:border-r-0 overflow-hidden flex flex-col justify-center p-8 hover:bg-white/5 transition-colors duration-500"
    >
      <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-40 transition-opacity duration-700">
        <img src={image} alt={title} className="w-full h-full object-cover grayscale" />
      </div>
      
      <div className="relative z-10 pointer-events-none flex flex-col items-start h-full justify-center">
        <div className="bg-[#ccff00] text-black w-12 h-12 flex items-center justify-center rounded-full mb-6 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 absolute top-8 left-0">
          <Icon size={20} />
        </div>
        
        <div className="mt-auto mb-auto w-full">
          <h3 className="font-mono text-xs text-[#ccff00] mb-2 tracking-widest uppercase h-4 flex items-end">{subtitle}</h3>
          <h2 className="font-serif text-4xl md:text-5xl mb-4 leading-tight group-hover:text-white transition-colors duration-300 min-h-[2.2em] flex items-start">
            {title}
          </h2>
          
          <div className="h-0 group-hover:h-auto overflow-hidden transition-all duration-500 ease-in-out opacity-0 group-hover:opacity-100">
             <p className="font-mono text-sm text-gray-300 leading-relaxed border-l border-[#ccff00] pl-4 max-w-sm">
              {description}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Features = () => {
  const features = [
    {
      title: <>Beyond<br />Carbon</>,
      subtitle: "Traceability",
      icon: Leaf,
      description: "Carbon is only one part of the story. From water stress to biodiversity loss, we give you a 360° view of your environmental performance. Don't just measure emissions; measure your total impact.",
      image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2813&auto=format&fit=crop"
    },
    {
      title: "Built for Beverages",
      subtitle: "Resource Mgmt",
      icon: Droplets,
      description: "Generic calculators fail on liquids. Our engine models the specific physics of brewing, distilling, and fermentation, giving you the most precise water and waste analytics in the industry.",
      image: "https://images.unsplash.com/photo-1519817914152-22d216bb9170?q=80&w=2865&auto=format&fit=crop"
    },
    {
      title: "Audit-Ready Data",
      subtitle: "Compliance",
      icon: CheckCircle2,
      description: "Never fear a regulator again. Our \"Glass Box\" architecture ensures every claim is backed by traceable, transparent data. Turn compliance from a risk into your strongest marketing asset.",
      image: "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?q=80&w=2787&auto=format&fit=crop"
    },
    {
      title: "Certification Accelerator",
      subtitle: "Strategy",
      icon: Globe,
      description: "Stop guessing and start improving. We automate the complex data collection required for B Corp, translating your operational footprint into a clear, strategic roadmap for certification.",
      image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2972&auto=format&fit=crop"
    }
  ];

  return (
    <section className="bg-[#050505] text-white border-t border-white/10">
      <div className="grid grid-cols-1 md:grid-cols-4">
        {features.map((f, i) => (
          <FeatureCard key={i} index={i} {...f} />
        ))}
      </div>
    </section>
  );
};

const Marquee = () => {
  return (
    <div className="py-12 bg-[#ccff00] overflow-hidden whitespace-nowrap">
      <motion.div 
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        className="inline-block text-black font-mono text-lg md:text-2xl font-bold uppercase tracking-tight"
      >
        <span className="mx-8">Launching Feb 2026 - Sign up Not to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up Not to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up Not to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up Not to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up Not to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up Not to get early access •</span>
      </motion.div>
    </div>
  );
};

const InteractiveShowcase = () => {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    { 
      id: 0, 
      label: "01. ANALYSE", 
      content: "We dissect your liquid's journey. Our platform analyses raw ingredients, fermentation data, and packaging specs against global environmental standards to reveal the true composition of your bottle's footprint.",
      image: "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?q=80&w=2000&auto=format&fit=crop" // Brewery/Vats
    },
    { 
      id: 1, 
      label: "02. CALCULATE", 
      content: "Quantify your impact per litre. From carbon equivalents in glass manufacturing to water scarcity indices in your barley fields, our engine performs the complex calculations needed for audit-ready reporting.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop" // Dashboard on Laptop
    },
    { 
      id: 2, 
      label: "03. STRATEGISE", 
      content: "Move beyond reporting. Use your data to build a resilient supply chain, optimise packaging weights, and set science-based targets that drive long-term brand value while regenerating the terroir you depend on.",
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2940&auto=format&fit=crop" // Team/Office with Nature View
    },
  ];

  return (
    <section className="py-32 px-6 md:px-20 bg-[#0a0a0a] text-white flex flex-col md:flex-row gap-20">
      <div className="w-full md:w-1/3 space-y-12">
        <h2 className="font-serif text-5xl">The Process</h2>
        <div className="flex flex-col gap-0 border-l border-white/20">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={cn(
                "text-left pl-8 py-6 font-mono text-lg transition-all duration-300 relative",
                activeTab === idx ? "text-[#ccff00]" : "text-gray-500 hover:text-white"
              )}
            >
              {activeTab === idx && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-[#ccff00]" 
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
        <motion.p 
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl leading-relaxed"
        >
          {tabs[activeTab].content}
        </motion.p>
      </div>

      <div className="w-full md:w-2/3 bg-[#111] rounded-none border border-white/10 relative min-h-[500px] overflow-hidden group">
         {/* Image Container */}
         <AnimatePresence mode="wait">
           <motion.div 
             key={activeTab}
             initial={{ opacity: 0, scale: 1.05 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0 }}
             transition={{ duration: 0.5 }}
             className="absolute inset-0"
           >
             <img 
               src={tabs[activeTab].image} 
               alt={tabs[activeTab].label} 
               className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700" 
             />
             <div className="absolute inset-0 bg-[#0a0a0a]/30 mix-blend-multiply" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
           </motion.div>
         </AnimatePresence>

         {/* Overlay Elements */}
         <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none">
            <div className="flex justify-between items-start">
              <div className="bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#ccff00]">Live Data Link</span>
              </div>
            </div>
            
            <div className="flex justify-end">
              <div className="bg-black/50 backdrop-blur-md border border-white/10 p-6 max-w-xs">
                <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">System Status</div>
                <div className="font-serif text-2xl text-white mb-1">
                  {activeTab === 0 && "Processing..."}
                  {activeTab === 1 && "Optimized."}
                  {activeTab === 2 && "On Target."}
                </div>
                <div className="h-1 w-full bg-white/10 mt-2 overflow-hidden">
                  <motion.div 
                    key={activeTab}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="h-full bg-[#ccff00]" 
                  />
                </div>
              </div>
            </div>
         </div>
      </div>
    </section>
  );
};

const TrustedBy = () => {
  const brands = [
    { name: "Avallen Calvados", url: "https://avallenspirits.com" },
    { name: "Everleaf", url: "https://www.everleafdrinks.com" },
    { name: "Three Spirit", url: "https://threespiritdrinks.com" },
    { name: "Takamaka Rum", url: "https://www.takamakarum.com" },
    { name: "Black Lines", url: "https://blacklinesdrinks.com" },
    { name: "FABRIC", url: "https://drinkfabric.com" }
  ];

  return (
    <section className="py-32 bg-[#050505] border-y border-white/10 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6 mb-12 flex items-end justify-between">
        <h3 className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase">
          Trusted by Industry Pioneers
        </h3>
        <div className="hidden md:block h-px w-32 bg-[#ccff00]" />
      </div>
      
      <div className="relative w-full py-8">
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-60 bg-gradient-to-r from-[#050505] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-60 bg-gradient-to-l from-[#050505] to-transparent z-10" />
        
        <motion.div 
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
          className="flex items-center w-max"
        >
          {[...brands, ...brands, ...brands, ...brands].map((brand, i) => (
            <div key={i} className="flex items-center group">
              <a 
                href={brand.url}
                target="_blank"
                rel="noopener noreferrer" 
                className="font-serif text-3xl md:text-5xl text-white/20 hover:text-[#ccff00] transition-colors duration-500 px-6 md:px-12 whitespace-nowrap italic"
              >
                {brand.name}
              </a>
              <span className="text-white/10 text-xl md:text-3xl">✦</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const Pricing = ({ onOpenContact }: { onOpenContact: () => void }) => {
  const tiers = [
    {
      name: "Seed",
      tagline: "For boutique brands establishing their sustainability foundations.",
      icon: SeedIcon,
      capacity: "5 Products | 1 Facility | 1 User",
      features: [
        "Operational Footprinting: Automated tracking for Scope 1, 2, and essential Scope 3 (Carbon & Water).",
        "Supply Chain Visibility: Foundational upstream mapping to identify high-impact hotspots in your value chain.",
        "B Corp Alignment: Data structured specifically to simplify the environmental section of your B Corp Assessment.",
        "Unlimited Reporting: Generate as many standard audit-ready reports as your business needs for retail and investor tenders."
      ],
      buttonText: "Select Plan",
      highlight: false
    },
    {
      name: "Blossom",
      tagline: "For scaling brands ready to turn impact into a strategic advantage.",
      icon: Flower2,
      capacity: "20 Products | 3 Facilities | 5 Users",
      features: [
        "Everything in Seed, plus:",
        "Full Product LCA: Cradle-to-gate impact analysis for every SKU in your portfolio.",
        "Customisable Sustainability Reporting: Design and export bespoke reports tailored to your brand’s specific aesthetic and stakeholder needs.",
        "B Corp Performance Hub: Strategic tools to track and improve your score over time, moving from compliance to leadership.",
        "'What-If' Scenario Modelling: Test packaging and recipe changes in a digital sandbox before committing to production.",
        "Anti-Greenwash 'Claim Check': Verify your marketing claims against live data to ensure total regulatory safety."
      ],
      buttonText: "Start Now",
      highlight: true
    },
    {
      name: "Canopy",
      tagline: "Comprehensive ecosystem management for established organisations.",
      icon: Trees,
      capacity: "50 Products | 8 Facilities | 10 Users",
      features: [
        "Everything in Blossom, plus:",
        "Advanced Supply Chain Engagement: Tools to gather primary data directly from growers and suppliers for 100% precision.",
        "Land & Biodiversity Mapping: Measure your impact on soil health and local ecosystems beyond just carbon.",
        "Strategic Goal Setting: Define and track SMART environmental targets across your entire multi-brand portfolio.",
        "Human-in-the-Loop: Priority access to our experts for strategy validation and complex data verification.",
        "System Integration: Full API connectivity to your existing ERP, accounting, and operational software."
      ],
      buttonText: "Contact Sales",
      highlight: false
    }
  ];

  return (
    <section className="py-32 px-6 md:px-20 bg-[#050505] text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#ccff00]/5 via-black to-black pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase mb-4">Invest in Future</h2>
          <h3 className="font-serif text-4xl md:text-6xl">Choose your impact scale.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier, idx) => (
            <div 
              key={idx}
              className={cn(
                "border p-8 flex flex-col transition-all duration-500 group relative",
                tier.highlight 
                  ? "border-[#ccff00] bg-[#ccff00]/5 md:-translate-y-4 shadow-[0_20px_50px_rgba(204,255,0,0.1)]" 
                  : "border-white/10 bg-white/5 hover:border-white/30"
              )}
            >
              {tier.highlight && (
                <div className="absolute top-0 right-0 bg-[#ccff00] text-black text-[10px] font-bold uppercase px-3 py-1 tracking-widest">
                  Recommended
                </div>
              )}
              
              <div className="flex items-center justify-between mb-8">
                <h4 className={cn("font-serif text-3xl", tier.highlight ? "text-[#ccff00]" : "text-white")}>
                  {tier.name}
                </h4>
                <tier.icon className={tier.highlight ? "text-[#ccff00]" : "text-gray-500"} />
              </div>
              
              <div className="mb-8">
                <p className="text-white font-medium text-sm mb-2">{tier.tagline}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#ccff00]/80">Capacity: {tier.capacity}</p>
              </div>

              <ul className="space-y-4 mb-12 flex-1">
                {tier.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-3 text-sm group/item">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-colors",
                      tier.highlight ? "bg-[#ccff00]" : "bg-gray-500 group-hover/item:bg-white"
                    )} /> 
                    <span className={cn(
                      "leading-relaxed transition-colors",
                      tier.highlight ? "text-white" : "text-gray-400 group-hover/item:text-white",
                      feat.startsWith("Everything") && "font-serif italic text-white/90 border-b border-white/10 pb-1 w-full"
                    )}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={onOpenContact} 
                className={cn(
                  "w-full py-5 font-mono uppercase text-xs tracking-widest font-bold transition-all duration-300",
                  tier.highlight 
                    ? "bg-[#ccff00] text-black hover:opacity-90 hover:scale-[1.02]" 
                    : "border border-white/20 hover:bg-white hover:text-black"
                )}
              >
                {tier.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ContactModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full md:w-[600px] bg-[#0a0a0a] z-[70] border-l border-[#ccff00]/20 p-8 md:p-16 overflow-y-auto"
          >
            <button 
              onClick={onClose}
              className="absolute top-8 right-8 text-white hover:text-[#ccff00] transition-colors"
            >
              <X size={32} />
            </button>

            <div className="mt-12">
              <h2 className="font-serif text-4xl md:text-5xl mb-6">Let's engineer your impact.</h2>
              <p className="text-gray-400 mb-12 font-mono text-sm">
                Tell us about your organization. We'll build a custom roadmap for your sustainability journey.
              </p>

              <form className="space-y-12" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2 group">
                  <label className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe"
                    className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                  />
                </div>
                
                <div className="space-y-2 group">
                  <label className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">Company</label>
                  <input 
                    type="text" 
                    placeholder="Acme Corp"
                    className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-2 group">
                  <label className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">Email</label>
                  <input 
                    type="email" 
                    placeholder="john@acme.com"
                    className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-2 group">
                  <label className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">Interests</label>
                  <div className="flex flex-wrap gap-3 pt-2">
                    {['Carbon', 'Water', 'Strategy', 'Compliance'].map(tag => (
                      <button key={tag} className="border border-white/20 px-4 py-2 rounded-full text-sm hover:border-[#ccff00] hover:text-[#ccff00] transition-colors">
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="w-full bg-[#ccff00] text-black font-mono uppercase font-bold tracking-widest py-6 hover:opacity-90 transition-opacity mt-8">
                  Request Access
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const CTA = ({ onOpenContact }: { onOpenContact: () => void }) => {
  return (
    <section className="py-40 px-6 md:px-20 bg-[#ccff00] text-black text-center">
      <h2 className="font-serif text-5xl md:text-8xl mb-8 max-w-4xl mx-auto leading-[0.9]">
        Ready to change the industry?
      </h2>
      <p className="font-mono text-lg md:text-xl mb-12 max-w-xl mx-auto">
        Join the platform that's redesigning the future of drinks.
      </p>
      <button 
        onClick={onOpenContact}
        className="bg-black text-white px-10 py-5 rounded-full font-mono uppercase tracking-widest hover:scale-105 transition-transform duration-300 flex items-center gap-4 mx-auto"
      >
        Get In Touch <ArrowRight size={18} />
      </button>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-black text-white py-20 px-6 md:px-20 border-t border-white/10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
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

export function AlkaTeraLanding() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="bg-[#050505] min-h-screen w-full text-white selection:bg-[#ccff00] selection:text-black overflow-x-hidden">
      <Navigation onOpenContact={() => setIsContactOpen(true)} />
      <Hero />
      <Marquee />
      <Manifesto />
      <Features />
      <InteractiveShowcase />
      <TrustedBy />
      <Pricing onOpenContact={() => setIsContactOpen(true)} />
      <CTA onOpenContact={() => setIsContactOpen(true)} />
      <Footer />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}

export default AlkaTeraLanding;
