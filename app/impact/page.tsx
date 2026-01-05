'use client';

import { useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Droplets, Wind, Recycle, Sprout } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';

export default function ImpactPage() {
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const { scrollYProgress } = useScroll();

  const yContentHero = useTransform(scrollYProgress, [0, 0.5], [0, -200]);
  const yContentStory = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacityHeroContent = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div className="relative min-h-screen w-full bg-[#050505] text-white overflow-x-hidden">
      <Navigation />

      {/* Fixed Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
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

        {/* Ambient Gradient Blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 100, -50, 0],
              y: [0, -50, 100, 0],
              scale: [1, 1.2, 0.8, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-[#ccff00] rounded-full opacity-10 blur-[100px]"
          />
          <motion.div
            animate={{
              x: [0, -100, 50, 0],
              y: [0, 100, -50, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[10%] right-[15%] w-[600px] h-[600px] bg-[#00ccff] rounded-full opacity-10 blur-[100px]"
          />
        </div>
      </div>

      {/* Scrollable Foreground Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative h-screen w-full flex flex-col justify-center items-center overflow-hidden">
          <motion.div
            style={{ y: yContentHero, opacity: opacityHeroContent }}
            className="relative text-center max-w-5xl mx-auto px-6 mt-20"
          >
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

        {/* Story Section */}
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
                  image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop"
                },
                {
                  client: "The 'Glass Box' Guarantee",
                  stat: "Verification is the new currency.",
                  desc: "In an era of the Green Claims Directive, \"trust me\" isn't a strategy. Our 'Glass Box' architecture ensures that every metric on this page is backed by global standards of verified industry datasets. When you show an impact number via alkatera, it isn't a guess, it's a defensible fact.",
                  image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop"
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

        {/* CTA Section */}
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

        <Footer />
      </div>
    </div>
  );
}
