'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';

interface NavigationProps {
  onOpenContact?: () => void;
}

export const Navigation = ({ onOpenContact }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cream-on-transparent only works over the homepage's photo hero.
  // Every other public page opens on paper, so the bar reads in ink there.
  const overPhoto = pathname === '/' && !scrolled;

  const navItems = [
    { label: 'Platform', href: '/platform' },
    { label: 'Pricing', href: '/getaccess' },
    { label: 'Manifesto', href: '/manifesto' },
    { label: 'Impact', href: '/impact' },
    { label: 'Knowledge', href: '/knowledge' },
    { label: 'Login', href: '/login' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center transition-colors duration-200 ease-studio ${overPhoto ? 'bg-transparent text-[#F2F1EA]' : 'bg-background text-foreground border-b border-border'}`}>
      <div className="z-50">
        <Link href="/" className="select-none font-display text-2xl tracking-[-0.02em] leading-none">
          <span className="font-medium">alka</span><span className="font-bold">tera</span>
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-8 font-mono text-[10px] font-bold tracking-[0.22em] uppercase">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="hover:opacity-60 transition-opacity duration-200 ease-studio"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/getaccess"
          className={`border px-6 py-2 rounded-full transition-colors duration-200 ease-studio ${overPhoto ? 'border-[#F2F1EA]/40 hover:border-[#F2F1EA]' : 'border-foreground/40 hover:border-foreground'}`}
        >
          Get Access
        </Link>
        <Link
          href="/getaccess/signup?trial=true"
          className={`px-6 py-2 rounded-full hover:opacity-90 transition-opacity duration-200 ease-studio ${overPhoto ? 'bg-[#F2F1EA] text-[#1A1B1D]' : 'bg-primary text-primary-foreground'}`}
        >
          Start free trial
        </Link>
      </div>

      <button
        className="md:hidden z-50"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="text-foreground" /> : <Menu />}
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed inset-0 bg-background text-foreground z-40 flex flex-col justify-center items-center gap-8 md:hidden"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="text-4xl font-display font-bold tracking-[-0.035em] hover:opacity-60 transition-opacity duration-200 ease-studio"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/getaccess"
              onClick={() => setIsOpen(false)}
              className="mt-8 text-foreground font-mono text-[11px] font-bold uppercase tracking-[0.22em] border border-foreground/40 px-8 py-4 rounded-full"
            >
              Get Access
            </Link>
            <Link
              href="/getaccess/signup?trial=true"
              onClick={() => setIsOpen(false)}
              className="bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-[0.22em] px-8 py-4 rounded-full"
            >
              Start free trial
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
