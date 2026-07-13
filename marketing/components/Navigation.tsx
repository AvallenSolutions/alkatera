'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import Link from 'next/link';

interface NavigationProps {
  onOpenContact?: () => void;
}

export const Navigation = ({ onOpenContact }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Platform', href: '/platform' },
    { label: 'Pricing', href: '/getaccess' },
    { label: 'Manifesto', href: '/manifesto' },
    { label: 'Impact', href: '/impact' },
    { label: 'Knowledge', href: '/knowledge' },
    { label: 'Book a demo', href: '/demo' },
    { label: 'Login', href: '/login' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center text-white transition-colors duration-300 ${scrolled ? 'bg-black' : 'bg-transparent'}`}>
      <div className="z-50">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-8 font-mono text-xs tracking-widest uppercase">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="hover:opacity-50 transition-opacity duration-300"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/getaccess/signup?trial=true"
          className="bg-[#ccff00] text-black px-6 py-2 rounded-full hover:opacity-90 transition-opacity duration-300"
        >
          Start free trial
        </Link>
      </div>

      <button
        className="md:hidden z-50"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed inset-0 bg-[#0a0a0a] z-40 flex flex-col justify-center items-center gap-8 md:hidden"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="text-4xl font-serif hover:text-[#ccff00] transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/getaccess/signup?trial=true"
              onClick={() => setIsOpen(false)}
              className="mt-8 text-black bg-[#ccff00] font-mono uppercase tracking-widest px-8 py-4 rounded-full"
            >
              Start free trial
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
