'use client';

import { useRef } from 'react';
import { motion, useScroll, useSpring, useInView } from 'framer-motion';
import { ArrowRight, Droplets, Wind, Sprout } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Brand } from '@/components/shared/Brand';

const OrganicBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#ECEAE3]" />
      <img
        src="https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?q=80&w=2874&auto=format&fit=crop"
        alt="Background Texture"
        className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-multiply grayscale"
      />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
    </div>
  );
};

interface StatementProps {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  icon?: React.ElementType;
  bgImage?: string;
  accent?: string;
}

const Statement = ({
  children,
  align = "left",
  icon: Icon,
  bgImage,
  accent = '#1A1B1D'
}: StatementProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, margin: "-20% 0px -20% 0px" });

  return (
    <div ref={ref} className={cn(
      "min-h-screen flex flex-col justify-center px-6 md:px-20 relative z-20 py-20 overflow-hidden",
      align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left"
    )}>
      {bgImage && (
        <motion.div
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: isInView ? 0.25 : 0 }}
          transition={{ duration: 1.5 }}
        >
          <img src={bgImage} alt="Backdrop" className="w-full h-full object-cover grayscale" />
          <div className="absolute inset-0 bg-[#ECEAE3]/50" />
        </motion.div>
      )}

      <div className="relative z-10">
        {Icon && (
          <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.8 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
          style={{ color: accent }}
        >
          <Icon className="w-12 h-12 md:w-16 md:h-16 opacity-80" />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 50 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="max-w-4xl"
      >
        {children}
      </motion.div>
      </div>
    </div>
  );
};

export function ManifestoPageClient() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="bg-[#ECEAE3] min-h-screen text-[#1A1B1D] relative overflow-x-hidden selection:bg-[#1A1B1D] selection:text-[#F2F1EA]">
      <Navigation />
      <OrganicBackground />

      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-[#1A1B1D] origin-left z-50"
        style={{ scaleX }}
      />

      {/* Hero Statement */}
      <Statement align="center">
        <p className="font-mono font-bold text-[10px] md:text-xs uppercase tracking-[0.22em] text-[#205E40] mb-6">
          The manifesto
        </p>
        <h1 className="font-display font-bold tracking-[-0.035em] text-5xl md:text-8xl lg:text-9xl leading-[0.95] mb-8">
          The soil does <br/>
          <span className="text-[#205E40]">not negotiate.</span>
        </h1>
        <p className="text-sm md:text-lg text-[#6F6F68] max-w-xl mx-auto leading-relaxed">
          We often forget that every bottle begins in the dirt and the clouds. Whether it is barley, agave, grapes, or cane, your product is entirely dependent on a stable climate and healthy soil. Sustainability is not a &apos;nice-to-have&apos; addition to your brand; it is the only insurance policy for your future existence. No nature. No drink.
        </p>
      </Statement>

      {/* Section 1: Water */}
      <Statement align="left" icon={Droplets} accent="#2B46C0" bgImage="https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=2940&auto=format&fit=crop">
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-7xl mb-6 leading-[0.95]">
          The liquid <br/>
          <span className="text-[#2B46C0]">is on loan.</span>
        </h2>
        <p className="text-base md:text-xl text-[#1A1B1D]/80 max-w-2xl leading-relaxed border-l-2 border-[#2B46C0] pl-6">
          Water isn&apos;t just a utility; it&apos;s the lifeblood of your brand. But it&apos;s also a finite loan from the local watershed. As climate pressure rises and water availability fluctuates, the brands that thrive will be those that treat every drop with reverence. We measure it because without a healthy watershed, you have no product. Period.
        </p>
      </Statement>

      {/* Section 2: Air */}
      <Statement align="right" icon={Wind} accent="#A97C14" bgImage="https://images.unsplash.com/photo-1500829243541-74b677fecc30?q=80&w=2952&auto=format&fit=crop">
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-7xl mb-6 leading-[0.95]">
          Redefining the weight <br/>
          <span className="text-[#A97C14]">of luxury.</span>
        </h2>
        <p className="text-base md:text-xl text-[#1A1B1D]/80 max-w-2xl leading-relaxed border-r-2 border-[#A97C14] pr-6">
          For too long, the industry equated &quot;heavy&quot; with &quot;high-end.&quot; But a heavy bottle is just a heavy burden on the planet. In a conscious market, true luxury isn&apos;t excess, it&apos;s intelligence. We help you optimise your packaging to deliver the same brand equity with a fraction of the impact. Lighten the load, keep the prestige.
        </p>
      </Statement>

      {/* Section 3: Earth/Growth */}
      <Statement align="center" icon={Sprout} accent="#205E40" bgImage="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2940&auto=format&fit=crop">
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-7xl mb-6 leading-[0.95]">
          Flavour starts <br/>
          <span className="text-[#205E40]">in the soil.</span>
        </h2>
        <p className="text-base md:text-xl text-[#1A1B1D]/80 max-w-3xl mx-auto leading-relaxed">
          You might be based in a city, but your supply chain lives in the field. The drinks industry is one of the few sectors entirely reliant on the health of the earth. Environmental degradation isn&apos;t just a PR risk; it&apos;s a flavour risk. To protect the integrity of your liquid, you must first protect the land that yields it. We help you see the soil through the data.
        </p>
      </Statement>

      {/* Signature / Final CTA */}
      <div className="min-h-[60vh] flex flex-col justify-center items-center relative z-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="max-w-4xl"
        >
          <div className="mb-12">
            <h3 className="font-display font-bold tracking-[-0.035em] text-3xl md:text-5xl mb-4">
              Legacy is a long-term game.
            </h3>
            <p className="text-sm md:text-base text-[#6F6F68] max-w-2xl mx-auto">
              The best brands are built to last for generations. <Brand /> is the operating system for those who intend to be here in fifty years&apos; time. Don&apos;t just make a drink for today. Engineer a future for your craft.
            </p>
          </div>

          <Link href="/getaccess" className="group inline-flex items-center gap-4 px-8 py-4 bg-[#1A1B1D] rounded-full transition-colors hover:bg-[#205E40]">
            <span className="font-mono text-lg uppercase tracking-[0.22em] text-[#F2F1EA]">
              Join the Movement
            </span>
            <ArrowRight className="w-5 h-5 text-[#F2F1EA] group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>

      <div className="relative z-20">
        <Footer />
      </div>
    </div>
  );
}
