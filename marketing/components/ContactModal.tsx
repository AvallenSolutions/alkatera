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
            className="fixed inset-0 bg-[#1A1B1D]/60 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full md:w-[600px] bg-[#F2F1EA] text-[#1A1B1D] z-[70] border-l border-[#D9D6CB] p-8 md:p-16 overflow-y-auto"
          >
            <button
              onClick={handleClose}
              className="absolute top-8 right-8 text-[#1A1B1D] hover:text-[#205E40] transition-colors"
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
                  <div className="w-16 h-16 bg-[#205E40] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-[#F2F1EA]" />
                  </div>
                  <h2 className="font-display font-bold tracking-[-0.035em] text-4xl mb-4">Message received.</h2>
                  <p className="text-[#6F6F68] font-mono text-sm">
                    We&apos;ll be in touch shortly to discuss your sustainability journey.
                  </p>
                </motion.div>
              ) : (
                <>
                  <h2 className="font-display font-bold tracking-[-0.035em] leading-[0.95] text-4xl md:text-5xl mb-6">
                    Let&apos;s engineer your impact.
                  </h2>
                  <p className="text-[#6F6F68] mb-12 text-sm">
                    Tell us about your organisation. We&apos;ll build a custom roadmap for your sustainability journey.
                  </p>

                  {error && (
                    <div className="mb-6 p-4 border border-[#BE123C]/30 bg-[#BE123C]/10 text-[#BE123C] font-mono text-sm rounded-[6px]">
                      {error}
                    </div>
                  )}

                  <form className="space-y-12" onSubmit={handleSubmit}>
                    <div className="space-y-2 group">
                      <label
                        htmlFor="modal-name"
                        className="font-mono font-bold text-xs uppercase tracking-[0.22em] text-[#205E40]"
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
                        className="w-full bg-transparent border-b border-[#D9D6CB] py-4 text-xl focus:outline-none focus:border-[#205E40] transition-colors placeholder:text-[#1A1B1D]/25"
                      />
                    </div>

                    <div className="space-y-2 group">
                      <label
                        htmlFor="modal-company"
                        className="font-mono font-bold text-xs uppercase tracking-[0.22em] text-[#205E40]"
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
                        className="w-full bg-transparent border-b border-[#D9D6CB] py-4 text-xl focus:outline-none focus:border-[#205E40] transition-colors placeholder:text-[#1A1B1D]/25"
                      />
                    </div>

                    <div className="space-y-2 group">
                      <label
                        htmlFor="modal-email"
                        className="font-mono font-bold text-xs uppercase tracking-[0.22em] text-[#205E40]"
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
                        className="w-full bg-transparent border-b border-[#D9D6CB] py-4 text-xl focus:outline-none focus:border-[#205E40] transition-colors placeholder:text-[#1A1B1D]/25"
                      />
                    </div>

                    <div className="space-y-2 group">
                      <label className="font-mono font-bold text-xs uppercase tracking-[0.22em] text-[#205E40]">
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
                                ? 'border-[#205E40] text-[#F2F1EA] bg-[#205E40]'
                                : 'border-[#D9D6CB] text-[#1A1B1D] hover:border-[#205E40] hover:text-[#205E40]'
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
                      className="w-full bg-[#1A1B1D] text-[#F2F1EA] font-mono uppercase font-bold tracking-[0.22em] py-6 rounded-full hover:opacity-90 transition-opacity mt-8 disabled:opacity-50 flex items-center justify-center gap-3"
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
