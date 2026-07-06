'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, User, Building2, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Brand } from '@/components/shared/Brand';

const BiomeVisual = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#205E40]">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay grayscale" />

      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-[#F2F1EA]/20"
            style={{
              width: `${(i + 1) * 300}px`,
              height: `${(i + 1) * 300}px`,
            }}
          />
        ))}
      </div>

      <div className="absolute bottom-12 left-12 right-12">
        <h2 className="text-4xl md:text-5xl font-display font-bold tracking-[-0.035em] leading-[0.95] text-[#F2F1EA] mb-4">
          Let&apos;s cultivate<br/> tomorrow.
        </h2>
        <p className="font-mono text-xs text-[#F2F1EA]/70 uppercase tracking-[0.22em] max-w-md">
          Join the network of leaders redefining ecological intelligence. Start your journey with <Brand />.
        </p>
      </div>
    </div>
  );
};

interface InputFieldProps {
  type: string;
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

const InputField = ({
  type,
  label,
  icon: Icon,
  value,
  onChange,
  required = true
}: InputFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative group mb-8">
      <label
        className={cn(
          "absolute left-8 transition-all duration-300 pointer-events-none font-mono text-xs tracking-[0.22em] uppercase",
          (isFocused || value) ? "-top-3 text-[#205E40] font-bold text-[10px]" : "top-3 text-[#6F6F68]"
        )}
      >
        {label}
      </label>

      <div className="absolute left-0 top-3 text-[#6F6F68] group-focus-within:text-[#205E40] transition-colors">
        <Icon size={18} />
      </div>

      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        required={required}
        className="w-full bg-transparent border-b border-[#D9D6CB] py-3 pl-8 text-[#1A1B1D] placeholder-transparent focus:outline-none focus:border-[#205E40] transition-colors font-sans text-lg"
      />
    </div>
  );
};

function ContactForm() {
  const searchParams = useSearchParams();
  const tier = searchParams.get('tier');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [subscribe, setSubscribe] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          company,
          subscribe,
          ...(tier && { interest: tier }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit form');
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Form submission error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!isSubmitted ? (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-[-0.035em] leading-[0.95] text-[#1A1B1D] mb-3">
            {tier ? `Get started with ${tier}.` : `Let's talk.`}
          </h1>
          <p className="text-[#6F6F68] font-mono text-xs mb-12 uppercase tracking-[0.22em]">
            {tier
              ? `Tell us about your organisation and we'll get you set up.`
              : `Ready to scale your impact?`}
          </p>

          <form onSubmit={handleSubmit}>
            <InputField
              type="text"
              label="Full Name"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <InputField
              type="email"
              label="Email Address"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <InputField
              type="text"
              label="Company Name"
              icon={Building2}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />

            {/* Consent Checkbox */}
            <div className="mt-8 mb-8">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5 mt-0.5">
                  <input
                    type="checkbox"
                    checked={subscribe}
                    onChange={(e) => setSubscribe(e.target.checked)}
                    className="w-5 h-5 bg-transparent border-2 border-[#D9D6CB] checked:bg-[#205E40] checked:border-[#205E40] transition-all cursor-pointer appearance-none rounded-[4px]"
                  />
                  {subscribe && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <CheckCircle2 size={20} className="text-[#F2F1EA]" />
                    </motion.div>
                  )}
                </div>
                <span className="text-[#6F6F68] text-sm leading-relaxed group-hover:text-[#1A1B1D] transition-colors">
                  I agree to receive updates, newsletters, and marketing communications from <Brand />.
                  You can unsubscribe at any time.
                </span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-[#BE123C]/10 border border-[#BE123C]/50 text-[#BE123C] text-sm font-mono rounded-[6px]"
              >
                {error}
              </motion.div>
            )}

            <div className="mt-12">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1A1B1D] text-[#F2F1EA] font-bold py-4 rounded-full flex items-center justify-between px-8 hover:bg-[#205E40] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="font-mono uppercase tracking-[0.22em]">
                  {isLoading ? 'Processing...' : 'Send Inquiry'}
                </span>
                {isLoading ? (
                   <div className="animate-spin h-5 w-5 border-2 border-[#F2F1EA] border-t-transparent rounded-full" />
                ) : (
                  <Send className="group-hover:translate-x-1 transition-transform" size={20} />
                )}
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#205E40]/10 text-[#205E40] mb-8">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-display font-bold tracking-[-0.035em] text-[#1A1B1D] mb-4">Message received.</h2>
          <p className="text-[#6F6F68] font-mono text-xs uppercase tracking-[0.22em] leading-relaxed">
            Thank you, {name.split(' ')[0]}.<br/>
            {company && <>Our team will be in touch with {company} shortly.</>}
            {!company && <>Our team will be in touch shortly.</>}
            {subscribe && (
              <>
                <br/><br/>
                You&apos;ve been added to our mailing list.
              </>
            )}
          </p>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setName('');
              setEmail('');
              setCompany('');
              setSubscribe(false);
              setError('');
            }}
            className="mt-12 font-mono text-[#205E40] text-xs uppercase tracking-[0.22em] hover:text-[#1A1B1D] transition-colors"
          >
            Back to Form
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ContactPageClient() {
  return (
    <div className="flex min-h-screen w-full bg-[#ECEAE3]">
      {/* Left Side - Visual (Hidden on mobile) */}
      <div className="hidden lg:block w-1/2 h-screen sticky top-0">
        <BiomeVisual />
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 relative overflow-hidden">

        <div className="w-full max-w-md relative z-10">
          {/* Wordmark Header */}
          <div className="flex items-center mb-16">
            <span className="font-display text-2xl text-[#1A1B1D] select-none">
              <Brand />
            </span>
          </div>

          <Suspense fallback={
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#205E40] border-t-transparent"></div>
            </div>
          }>
            <ContactForm />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-[#6F6F68] text-[10px] font-mono uppercase tracking-[0.22em]">
            <Brand /> Intelligence Engine &middot; Support Terminal 0-1
          </p>
        </div>
      </div>
    </div>
  );
}
