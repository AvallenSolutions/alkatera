'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal = ({ isOpen, onClose }: ContactModalProps) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Add form submission logic (Supabase integration)
    console.log('Form submitted');
  };

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full md:w-[600px] bg-[#0a0a0a] z-[70] border-l border-[#ccff00]/20 p-8 md:p-16 overflow-y-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-8 right-8 text-white hover:text-[#ccff00] transition-colors"
              aria-label="Close modal"
            >
              <X size={32} />
            </button>

            <div className="mt-12">
              <h2 className="font-serif text-4xl md:text-5xl mb-6">
                Let&apos;s engineer your impact.
              </h2>
              <p className="text-gray-400 mb-12 font-mono text-sm">
                Tell us about your organization. We&apos;ll build a custom roadmap for your sustainability journey.
              </p>

              <form className="space-y-12" onSubmit={handleSubmit}>
                <div className="space-y-2 group">
                  <label
                    htmlFor="name"
                    className="font-mono text-xs uppercase tracking-widest text-[#ccff00]"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    required
                    className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-2 group">
                  <label
                    htmlFor="company"
                    className="font-mono text-xs uppercase tracking-widest text-[#ccff00]"
                  >
                    Company
                  </label>
                  <input
                    id="company"
                    type="text"
                    placeholder="Acme Corp"
                    required
                    className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-2 group">
                  <label
                    htmlFor="email"
                    className="font-mono text-xs uppercase tracking-widest text-[#ccff00]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="john@acme.com"
                    required
                    className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-2 group">
                  <label className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">
                    Interests
                  </label>
                  <div className="flex flex-wrap gap-3 pt-2">
                    {['Carbon', 'Water', 'Strategy', 'Compliance'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="border border-white/20 px-4 py-2 rounded-full text-sm hover:border-[#ccff00] hover:text-[#ccff00] transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#ccff00] text-black font-mono uppercase font-bold tracking-widest py-6 hover:opacity-90 transition-opacity mt-8"
                >
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
