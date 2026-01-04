'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, User, Building2, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const BiomeVisual = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080808]">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay grayscale" />

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-[#ccff00]/20"
            style={{
              width: `${(i + 1) * 300}px`,
              height: `${(i + 1) * 300}px`,
            }}
            animate={{
              rotate: [0, 360],
              scale: [1, 1.05, 1],
              borderWidth: ["1px", "3px", "1px"],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{
              duration: 20 + i * 5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}

        <motion.div
          className="w-64 h-64 rounded-full bg-[#ccff00]/5 blur-[100px]"
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>

      <div className="absolute bottom-12 left-12 right-12">
        <h2 className="text-4xl md:text-5xl font-serif text-white mb-4 leading-none">
          Let&apos;s <span className="italic text-[#ccff00]">Cultivate</span><br/> Tomorrow
        </h2>
        <p className="font-mono text-xs text-gray-400 uppercase tracking-widest max-w-md">
          Join the network of leaders redefining ecological intelligence. Start your journey with AlkaTera.
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
          "absolute left-8 transition-all duration-300 pointer-events-none font-mono text-xs tracking-widest uppercase",
          (isFocused || value) ? "-top-3 text-[#ccff00] text-[10px]" : "top-3 text-gray-500"
        )}
      >
        {label}
      </label>

      <div className="absolute left-0 top-3 text-gray-500 group-focus-within:text-[#ccff00] transition-colors">
        <Icon size={18} />
      </div>

      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        required={required}
        className="w-full bg-transparent border-b border-gray-800 py-3 pl-8 text-white placeholder-transparent focus:outline-none focus:border-[#ccff00] transition-colors font-sans text-lg"
      />
    </div>
  );
};

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // TODO: Add Supabase integration here
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1500);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#050505]">
      {/* Left Side - Visual (Hidden on mobile) */}
      <div className="hidden lg:block w-1/2 h-screen sticky top-0">
        <BiomeVisual />
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 relative overflow-hidden">

        <div className="absolute inset-0 z-0 pointer-events-none">
           <img
              src="https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?q=80&w=2874&auto=format&fit=crop"
              alt="Texture"
              className="w-full h-full object-cover opacity-10 mix-blend-overlay grayscale"
           />
           <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Logo Header */}
          <div className="flex items-center mb-16">
            <img
              src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
              alt="AlkaTera"
              className="h-10 w-auto object-contain"
            />
          </div>

          <AnimatePresence mode="wait">
            {!isSubmitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-3xl md:text-4xl font-serif text-white mb-2">Connect with Us</h1>
                <p className="text-gray-500 font-mono text-sm mb-12 uppercase tracking-widest">
                  Ready to scale your impact? Let&apos;s talk.
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

                  <div className="mt-12">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#ccff00] text-black font-bold py-4 flex items-center justify-between px-6 hover:bg-white transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <span className="font-mono uppercase tracking-widest">
                        {isLoading ? 'Processing...' : 'Send Inquiry'}
                      </span>
                      {isLoading ? (
                         <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
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
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#ccff00]/10 text-[#ccff00] mb-8">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-serif text-white mb-4">Transmission Received</h2>
                <p className="text-gray-400 font-mono text-sm uppercase tracking-widest leading-relaxed">
                  Thank you, {name.split(' ')[0]}.<br/>
                  Our team will be in touch with {company} shortly.
                </p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="mt-12 font-mono text-[#ccff00] text-xs uppercase tracking-widest hover:text-white transition-colors"
                >
                  Back to Form
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-gray-700 text-[10px] font-mono uppercase tracking-widest">
            AlkaTera Intelligence Engine &bull; Support Terminal 0-1
          </p>
        </div>
      </div>
    </div>
  );
}
