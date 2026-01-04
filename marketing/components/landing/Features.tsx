'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Leaf, Droplets, CheckCircle2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: React.ReactNode;
  subtitle: string;
  icon: React.ElementType;
  image: string;
  description: string;
  index: number;
}

const FeatureCard = ({ title, subtitle, icon: Icon, image, description, index }: FeatureCardProps) => {
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
        <img src={image} alt={typeof title === 'string' ? title : 'Feature'} className="w-full h-full object-cover grayscale" />
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

export const LandingFeatures = () => {
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
