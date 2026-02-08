'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal = ({ isOpen, onClose }: ContactModalProps) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          subscribe: true,
          interest: interests.join(', '),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit form');
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form after close animation
    setTimeout(() => {
      setName('');
      setCompany('');
      setEmail('');
      setInterests([]);
      setIsSubmitted(false);
      setError('');
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
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
              onClick={handleClose}
              className="absolute top-8 right-8 text-white hover:text-[#ccff00] transition-colors"
              aria-label="Close modal"
            >
              <X size={32} />
            </button>

            <div className="mt-12">
              {isSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-20"
                >
                  <div className="w-16 h-16 bg-[#ccff00] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-black" />
                  </div>
                  <h2 className="font-serif text-4xl mb-4">Transmission Received</h2>
                  <p className="text-gray-400 font-mono text-sm">
                    We&apos;ll be in touch shortly to discuss your sustainability journey.
                  </p>
                </motion.div>
              ) : (
                <>
                  <h2 className="font-serif text-4xl md:text-5xl mb-6">
                    Let&apos;s engineer your impact.
                  </h2>
                  <p className="text-gray-400 mb-12 font-mono text-sm">
                    Tell us about your organization. We&apos;ll build a custom roadmap for your sustainability journey.
                  </p>

                  {error && (
                    <div className="mb-6 p-4 border border-red-500/30 bg-red-500/10 text-red-400 font-mono text-sm rounded">
                      {error}
                    </div>
                  )}

                  <form className="space-y-12" onSubmit={handleSubmit}>
                    <div className="space-y-2 group">
                      <label
                        htmlFor="modal-name"
                        className="font-mono text-xs uppercase tracking-widest text-[#ccff00]"
                      >
                        Name
                      </label>
                      <input
                        id="modal-name"
                        type="text"
                        placeholder="John Doe"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                      />
                    </div>

                    <div className="space-y-2 group">
                      <label
                        htmlFor="modal-company"
                        className="font-mono text-xs uppercase tracking-widest text-[#ccff00]"
                      >
                        Company
                      </label>
                      <input
                        id="modal-company"
                        type="text"
                        placeholder="Acme Corp"
                        required
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full bg-transparent border-b border-white/20 py-4 text-xl focus:outline-none focus:border-[#ccff00] transition-colors placeholder:text-white/20"
                      />
                    </div>

                    <div className="space-y-2 group">
                      <label
                        htmlFor="modal-email"
                        className="font-mono text-xs uppercase tracking-widest text-[#ccff00]"
                      >
                        Email
                      </label>
                      <input
                        id="modal-email"
                        type="email"
                        placeholder="john@acme.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                            onClick={() => toggleInterest(tag)}
                            className={`border px-4 py-2 rounded-full text-sm transition-colors ${
                              interests.includes(tag)
                                ? 'border-[#ccff00] text-[#ccff00] bg-[#ccff00]/10'
                                : 'border-white/20 hover:border-[#ccff00] hover:text-[#ccff00]'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#ccff00] text-black font-mono uppercase font-bold tracking-widest py-6 hover:opacity-90 transition-opacity mt-8 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Request Access'
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
