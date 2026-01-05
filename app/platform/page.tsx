'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { ArrowRight, Microscope, Calculator, Compass, Footprints, Layers, ShieldCheck, Network } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { cn } from '@/lib/utils';

const Hero = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 200]);

  return (
    <section className="relative h-[80vh] w-full overflow-hidden bg-[#050505] text-[#f0f0f0] flex items-center justify-center pt-20">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=2574&auto=format&fit=crop"
          alt="Distillery Nature"
          className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#050505]/80 to-[#050505]" />
      </div>

      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/50 to-[#050505]" />

      <motion.div
        style={{ y }}
        className="relative z-10 max-w-6xl mx-auto px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-serif text-5xl md:text-8xl leading-[0.9] mb-8 tracking-tight">
            The Ecological <br/>
            <span className="text-[#ccff00] italic">Intelligence</span> Engine
          </h1>
          <p className="font-mono text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed uppercase tracking-widest">
            Precision environmental data transformed into <br className="hidden md:block"/>
            defensible business strategy.
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
};

const ProcessSection = () => {
  const steps = [
    {
      id: "01",
      title: "Analyse",
      subtitle: "Total visibility, zero guesswork",
      desc: "We take your raw data and turn the lights on. Instead of messy spreadsheets and data spread across emails, our engine organises your inputs against global scientific standards to reveal your brand's true footprint. We spot the high-impact \"hotspots\" in your supply chain that stay hidden in basic calculators, giving you a crystal-clear starting point.",
      icon: Microscope
    },
    {
      id: "02",
      title: "Calculate",
      subtitle: "The 'Glass Box' standard",
      desc: "Quantify your impact with absolute confidence. Our engine handles the heavy lifting, from carbon emissions to water stress, using a transparent \"Glass Box\" approach. Every number is traceable and audit-ready, giving you a verified data foundation that satisfies customers, retailers, and investors without the stress of manual math.",
      icon: Calculator
    },
    {
      id: "03",
      title: "Strategise",
      subtitle: "Your roadmap to growth",
      desc: "Move beyond just reporting and start leading. We translate your data into a strategic roadmap that helps you set ambitious goals and reach them. By turning abstract numbers into a concrete commercial advantage, we empower you to build a resilient brand that gives back to the ecosystems we all depend on.",
      icon: Compass
    }
  ];

  return (
    <section className="py-32 px-6 md:px-20 bg-[#050505] text-white relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-24">
          <motion.h2
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="font-mono text-[#ccff00] text-xs tracking-[0.2em] uppercase mb-4"
          >
            The Alchemy
          </motion.h2>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl font-serif max-w-3xl"
          >
            From Raw Data to <span className="italic text-gray-500">Real Impact</span>
          </motion.h3>
          <p className="mt-6 text-gray-400 font-mono max-w-2xl border-l border-[#ccff00] pl-6">
            Clarity, not complexity. Action, not ambiguity. Your path to environmental leadership, simplified.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
          <div className="hidden lg:block absolute top-12 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#ccff00]/30 to-transparent z-0" />

          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="relative z-10 group"
            >
              <div className="w-24 h-24 bg-[#0a0a0a] border border-[#333] rounded-full flex items-center justify-center mb-8 group-hover:border-[#ccff00] transition-colors duration-500 mx-auto lg:mx-0 relative">
                <step.icon className="w-8 h-8 text-white group-hover:text-[#ccff00] transition-colors" />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#ccff00] rounded-full flex items-center justify-center text-black font-bold font-mono text-xs">
                  {step.id}
                </div>
              </div>

              <h4 className="text-2xl font-serif mb-2 group-hover:text-[#ccff00] transition-colors">{step.title}</h4>
              <h5 className="text-sm font-mono uppercase tracking-widest text-gray-500 mb-6">{step.subtitle}</h5>
              <p className="text-gray-400 leading-relaxed text-sm border-t border-gray-800 pt-6 group-hover:border-[#ccff00]/30 transition-colors">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ModulesSection = () => {
  const modules = [
    {
      title: "Full Operational Clarity",
      subtitle: "CORPORATE FOOTPRINTING",
      desc: "One dashboard for your entire business. We automate the tracking of your Scope 1, 2, and 3 emissions alongside water and waste, giving you a holistic, audit-ready view of your performance—from the office to the production floor.",
      icon: Footprints,
      color: "from-emerald-900/20 to-black"
    },
    {
      title: "Liquid & Packaging Intelligence",
      subtitle: "PRODUCT LIFE CYCLE ASSESSMENT",
      desc: "Map the environmental footprint of every SKU you produce. Our engine lets you run 'what-if' scenarios to instantly see how a glass-weight change or a new recipe affects your total ecological score. It's product development, powered by data.",
      icon: Layers,
      color: "from-blue-900/20 to-black"
    },
    {
      title: "The Regulatory Shield",
      subtitle: "COMPLIANCE & REPORTING",
      desc: "Say goodbye to regulatory anxiety. Whether you're facing CSRD or the Green Claims Directive, our platform generates the verifiable reports you need to stay safe, stay compliant, and prove your resilience to investors and retailers.",
      icon: ShieldCheck,
      color: "from-yellow-900/20 to-black"
    },
    {
      title: "Supply Chain Clarity",
      subtitle: "UPSTREAM VISIBILITY",
      desc: "See beyond your own walls. We bridge the data gap by gathering real insights from growers on farming practices and water use. Track your ingredients from the field to the bottle with total confidence in your supply chain's integrity.",
      icon: Network,
      color: "from-purple-900/20 to-black"
    }
  ];

  return (
    <section className="py-32 px-6 md:px-20 bg-[#0a0a0a] text-white border-t border-[#222]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="font-serif text-4xl md:text-6xl mb-6">
            The Architecture of <span className="text-[#ccff00]">Impact</span>
          </h2>
          <p className="font-mono text-gray-400 max-w-2xl mx-auto">
            Each module works independently or together, giving you the flexibility to build your sustainability programme at your own pace. Start where it matters most.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-[#222] bg-[#050505] p-8 hover:border-[#ccff00]/50 transition-all duration-500 min-h-[300px] flex flex-col justify-between"
            >
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                mod.color
              )} />

              <div className="relative z-10">
                <div className="w-12 h-12 bg-[#111] rounded-lg flex items-center justify-center mb-6 group-hover:bg-[#ccff00] group-hover:text-black transition-colors duration-300">
                  <mod.icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-2xl mb-2 group-hover:translate-x-2 transition-transform duration-300">
                  {mod.title}
                </h3>
                <h4 className="font-mono text-xs text-[#ccff00] uppercase tracking-widest mb-4">
                  {mod.subtitle}
                </h4>
              </div>

              <p className="relative z-10 text-gray-400 leading-relaxed text-sm max-w-md group-hover:text-gray-200 transition-colors">
                {mod.desc}
              </p>

              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <ArrowRight className="text-[#ccff00]" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function PlatformPage() {
  return (
    <div className="bg-[#050505] min-h-screen text-white selection:bg-[#ccff00] selection:text-black relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2832&auto=format&fit=crop"
          alt="Background"
          className="w-full h-full object-cover opacity-20 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#050505]/80 to-[#050505]" />
      </div>

      <div className="relative z-10">
        <Navigation />
        <Hero />
        <ProcessSection />
        <ModulesSection />
        <Footer />
      </div>
    </div>
  );
}
