'use client';

import { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue } from 'framer-motion';
import { ArrowRight, Droplets, Wind, Sprout } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { cn } from '@/lib/utils';

const OrganicBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#050505]" />
      <img
        src="https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?q=80&w=2874&auto=format&fit=crop"
        alt="Background Texture"
        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-soft-light"
      />
      <div className="absolute inset-0 opacity-30 blur-[100px]">
        <motion.div
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -50, 100, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#ccff00] rounded-full opacity-20 mix-blend-screen"
        />
        <motion.div
          animate={{
            x: [0, -100, 50, 0],
            y: [0, 100, -50, 0],
            scale: [1, 1.5, 1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-[#0044ff] rounded-full opacity-10 mix-blend-screen"
        />
        <motion.div
          animate={{
            x: [0, 50, -100, 0],
            y: [0, -100, 50, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute top-[40%] left-[40%] w-[40vw] h-[40vw] bg-[#104040] rounded-full opacity-30 mix-blend-screen"
        />
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
    </div>
  );
};

const MouseFollower = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      style={{ x, y, translateX: '-50%', translateY: '-50%' }}
      className="fixed top-0 left-0 w-64 h-64 bg-[#ccff00] rounded-full blur-[80px] opacity-5 z-10 pointer-events-none mix-blend-overlay"
    />
  );
};

interface StatementProps {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  icon?: React.ElementType;
  bgImage?: string;
}

const Statement = ({
  children,
  align = "left",
  icon: Icon,
  bgImage
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
          animate={{ opacity: isInView ? 0.3 : 0 }}
          transition={{ duration: 1.5 }}
        >
          <img src={bgImage} alt="Backdrop" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#050505]/60" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
        </motion.div>
      )}

      <div className="relative z-10">
        {Icon && (
          <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.8 }}
          transition={{ duration: 0.8 }}
          className="mb-8 text-[#ccff00]"
        >
          <Icon className="w-12 h-12 md:w-16 md:h-16 opacity-80" />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 50, filter: isInView ? 'blur(0px)' : 'blur(10px)' }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="max-w-4xl"
      >
        {children}
      </motion.div>
      </div>
    </div>
  );
};

export default function ManifestoPage() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="bg-[#050505] min-h-screen text-[#f0f0f0] relative overflow-x-hidden selection:bg-[#ccff00] selection:text-black">
      <Navigation />
      <OrganicBackground />
      <MouseFollower />

      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-[#ccff00] origin-left z-50 mix-blend-difference"
        style={{ scaleX }}
      />

      {/* Hero Statement */}
      <Statement align="center">
        <h1 className="font-serif text-5xl md:text-8xl lg:text-9xl leading-[0.9] tracking-tight mb-8">
          The soil does <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] to-[#ffffff]">not negotiate.</span>
        </h1>
        <p className="font-mono text-sm md:text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
          We often forget that every bottle begins in the dirt and the clouds. Whether it is barley, agave, grapes, or cane, your product is entirely dependent on a stable climate and healthy soil. Sustainability is not a &apos;nice-to-have&apos; addition to your brand; it is the only insurance policy for your future existence. No nature. No drink.
        </p>
      </Statement>

      {/* Section 1: Water */}
      <Statement align="left" icon={Droplets} bgImage="https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=2940&auto=format&fit=crop">
        <h2 className="font-serif text-4xl md:text-7xl mb-6 leading-tight">
          The liquid <br/>
          <span className="italic text-gray-500 text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-[#ccff00]">is on loan.</span>
        </h2>
        <p className="font-mono text-base md:text-xl text-gray-300 max-w-2xl leading-relaxed border-l-2 border-[#ccff00] pl-6">
          Water isn&apos;t just a utility; it&apos;s the lifeblood of your brand. But it&apos;s also a finite loan from the local watershed. As climate pressure rises and water availability fluctuates, the brands that thrive will be those that treat every drop with reverence. We measure it because without a healthy watershed, you have no product. Period.
        </p>
      </Statement>

      {/* Section 2: Air */}
      <Statement align="right" icon={Wind} bgImage="https://images.unsplash.com/photo-1500829243541-74b677fecc30?q=80&w=2952&auto=format&fit=crop">
        <h2 className="font-serif text-4xl md:text-7xl mb-6 leading-tight">
          Redefining the weight <br/>
          <span className="italic text-gray-500 text-transparent bg-clip-text bg-gradient-to-l from-gray-500 to-[#ccff00]">of luxury.</span>
        </h2>
        <p className="font-mono text-base md:text-xl text-gray-300 max-w-2xl leading-relaxed border-r-2 border-[#ccff00] pr-6">
          For too long, the industry equated &quot;heavy&quot; with &quot;high-end.&quot; But a heavy bottle is just a heavy burden on the planet. In a conscious market, true luxury isn&apos;t excess, it&apos;s intelligence. We help you optimise your packaging to deliver the same brand equity with a fraction of the impact. Lighten the load, keep the prestige.
        </p>
      </Statement>

      {/* Section 3: Earth/Growth */}
      <Statement align="center" icon={Sprout} bgImage="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2940&auto=format&fit=crop">
        <h2 className="font-serif text-4xl md:text-7xl mb-6 leading-tight">
          Flavour starts <br/>
          <span className="text-[#ccff00]">in the soil.</span>
        </h2>
        <p className="font-mono text-base md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
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
            <h3 className="font-serif text-3xl md:text-5xl mb-4">
              Legacy is a long-term game
            </h3>
            <p className="font-mono text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
              The best brands are built to last for generations. Alkatera is the operating system for those who intend to be here in fifty years&apos; time. Don&apos;t just make a drink for today. Engineer a future for your craft.
            </p>
          </div>

          <button className="group relative inline-flex items-center gap-4 px-8 py-4 bg-transparent border border-[#ccff00] rounded-full overflow-hidden transition-all hover:bg-[#ccff00]">
            <span className="relative z-10 font-mono text-lg uppercase tracking-widest text-[#ccff00] group-hover:text-black transition-colors">
              Join the Movement
            </span>
            <ArrowRight className="w-5 h-5 text-[#ccff00] group-hover:text-black relative z-10" />
            <div className="absolute inset-0 bg-[#ccff00] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
          </button>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
